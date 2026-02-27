from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from app.database import SessionLocal, Lead
from app.model import Predictor
from pydantic import BaseModel
import time
import logging
import pandas as pd
import asyncio
import uuid
from typing import Dict, Optional
import io
import csv
from fastapi.responses import StreamingResponse

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize predictor
predictor = None
bulk_jobs: Dict[str, dict] = {}

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
        
        model = get_predictor()
        pred, prob = model.predict(pain_point.strip())
        
        logger.info(f"Prediction completed in {time.time() - start_time:.2f}s")
        
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
        
        model = get_predictor()
        model.learn(pain_point.strip(), actual)
        
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
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload CSV or Excel file.")
        
        # Check if 'pain_point' column exists
        if 'pain_point' not in df.columns:
            raise HTTPException(status_code=400, detail="File must contain 'pain_point' column")
        
        # Convert to records and identify empty pain_points
        records = df.to_dict('records')
        valid_count = sum(1 for r in records if r.get('pain_point') and str(r.get('pain_point')).strip())
        skipped_count = len(records) - valid_count
        
        logger.info(f"Total records: {len(records)}, Valid: {valid_count}, Skipped (empty): {skipped_count}")
        
        # Store job info with initialized results array
        bulk_jobs[job_id] = {
            'job_id': job_id,
            'status': 'processing',
            'progress': 0,
            'total': len(records),
            'valid_count': valid_count,
            'skipped_count': skipped_count,
            'processed': 0,
            'records': records,
            'results': [None] * len(records),  # Initialize with None to maintain order
            'summary': {
                'total': len(records),
                'successful': 0,
                'failed': 0,
                'skipped': skipped_count,
                'successRate': 0
            },
            'error': None,
            'created_at': time.time()
        }
        
        # Start processing in background
        asyncio.create_task(process_bulk_job(job_id))
        
        return {
            'jobId': job_id,
            'status': 'processing',
            'total': len(records),
            'valid': valid_count,
            'skipped': skipped_count,
            'message': f'Processing {valid_count} records with pain points. Skipped {skipped_count} empty rows.'
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
    
    successful = 0
    failed = 0
    
    for idx, record in enumerate(job['records']):
        try:
            pain_point = record.get('pain_point', '')
            
            # Handle empty pain_points
            if not pain_point or not str(pain_point).strip():
                job['results'][idx] = {
                    'pain_point': pain_point,
                    'prediction': 'Skipped',
                    'probability': 0.0,
                    'success_probability': 0.0,
                    'confidence': 'N/A',
                    'note': 'Empty pain point - skipped'
                }
                # Update progress
                job['processed'] = idx + 1
                job['progress'] = int(((idx + 1) / job['total']) * 100)
                continue
            
            # Make prediction for valid pain points
            pred, prob = model.predict(str(pain_point).strip())
            
            prediction = "Success" if pred == 1 else "Failure"
            if pred == 1:
                successful += 1
            else:
                failed += 1
            
            # Determine confidence level
            if prob > 0.8:
                confidence = "High"
            elif prob > 0.5:
                confidence = "Medium"
            else:
                confidence = "Low"
            
            result = {
                'pain_point': pain_point,
                'prediction': prediction,
                'probability': float(prob),
                'success_probability': float(prob) if pred == 1 else 1 - float(prob),
                'confidence': confidence
            }
            
            job['results'][idx] = result
            
            # Save to database (optional - can be commented out for performance)
            try:
                db = SessionLocal()
                lead = Lead(
                    pain_point=str(pain_point).strip(),
                    prediction=prediction,
                    probability=float(prob)
                )
                db.add(lead)
                db.commit()
                db.close()
            except Exception as db_err:
                logger.error(f"Database error for row {idx}: {str(db_err)}")
            
        except Exception as e:
            logger.error(f"Error processing row {idx}: {str(e)}")
            job['results'][idx] = {
                'pain_point': record.get('pain_point', ''),
                'prediction': 'Error',
                'probability': 0.0,
                'success_probability': 0.0,
                'confidence': 'N/A',
                'error': str(e)
            }
            failed += 1
        
        # Update progress after each row
        job['processed'] = idx + 1
        job['progress'] = int(((idx + 1) / job['total']) * 100)
        job['summary']['successful'] = successful
        job['summary']['failed'] = failed
        job['summary']['successRate'] = (successful / (successful + failed) * 100) if (successful + failed) > 0 else 0
        
        # Small delay to prevent overwhelming
        await asyncio.sleep(0.01)
    
    # Job completed - ensure all stats are final
    job['status'] = 'completed'
    job['progress'] = 100
    job['summary']['total'] = job['total']
    job['summary']['successful'] = successful
    job['summary']['failed'] = failed
    job['summary']['skipped'] = job['total'] - (successful + failed)
    job['summary']['successRate'] = (successful / (successful + failed) * 100) if (successful + failed) > 0 else 0
    
    logger.info(f"Job {job_id} completed. Total: {job['total']}, Successful: {successful}, Failed: {failed}, Skipped: {job['summary']['skipped']}")

@app.get("/bulk-status/{job_id}")
async def get_bulk_status(job_id: str):
    """
    Get status of bulk processing job
    """
    if job_id not in bulk_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = bulk_jobs[job_id]
    
    if job['status'] == 'completed':
        # Count actual processed results (non-None)
        processed_count = sum(1 for r in job['results'] if r is not None)
        
        return {
            'status': 'completed',
            'progress': 100,
            'total': job['total'],
            'processed': processed_count,
            'results': {
                'predictions': job['results'],
                'summary': job['summary']
            }
        }
    elif job['status'] == 'failed':
        return {
            'status': 'failed',
            'error': job.get('error', 'Processing failed'),
            'progress': job['progress']
        }
    else:
        # Count processed results so far
        processed_count = sum(1 for r in job['results'] if r is not None)
        
        return {
            'status': 'processing',
            'progress': job['progress'],
            'total': job['total'],
            'processed': processed_count
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
        raise HTTPException(status_code=400, detail="Job not completed yet")
    
    # Create CSV with all rows
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header with more columns
    writer.writerow(['Row', 'Pain Point', 'Prediction', 'Probability', 'Success Probability', 'Confidence', 'Note'])
    
    # Write data for all rows
    for idx, result in enumerate(job['results']):
        row_num = idx + 1
        if result is None:
            # This shouldn't happen if job is completed, but just in case
            writer.writerow([
                row_num,
                job['records'][idx].get('pain_point', ''),
                'Pending',
                '0%',
                '0%',
                'N/A',
                'Processing incomplete'
            ])
        else:
            writer.writerow([
                row_num,
                result['pain_point'],
                result['prediction'],
                f"{result['probability']*100:.2f}%" if result['probability'] else '0%',
                f"{result['success_probability']*100:.2f}%" if result['success_probability'] else '0%',
                result.get('confidence', 'N/A'),
                result.get('note', result.get('error', ''))
            ])
    
    output.seek(0)
    
    filename = f"bulk-predictions-{time.strftime('%Y%m%d-%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.delete("/bulk-job/{job_id}")
async def delete_bulk_job(job_id: str):
    """
    Delete a bulk job to free up memory
    """
    if job_id in bulk_jobs:
        del bulk_jobs[job_id]
        logger.info(f"Deleted job {job_id}")
        return {'message': 'Job deleted successfully'}
    raise HTTPException(status_code=404, detail="Job not found")

@app.get("/bulk-jobs")
async def list_bulk_jobs():
    """
    List all active bulk jobs
    """
    jobs_list = []
    for job_id, job in bulk_jobs.items():
        jobs_list.append({
            'jobId': job_id,
            'status': job['status'],
            'progress': job['progress'],
            'total': job['total'],
            'created_at': job.get('created_at', 0)
        })
    return {'jobs': jobs_list}

# Clean up old jobs periodically
@app.on_event("startup")
async def startup_event():
    asyncio.create_task(cleanup_old_jobs())

async def cleanup_old_jobs():
    """
    Clean up jobs older than 1 hour every hour
    """
    while True:
        await asyncio.sleep(3600)  # 1 hour
        current_time = time.time()
        jobs_to_delete = []
        
        for job_id, job in bulk_jobs.items():
            # Delete jobs older than 1 hour (3600 seconds)
            if current_time - job.get('created_at', 0) > 3600:
                jobs_to_delete.append(job_id)
        
        for job_id in jobs_to_delete:
            del bulk_jobs[job_id]
            logger.info(f"Cleaned up old job: {job_id}")
