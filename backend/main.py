from fastapi import FastAPI, Depends, HTTPException, Response, Cookie
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import models
from models import SessionLocal, engine
from pydantic import BaseModel
import datetime
import os
import secrets
import hashlib
import logging
import bcrypt
import hmac
import time
from medication_calculator import calculate_medication_levels

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

models.Base.metadata.create_all(bind=engine)

# Get ADMIN USER from environment variable
ADMIN_USER = os.getenv("ADMIN_USER", "admin")

# Check if we're in development mode (for cookie security settings)
IS_DEVELOPMENT = os.getenv("ENVIRONMENT", "production") == "development"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth secret for cookie signing
AUTH_SECRET = os.getenv("AUTH_SECRET", secrets.token_hex(32))

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def verify_password(plain_password: str, hashed_password: str, salt: str) -> bool:
    """Verify password with salt."""
    # Hash the password+salt combination with SHA256 first to avoid bcrypt's 72-byte limit
    password_with_salt = hashlib.sha256((plain_password + salt).encode()).digest()
    logger.info(f"Verifying password - SHA256 hash length: {len(password_with_salt)} bytes")
    # bcrypt expects bytes
    return bcrypt.checkpw(password_with_salt, hashed_password.encode())

def get_password_hash(password: str, salt: str) -> str:
    """Hash password with salt."""
    # Hash the password+salt combination with SHA256 first to avoid bcrypt's 72-byte limit
    combined = password + salt
    logger.info(f"Hashing password - Input length: {len(combined)} chars, {len(combined.encode())} bytes")
    password_with_salt = hashlib.sha256(combined.encode()).digest()
    logger.info(f"After SHA256 - Hash length: {len(password_with_salt)} bytes")

    # Hash with bcrypt
    hashed = bcrypt.hashpw(password_with_salt, bcrypt.gensalt())
    logger.info(f"Successfully hashed password")
    return hashed.decode('utf-8')

def generate_salt() -> str:
    """Generate a random salt."""
    return secrets.token_hex(16)

