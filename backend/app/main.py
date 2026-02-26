from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.database import SessionLocal, Lead
from app.model import Predictor
from pydantic import BaseModel
import time
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize predictor (this might take a moment on first request)
predictor = None

def get_predictor():
    global predictor
    if predictor is None:
        logger.info("Loading predictor model...")
        predictor = Predictor()
        logger.info("Predictor loaded successfully")
    return predictor

@app.get("/")
def root():
    return {"status": "Server is running", "message": "Use POST /predict?pain_point=your_text"}

@app.post("/predict")
def predict(pain_point: str):
    """
    Predict lead success based on pain point
    """
    start_time = time.time()
    
    if not pain_point or not pain_point.strip():
        raise HTTPException(status_code=400, detail="Pain point cannot be empty")
    
    try:
        logger.info(f"Making prediction for: {pain_point[:50]}...")
        
        # Get predictor (lazy loading)
        model = get_predictor()
        
        # Make prediction
        pred, prob = model.predict(pain_point.strip())
        
        logger.info(f"Prediction completed in {time.time() - start_time:.2f}s")
        
        # Save to database
        db = SessionLocal()
        try:
            lead = Lead(
                pain_point=pain_point.strip(),
                prediction="Success" if pred == 1 else "Failure",
                probability=float(prob)
            )
            
            db.add(lead)
            db.commit()
            
            logger.info(f"Lead saved to database with ID: {lead.id}")
            
            return {
                "prediction": lead.prediction,
                "probability": lead.probability,
                "id": lead.id
            }
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

@app.post("/learn")
def learn(pain_point: str, actual: str):
    """
    Teach the model with actual results
    """
    if actual not in ["Yes", "No"]:
        raise HTTPException(status_code=400, detail="Actual must be 'Yes' or 'No'")
    
    try:
        logger.info(f"Learning from: {pain_point[:50]}... -> {actual}")
        
        # Get predictor
        model = get_predictor()
        
        # Learn from feedback
        model.learn(pain_point.strip(), actual)
        
        # Update database
        db = SessionLocal()
        try:
            lead = db.query(Lead).filter(
                Lead.pain_point == pain_point.strip()
            ).first()
            
            if lead:
                lead.actual = actual
                db.commit()
                logger.info(f"Updated lead {lead.id} with actual result")
            
            return {
                "status": "learned",
                "message": "Model updated successfully"
            }
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Learning error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Learning failed: {str(e)}")

@app.get("/health")
def health_check():
    """Check if server is healthy"""
    try:
        # Try to initialize predictor if not already loaded
        model = get_predictor()
        return {
            "status": "healthy",
            "predictor_loaded": model is not None,
            "database": "connected"
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }
