from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import models
from models import SessionLocal, engine
from pydantic import BaseModel
import datetime

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
    return db.query(models.Log).order_by(models.Log.id.asc()).all()

# Pydantic model for request body
class LogCreate(BaseModel):
    weight: float | None = None
    body_fat: float | None = None
    muscle: float | None = None
    visceral_fat: int | None = None
    sleep: float | None = None
    notes: str | None = None

@app.post("/api/logs")
def create_log(log: LogCreate, db: Session = Depends(get_db)):
    db_log = models.Log(
        date=datetime.date.today(),
        time=datetime.datetime.now().time(),
        **log.dict()
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
