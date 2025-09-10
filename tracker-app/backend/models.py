from sqlalchemy import create_engine, Column, Integer, String, Float, Date, Time
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import datetime
import os

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./data/database.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Log(Base):
    __tablename__ = "logs"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, default=datetime.date.today)
    time = Column(Time, default=datetime.datetime.now().time)
    weight = Column(Float, nullable=True)
    body_fat = Column(Float, nullable=True)
    muscle = Column(Float, nullable=True)
    visceral_fat = Column(Integer, nullable=True)
    sleep = Column(Float, nullable=True)
    notes = Column(String, nullable=True)

Base.metadata.create_all(bind=engine)
