import os

from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.orm import declarative_base, sessionmaker


# Render free tier writable temp path

DATABASE_PATH = "/tmp/leads.db"

DATABASE_URL = f"sqlite:///{DATABASE_PATH}"


engine = create_engine(

    DATABASE_URL,

    connect_args={"check_same_thread": False}

)


SessionLocal = sessionmaker(

    autocommit=False,

    autoflush=False,

    bind=engine

)


Base = declarative_base()


class Lead(Base):

    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)

    pain_point = Column(String)

    prediction = Column(String)

    probability = Column(Float)

    actual = Column(String)


# Create DB file in /tmp

Base.metadata.create_all(bind=engine)