def create_auth_token(username: str) -> str:
    """Create a secure HMAC-signed authentication token."""
    timestamp = str(int(time.time()))
    message = f"{username}:{timestamp}"
    signature = hmac.new(
        AUTH_SECRET.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    return f"{username}:{timestamp}:{signature}"

def verify_auth_token(token: str, max_age_seconds: int = 60 * 60 * 24 * 360) -> str | None:
    """
    Verify HMAC-signed authentication token and return username if valid.
    Returns None if token is invalid or expired.
    """
    try:
        parts = token.split(":")
        if len(parts) != 3:
            logger.warning(f"Invalid token format: expected 3 parts, got {len(parts)}")
            return None

        username, timestamp, provided_signature = parts

        # Verify timestamp is not too old
        token_age = int(time.time()) - int(timestamp)
        if token_age > max_age_seconds:
            logger.warning(f"Token expired: age={token_age}s, max={max_age_seconds}s")
            return None

        # Verify timestamp is not from the future (clock skew tolerance: 5 minutes)
        if token_age < -300:
            logger.warning(f"Token from future: age={token_age}s")
            return None

        # Recreate the signature and compare
        message = f"{username}:{timestamp}"
        expected_signature = hmac.new(
            AUTH_SECRET.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()

        # Use constant-time comparison to prevent timing attacks
        if not hmac.compare_digest(expected_signature, provided_signature):
            logger.warning(f"Invalid signature for user: {username}")
            return None

        return username
    except Exception as e:
        logger.error(f"Error verifying token: {e}")
        return None

# Pydantic model for login
class LoginRequest(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    password: str
    read_only: bool

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def get_current_user_from_cookie(auth_token: str, db: Session):
    """Extract and validate user from auth cookie with HMAC verification."""
    if not auth_token:
        logger.warning("No auth token provided")
        return None

    logger.info(f"Validating auth token (length: {len(auth_token)})")

    # Verify the token signature
    username = verify_auth_token(auth_token)
    if not username:
        logger.warning("Failed to verify auth token")
        return None

    logger.info(f"Token verified for username: {username}")

    # Get user from database
    user = get_user_by_username(db, username)
    if not user or not user.is_active:
        logger.warning(f"User not found or inactive: {username}")
        return None

    logger.info(f"User authenticated successfully: {username}")
    return user

def require_write_access(auth_token: str = Cookie(None), db: Session = Depends(get_db)):
    """Dependency to check if user has write access (not read-only)."""
    user = get_current_user_from_cookie(auth_token, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if user.read_only:
        raise HTTPException(status_code=403, detail="Read-only access: modifications not allowed")
    return user

def require_auth(auth_token: str = Cookie(None), db: Session = Depends(get_db)):
    """Dependency to check if user is authenticated (read or write access)."""
    user = get_current_user_from_cookie(auth_token, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

def authenticate_user(db: Session, username: str, password: str):
    user = get_user_by_username(db, username)
    if not user or not user.is_active:
        return None
    if not verify_password(password, user.password_hash, user.salt):
        return None
    return user

@app.post("/api/auth/login")
def login(login_data: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """Login with username and password."""
    user = authenticate_user(db, login_data.username, login_data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Create a secure HMAC-signed token
    token = create_auth_token(user.username)
    logger.info(f"Login successful for user: {user.username}, token length: {len(token)}")

    response.set_cookie(
        key="auth_token",
        value=token,
        httponly=True,
        secure=not IS_DEVELOPMENT,  # Allow cookies over HTTP in development
        samesite="strict",
        max_age=60 * 60 * 24 * 360  # 360 days
    )
    return {
        "success": True, 
        "username": user.username, 
        "read_only": user.read_only,
        "is_admin": user.username == ADMIN_USER
    }

@app.post("/api/auth/logout")
def logout(response: Response):
    """Clear the auth cookie."""
    response.delete_cookie(key="auth_token")
    return {"success": True}

@app.post("/api/auth/register")
def register(user_data: UserCreate, auth_token: str = Cookie(None), db: Session = Depends(get_db)):
    """Register a new user. Only allowed for ADMIN_USER or when creating the first user."""
    # Check if ADMIN_USER exists and is active
    admin_user = get_user_by_username(db, ADMIN_USER)

    if admin_user is None:
        # No admin user exists - allow creation of the first user, which must be the admin
        if user_data.username != ADMIN_USER:
            raise HTTPException(
                status_code=403, 
                detail=f"First user must be the admin user, you choose the name in the .env or docker-compose file"
            )
    else:
        # Admin user exists - verify that the request is made by the admin
        current_user = get_current_user_from_cookie(auth_token, db)
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")

        if current_user.username != ADMIN_USER:
            raise HTTPException(
                status_code=403, 
                detail="Only the admin user can register new users"
            )

    # Check if user already exists
    existing_user = get_user_by_username(db, user_data.username)
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")

    # Create new user with salt
    salt = generate_salt()
    hashed_password = get_password_hash(user_data.password, salt)
    db_user = models.User(
        username=user_data.username,
        password_hash=hashed_password,
        read_only=user_data.read_only,
        is_active=True,
        salt=salt
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return {"success": True, "username": db_user.username}

@app.get("/api/auth/me")
def get_current_user(auth_token: str = Cookie(None), db: Session = Depends(get_db)):
    """Get current logged in user."""
    if not auth_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Validate token and get user
    user = get_current_user_from_cookie(auth_token, db)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    return {
        "username": user.username, 
        "read_only": user.read_only,
        "is_admin": user.username == ADMIN_USER
    }

@app.get("/api/logs")
def get_all_logs(db: Session = Depends(get_db), current_user: models.User = Depends(require_auth)):
    """Get all logs. Requires authentication."""
    return db.query(models.Log).order_by(models.Log.date.asc(), models.Log.time.asc()).all()

# Pydantic model for request body
class LogCreate(BaseModel):
    date: datetime.date | None = None
    time: datetime.time | None = None
    weight: float | None = None
    body_fat: float | None = None
    muscle: float | None = None
    visceral_fat: int | None = None
    sleep: float | None = None
    notes: str | None = None

@app.post("/api/logs")
def create_log(log: LogCreate, db: Session = Depends(get_db), user: models.User = Depends(require_write_access)):
    db_log = models.Log(
        date=log.date if log.date else datetime.date.today(),
        time=log.time if log.time else datetime.datetime.now().time(),
        weight=log.weight,
        body_fat=log.body_fat,
        muscle=log.muscle,
        visceral_fat=log.visceral_fat,
        sleep=log.sleep,
        notes=log.notes
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

@app.put("/api/logs/{log_id}")
def update_log(log_id: int, log: LogCreate, db: Session = Depends(get_db), user: models.User = Depends(require_write_access)):
    db_log = db.query(models.Log).filter(models.Log.id == log_id).first()
    if db_log is None:
        raise HTTPException(status_code=404, detail="Log not found")

    for key, value in log.dict(exclude_unset=True).items():
        setattr(db_log, key, value)

    db.commit()
    db.refresh(db_log)
    return db_log

@app.delete("/api/logs/{log_id}")
def delete_log(log_id: int, db: Session = Depends(get_db), user: models.User = Depends(require_write_access)):
    db_log = db.query(models.Log).filter(models.Log.id == log_id).first()
    if db_log is None:
        raise HTTPException(status_code=404, detail="Log not found")

    db.delete(db_log)
    db.commit()
    return {"ok": True}

@app.get("/api/logs/last")
def get_last_log(db: Session = Depends(get_db), current_user: models.User = Depends(require_auth)):
    """Get the last log entry. Requires authentication."""
    last_log = db.query(models.Log).order_by(models.Log.id.desc()).first()
    if last_log is None:
        raise HTTPException(status_code=404, detail="No logs found")
    return last_log

# Jab endpoints
class JabCreate(BaseModel):
    date: datetime.date | None = None
    time: datetime.time | None = None
    dose: float
    notes: str | None = None

@app.get("/api/jabs")
def get_all_jabs(db: Session = Depends(get_db), current_user: models.User = Depends(require_auth)):
    """Get all jab entries. Requires authentication."""
    return db.query(models.Jab).order_by(models.Jab.date.asc(), models.Jab.time.asc()).all()

@app.post("/api/jabs")
def create_jab(jab: JabCreate, db: Session = Depends(get_db), user: models.User = Depends(require_write_access)):
    db_jab = models.Jab(
        date=jab.date if jab.date else datetime.date.today(),
        time=jab.time if jab.time else datetime.datetime.now().time(),
        dose=jab.dose,
        notes=jab.notes
    )
    db.add(db_jab)
    db.commit()
    db.refresh(db_jab)
    return db_jab

@app.put("/api/jabs/{jab_id}")
def update_jab(jab_id: int, jab: JabCreate, db: Session = Depends(get_db), user: models.User = Depends(require_write_access)):
    db_jab = db.query(models.Jab).filter(models.Jab.id == jab_id).first()
    if db_jab is None:
        raise HTTPException(status_code=404, detail="Jab not found")

    for key, value in jab.dict(exclude_unset=True).items():
        setattr(db_jab, key, value)

    db.commit()
    db.refresh(db_jab)
    return db_jab

@app.delete("/api/jabs/{jab_id}")
def delete_jab(jab_id: int, db: Session = Depends(get_db), user: models.User = Depends(require_write_access)):
    db_jab = db.query(models.Jab).filter(models.Jab.id == jab_id).first()
    if db_jab is None:
        raise HTTPException(status_code=404, detail="Jab not found")

    db.delete(db_jab)
    db.commit()
    return {"ok": True}

@app.get("/api/jabs/last")
def get_last_jab(db: Session = Depends(get_db), current_user: models.User = Depends(require_auth)):
    """Get the last jab entry. Requires authentication."""
    last_jab = db.query(models.Jab).order_by(models.Jab.id.desc()).first()
    if last_jab is None:
        raise HTTPException(status_code=404, detail="No jabs found")
    return last_jab

@app.get("/api/medication-levels")
def get_medication_levels(db: Session = Depends(get_db), current_user: models.User = Depends(require_auth)):
    """
    Calculate and return medication levels over time based on jab history.
    Requires authentication.

    Returns a list of datetime + medication level values.
    """
    jabs = db.query(models.Jab).order_by(models.Jab.date.asc(), models.Jab.time.asc()).all()

    if not jabs:
        return []

    # Convert SQLAlchemy models to dictionaries for the calculator
    jabs_data = [
        {
            "date": jab.date,
            "time": jab.time,
            "dose": jab.dose,
            "notes": jab.notes
        }
        for jab in jabs
    ]

    # Calculate medication levels
    levels = calculate_medication_levels(jabs_data)

    return levels

# Body Measurement endpoints
class BodyMeasurementCreate(BaseModel):
    date: datetime.date | None = None
    time: datetime.time | None = None
    upper_arm_left: float | None = None
    upper_arm_right: float | None = None
    chest: float | None = None
    waist: float | None = None
    thigh_left: float | None = None
    thigh_right: float | None = None
    face: float | None = None
    neck: float | None = None
    notes: str | None = None

@app.get("/api/body-measurements")
def get_all_body_measurements(db: Session = Depends(get_db), current_user: models.User = Depends(require_auth)):
    """Get all body measurement entries. Requires authentication."""
    return db.query(models.BodyMeasurement).order_by(models.BodyMeasurement.date.asc(), models.BodyMeasurement.time.asc()).all()

@app.post("/api/body-measurements")
def create_body_measurement(measurement: BodyMeasurementCreate, db: Session = Depends(get_db), user: models.User = Depends(require_write_access)):
    db_measurement = models.BodyMeasurement(
        date=measurement.date if measurement.date else datetime.date.today(),
        time=measurement.time if measurement.time else datetime.datetime.now().time(),
        upper_arm_left=measurement.upper_arm_left,
        upper_arm_right=measurement.upper_arm_right,
        chest=measurement.chest,
        waist=measurement.waist,
        thigh_left=measurement.thigh_left,
        thigh_right=measurement.thigh_right,
        face=measurement.face,
        neck=measurement.neck,
        notes=measurement.notes
    )
    db.add(db_measurement)
    db.commit()
    db.refresh(db_measurement)
    return db_measurement

@app.put("/api/body-measurements/{measurement_id}")
def update_body_measurement(measurement_id: int, measurement: BodyMeasurementCreate, db: Session = Depends(get_db), user: models.User = Depends(require_write_access)):
    db_measurement = db.query(models.BodyMeasurement).filter(models.BodyMeasurement.id == measurement_id).first()
    if db_measurement is None:
        raise HTTPException(status_code=404, detail="Body measurement not found")

    for key, value in measurement.dict(exclude_unset=True).items():
        setattr(db_measurement, key, value)

    db.commit()
    db.refresh(db_measurement)
    return db_measurement

@app.delete("/api/body-measurements/{measurement_id}")
def delete_body_measurement(measurement_id: int, db: Session = Depends(get_db), user: models.User = Depends(require_write_access)):
    db_measurement = db.query(models.BodyMeasurement).filter(models.BodyMeasurement.id == measurement_id).first()
    if db_measurement is None:
        raise HTTPException(status_code=404, detail="Body measurement not found")

    db.delete(db_measurement)
    db.commit()
    return {"ok": True}

@app.get("/api/body-measurements/last")
def get_last_body_measurement(db: Session = Depends(get_db), current_user: models.User = Depends(require_auth)):
    """Get the last body measurement entry. Requires authentication."""
    last_measurement = db.query(models.BodyMeasurement).order_by(models.BodyMeasurement.id.desc()).first()
    if last_measurement is None:
        raise HTTPException(status_code=404, detail="No body measurements found")
    return last_measurement

class SettingUpdate(BaseModel):
    setting_key: str
    setting_value: str

@app.get("/api/settings")
def get_user_settings(db: Session = Depends(get_db), current_user: models.User = Depends(require_auth)):
    """Get all settings for the current user. Returns a dict of key-value pairs."""
    settings = db.query(models.UserSettings).filter(models.UserSettings.user_id == current_user.id).all()
    return {setting.setting_key: setting.setting_value for setting in settings}

@app.get("/api/settings/{setting_key}")
def get_user_setting(setting_key: str, db: Session = Depends(get_db), current_user: models.User = Depends(require_auth)):
    """Get a specific setting for the current user."""
    setting = db.query(models.UserSettings).filter(
        models.UserSettings.user_id == current_user.id,
        models.UserSettings.setting_key == setting_key
    ).first()

    if setting is None:
        raise HTTPException(status_code=404, detail="Setting not found")

    return {"setting_key": setting.setting_key, "setting_value": setting.setting_value}

@app.put("/api/settings/{setting_key}")
def update_user_setting(
    setting_key: str,
    setting_update: SettingUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_auth)
):
    """Update or create a setting for the current user. Authorized users (including read-only) can update settings."""
    # Find existing setting
    setting = db.query(models.UserSettings).filter(
        models.UserSettings.user_id == current_user.id,
        models.UserSettings.setting_key == setting_key
    ).first()

    if setting:
        # Update existing setting
        setting.setting_value = setting_update.setting_value
    else:
        # Create new setting
        setting = models.UserSettings(
            user_id=current_user.id,
            setting_key=setting_key,
            setting_value=setting_update.setting_value
        )
        db.add(setting)

    db.commit()
    db.refresh(setting)
    return {"setting_key": setting.setting_key, "setting_value": setting.setting_value}

@app.post("/api/settings")
def batch_update_settings(
    settings: dict[str, str],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_auth)
):
    """Batch update multiple settings for the current user."""
    updated_settings = {}

    for key, value in settings.items():
        # Find existing setting
        setting = db.query(models.UserSettings).filter(
            models.UserSettings.user_id == current_user.id,
            models.UserSettings.setting_key == key
        ).first()

        if setting:
            setting.setting_value = value
        else:
            setting = models.UserSettings(
                user_id=current_user.id,
                setting_key=key,
                setting_value=value
            )
            db.add(setting)

        updated_settings[key] = value

    db.commit()
    return updated_settings

@app.delete("/api/settings/{setting_key}")
def delete_user_setting(
    setting_key: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_auth)
):
    """Delete a setting for the current user."""
    setting = db.query(models.UserSettings).filter(
        models.UserSettings.user_id == current_user.id,
        models.UserSettings.setting_key == setting_key
    ).first()

    if setting is None:
        raise HTTPException(status_code=404, detail="Setting not found")

    db.delete(setting)
    db.commit()
    return {"ok": True}

