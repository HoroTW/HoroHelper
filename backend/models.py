from sqlalchemy import create_engine, Column, Integer, String, Float, Date, Time, Boolean
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

class Jab(Base):
    __tablename__ = "jabs"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, default=datetime.date.today)
    time = Column(Time, default=datetime.datetime.now().time)
    dose = Column(Float, nullable=False)  # dose in mg
    notes = Column(String, nullable=True)

class BodyMeasurement(Base):
    __tablename__ = "body_measurements"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, default=datetime.date.today)
    time = Column(Time, default=datetime.datetime.now().time)
    upper_arm_left = Column(Float, nullable=True)
    upper_arm_right = Column(Float, nullable=True)
    chest = Column(Float, nullable=True)
    waist = Column(Float, nullable=True)
    thigh_left = Column(Float, nullable=True)
    thigh_right = Column(Float, nullable=True)
    face = Column(Float, nullable=True)
    neck = Column(Float, nullable=True)
    notes = Column(String, nullable=True)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    salt = Column(String, nullable=False)  # Store salt separately for additional security
    is_active = Column(Boolean, default=True)
    read_only = Column(Boolean, default=False)  # Read-only users can view but not modify data
    created_at = Column(Date, default=datetime.date.today)

Base.metadata.create_all(bind=engine)
