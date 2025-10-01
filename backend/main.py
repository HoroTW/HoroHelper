from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import models
from models import SessionLocal, engine
from pydantic import BaseModel
import datetime
from medication_calculator import calculate_medication_levels

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

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
def create_log(log: LogCreate, db: Session = Depends(get_db)):
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
def update_log(log_id: int, log: LogCreate, db: Session = Depends(get_db)):
    db_log = db.query(models.Log).filter(models.Log.id == log_id).first()
    if db_log is None:
        raise HTTPException(status_code=404, detail="Log not found")

    for key, value in log.dict(exclude_unset=True).items():
        setattr(db_log, key, value)

    db.commit()
    db.refresh(db_log)
    return db_log

@app.delete("/api/logs/{log_id}")
def delete_log(log_id: int, db: Session = Depends(get_db)):
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
def create_jab(jab: JabCreate, db: Session = Depends(get_db)):
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
def update_jab(jab_id: int, jab: JabCreate, db: Session = Depends(get_db)):
    db_jab = db.query(models.Jab).filter(models.Jab.id == jab_id).first()
    if db_jab is None:
        raise HTTPException(status_code=404, detail="Jab not found")

    for key, value in jab.dict(exclude_unset=True).items():
        setattr(db_jab, key, value)

    db.commit()
    db.refresh(db_jab)
    return db_jab

@app.delete("/api/jabs/{jab_id}")
def delete_jab(jab_id: int, db: Session = Depends(get_db)):
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
