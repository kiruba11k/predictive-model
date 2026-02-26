import os
from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(bind=engine)

Base = declarative_base()


class Lead(Base):

    __tablename__ = "leads"

    id = Column(Integer, primary_key=True)

    pain_point = Column(String)

    prediction = Column(String)

    probability = Column(Float)

    actual = Column(String)


Base.metadata.create_all(engine)
