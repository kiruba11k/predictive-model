from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.database import SessionLocal, Lead
from app.model import Predictor
from pydantic import BaseModel
import time
import logging
import pandas as pd
import asyncio
import uuid
from typing import Dict
import io
import csv
from fastapi import UploadFile, File, Form
from fastapi.responses import StreamingResponse
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

# Add these imports at the top


# Add these to your existing main.py

# Store for bulk jobs
bulk_jobs: Dict[str, dict] = {}

def find_success_key(row: dict):
    keys = list(row.keys())

    # exact match
    exact = next(
        (key for key in keys if normalize_header(key) == 'success'),
        None
    )

    if exact:
        return exact

    # flexible match
    return next(
        (
            key for key in keys
            if 'success' in normalize_header(key)
            or 'actual' in normalize_header(key)
            or 'result' in normalize_header(key)
        ),
        None
    )


def normalize_actual_value(value):
    val = str(value).strip().lower()

    if val in ["yes", "y", "1", "true", "success", "won"]:
        return "Yes"

    if val in ["no", "n", "0", "false", "failure", "lost"]:
        return "No"

    raise ValueError(f"Invalid success value: {value}")
    
def normalize_header(value: str) -> str:
    return ''.join(ch for ch in str(value).lower() if ch.isalnum())


def find_pain_point_key(row: dict):
    keys = list(row.keys())

    exact = next((key for key in keys if normalize_header(key) == 'painpoint'), None)
    if exact:
        return exact

    return next(
        (
            key for key in keys
            if 'pain' in normalize_header(key) and 'point' in normalize_header(key)
        ),
        None
    )

@app.post("/upload-bulk")
async def upload_bulk(file: UploadFile = File(...)):
    """
    Upload CSV/Excel file for bulk prediction
    """
    try:
        # Generate job ID
        job_id = str(uuid.uuid4())
        
        # Read file content
        content = await file.read()
        
        # Determine file type and read data
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        elif file.filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")
        
        # Check if 'pain_point' column exists
        if 'pain_point' not in df.columns:
            raise HTTPException(status_code=400, detail="CSV must contain 'pain_point' column")
        
        # Store job info
        bulk_jobs[job_id] = {
            'status': 'processing',
            'progress': 0,
            'total': len(df),
            'data': df.to_dict('records'),
            'results': [],
            'summary': {
                'total': len(df),
                'successful': 0,
                'failed': 0
            }
        }
        
        # Start processing in background
        asyncio.create_task(process_bulk_job(job_id))
        
        return {
            'jobId': job_id,
            'status': 'processing',
            'total': len(df)
        }
        
    except Exception as e:
        logger.error(f"Bulk upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

async def process_bulk_job(job_id: str):
    """
    Process bulk prediction job
    """
    job = bulk_jobs[job_id]
    model = get_predictor()
    
    results = []
    successful = 0
    failed = 0
    skipped = 0
    
    for idx, row in enumerate(job['data']):
        try:
            pain_point_key = next(
                (key for key in row.keys() if str(key).strip().lower() == 'pain_point'),
                None
            )
            pain_point = row.get(pain_point_key, '') if pain_point_key else ''

            if pain_point and str(pain_point).strip():
                pred, prob = model.predict(str(pain_point).strip())
                
                result = {
                    'pain_point': pain_point,
                    'prediction': 'Success' if pred == 1 else 'Failure',
                    'probability': float(prob),
                    'success_probability': float(prob) if pred == 1 else 1 - float(prob)
                }
                
                if pred == 1:
                    successful += 1
                else:
                    failed += 1
                    
                results.append(result)
            else:
                results.append({
                    'pain_point': pain_point,
                    'prediction': 'Skipped',
                    'probability': 0,
                    'success_probability': 0,
                    'note': 'Empty pain point - skipped'
                })
                skipped += 1
                
                # Save to database (optional, can be commented out for performance)
                # db = SessionLocal()
                # try:
                #     lead = Lead(
                #         pain_point=str(pain_point).strip(),
                #         prediction=result['prediction'],
                #         probability=float(prob)
                #     )
                #     db.add(lead)
                #     db.commit()
                # finally:
                #     db.close()
            
        except Exception as e:
            logger.error(f"Error processing row {idx}: {str(e)}")
            results.append({
                'pain_point': row.get('pain_point', ''),
                'prediction': 'Error',
                'probability': 0,
                'success_probability': 0,
                'error': str(e)
            })
            failed += 1
        
        # Update progress
        job['progress'] = int(((idx + 1) / job['total']) * 100)
        job['results'] = results
        job['summary']['successful'] = successful
        job['summary']['failed'] = failed
        job['summary']['skipped'] = skipped
        
        # Small delay to prevent overwhelming
        await asyncio.sleep(0.01)
    
    job['status'] = 'completed'
    job['results'] = results
    job['summary'] = {
        'total': job['total'],
        'successful': successful,
        'failed': failed,
        'skipped': skipped
    }

@app.get("/bulk-status/{job_id}")
async def get_bulk_status(job_id: str):
    """
    Get status of bulk processing job
    """
    if job_id not in bulk_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = bulk_jobs[job_id]
    
    if job['status'] == 'completed':
        return {
            'status': 'completed',
            'progress': 100,
            'results': job
        }
    elif job['status'] == 'failed':
        return {
            'status': 'failed',
            'error': job.get('error', 'Processing failed')
        }
    else:
        return {
            'status': 'processing',
            'progress': job['progress'],
            'total': job['total'],
            'processed': len(job['results'])
        }

@app.get("/bulk-results/{job_id}")
async def get_bulk_results(job_id: str):
    """
    Download bulk results as CSV
    """
    if job_id not in bulk_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = bulk_jobs[job_id]
    
    if job['status'] != 'completed':
        raise HTTPException(status_code=400, detail="Job not completed")
    
    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow(['Pain Point', 'Prediction', 'Probability', 'Success Probability'])
    
    # Write data
    for result in job['results']:
        writer.writerow([
            result['pain_point'],
            result['prediction'],
            f"{result['probability']:.4f}",
            f"{result['success_probability']:.4f}"
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=bulk-results-{job_id}.csv"}
    )
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


@app.post("/learn-upload")
async def learn_upload(file: UploadFile = File(...)):
    """
    Learn from uploaded CSV/Excel containing pain_point and Success columns.
    """
    try:
        content = await file.read()

        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        elif file.filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")

        if df.empty:
            raise HTTPException(status_code=400, detail="Uploaded file has no rows")

        records = df.to_dict('records')
        first_row = records[0]
        pain_point_key = find_pain_point_key(first_row)
        success_key = find_success_key(first_row)

        if not pain_point_key or not success_key:
            raise HTTPException(
                status_code=400,
                detail="File must contain pain_point and Success columns"
            )

        model = get_predictor()

        learning_items = []
        learned = 0
        skipped = 0
        errors = []

        for idx, row in enumerate(records):
            try:
                pain_point = str(row.get(pain_point_key, '') or '').strip()
                actual_raw = row.get(success_key, '')

                if not pain_point:
                    skipped += 1
                    continue

                actual = normalize_actual_value(actual_raw)
                learning_items.append((pain_point, actual))
                learned += 1
            except Exception as row_error:
                skipped += 1
                if len(errors) < 20:
                    errors.append({
                        'row': idx + 2,
                        'error': str(row_error)
                    })

        if learning_items:
            model.learn_batch(learning_items)

        return {
            'status': 'completed',
            'total': len(records),
            'learned': learned,
            'skipped': skipped,
            'pain_point_column': pain_point_key,
            'success_column': success_key,
            'errors': errors
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Learn upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Learn upload failed: {str(e)}")

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
