from fastapi import FastAPI
from app.database import SessionLocal, Lead
from app.model import Predictor

app = FastAPI()

predictor = Predictor()


@app.post("/predict")

def predict(pain_point:str):

    pred, prob = predictor.predict(pain_point)


    db = SessionLocal()


    lead = Lead(

        pain_point=pain_point,

        prediction="Success" if pred==1 else "Failure",

        probability=float(prob)

    )


    db.add(lead)

    db.commit()


    return {

        "prediction":lead.prediction,

        "probability":lead.probability

    }


@app.post("/learn")

def learn(pain_point:str, actual:str):


    predictor.learn(

        pain_point,

        actual

    )


    db = SessionLocal()


    lead = db.query(Lead).filter(

        Lead.pain_point==pain_point

    ).first()


    lead.actual = actual


    db.commit()


    return {

        "status":"learned"

    }
