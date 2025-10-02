from fastapi import FastAPI, Depends, HTTPException, Response, Cookie
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import models
from models import SessionLocal, engine
from pydantic import BaseModel
import datetime
import os
import secrets
from passlib.context import CryptContext
from medication_calculator import calculate_medication_levels

models.Base.metadata.create_all(bind=engine)

# Get ADMIN USER from environment variable
ADMIN_USER = os.getenv("ADMIN_USER", "admin")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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
    return pwd_context.verify(plain_password + salt, hashed_password)

def get_password_hash(password: str, salt: str) -> str:
    """Hash password with salt."""
    return pwd_context.hash(password + salt)

def generate_salt() -> str:
    """Generate a random salt."""
    return secrets.token_hex(16)

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
    """Extract and validate user from auth cookie."""
    if not auth_token:
        return None
    try:
        username = auth_token.split(":")[0]
        user = get_user_by_username(db, username)
        if user and user.is_active:
            return user
    except:
        pass
    return None

def require_write_access(auth_token: str = Cookie(None), db: Session = Depends(get_db)):
    """Dependency to check if user has write access (not read-only)."""
    user = get_current_user_from_cookie(auth_token, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if user.read_only:
        raise HTTPException(status_code=403, detail="Read-only access: modifications not allowed")
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
    
    # Set a secure httpOnly cookie with username as token (signed with secret)
    # In production, you'd want JWT or similar
    token = f"{user.username}:{AUTH_SECRET}"
    response.set_cookie(
        key="auth_token",
        value=token,
        httponly=True,
        secure=True,  # Only over HTTPS
        samesite="strict",
        max_age=60 * 60 * 24 * 360  # 360 days
    )
    return {"success": True, "username": user.username, "read_only": user.read_only}

@app.post("/api/auth/logout")
def logout(response: Response):
    """Clear the auth cookie."""
    response.delete_cookie(key="auth_token")
    return {"success": True}

@app.post("/api/auth/register")
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user. Only allowed for ADMIN_USER."""
    # Check if ADMIN_USER exists and is active
    admin_user = get_user_by_username(db, ADMIN_USER)
    if admin_user is None:
        # If no admin user exists, allow creation of the first user as admin
        if user_data.username != ADMIN_USER:
            raise HTTPException(status_code=403, detail="First user must be the admin user")
    
    # TODO: Only allow ADMIN_USER to create new users so we need to check if the request is made by ADMIN_USER

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
    
    # Extract username from token (basic implementation)
    try:
        username = auth_token.split(":")[0]
        user = get_user_by_username(db, username)
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="Invalid session")
        return {"username": user.username, "read_only": user.read_only}
    except:
        raise HTTPException(status_code=401, detail="Invalid session")

@app.get("/api/logs")
def get_all_logs(db: Session = Depends(get_db)):
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
def get_last_log(db: Session = Depends(get_db)):
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
def get_all_jabs(db: Session = Depends(get_db)):
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
def get_last_jab(db: Session = Depends(get_db)):
    last_jab = db.query(models.Jab).order_by(models.Jab.id.desc()).first()
    if last_jab is None:
        raise HTTPException(status_code=404, detail="No jabs found")
    return last_jab

@app.get("/api/medication-levels")
def get_medication_levels(db: Session = Depends(get_db)):
    """
    Calculate and return medication levels over time based on jab history.
    
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
