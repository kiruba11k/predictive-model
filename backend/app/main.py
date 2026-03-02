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
from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from app.database import SessionLocal, Lead
from app.model import Predictor
import pandas as pd
import asyncio
import uuid
import io
import time
import logging
from typing import Dict

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS for Frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global State
predictor = None
bulk_jobs: Dict[str, dict] = {}

def get_predictor():
    global predictor
    if predictor is None:
        logger.info("Loading ML Model...")
        predictor = Predictor()
    return predictor

async def run_bulk_inference(job_id: str, df: pd.DataFrame):
    """Background task: Processes rows one by one to avoid timeouts"""
    job = bulk_jobs[job_id]
    model = get_predictor()
    results = []
    
    try:
        for index, row in df.iterrows():
            # Get pain_point from any column variation
            pain_point = str(row.get('pain_point', row.get('Pain Point', ''))).strip()
            
            if not pain_point:
                res = {**row.to_dict(), "prediction": "Skipped", "probability": 0, "confidence": "N/A"}
            else:
                # Run prediction in a separate thread to keep the API responsive
                pred, prob = await asyncio.to_thread(model.predict, pain_point)
                
                res = {
                    **row.to_dict(),
                    "prediction": "Success" if pred == 1 else "Failure",
                    "probability": float(prob),
                    "confidence": "High" if prob > 0.8 else "Medium" if prob > 0.5 else "Low"
                }
            
            results.append(res)
            
            # Update Progress for Polling
            job["progress"] = int(((index + 1) / len(df)) * 100)
            job["processed"] = index + 1
            
            # Prevent CPU lockout on Render Free Tier
            if index % 5 == 0:
                await asyncio.sleep(0.01)

        job["status"] = "completed"
        job["results"] = results
        logger.info(f"Bulk Job {job_id} Completed.")

    except Exception as e:
        logger.error(f"Job {job_id} Failed: {str(e)}")
        job["status"] = "failed"
        job["error"] = str(e)

@app.post("/upload-bulk")
async def upload_bulk(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    try:
        content = await file.read()
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))

        # Validate Column
        if not any(col.lower() == 'pain_point' for col in df.columns):
            # Try to rename if it's close
            df.columns = [c.lower().replace(' ', '_') for c in df.columns]
            if 'pain_point' not in df.columns:
                raise HTTPException(status_code=400, detail="File must have a 'pain_point' column.")

        job_id = str(uuid.uuid4())
        bulk_jobs[job_id] = {
            "status": "processing",
            "progress": 0,
            "total": len(df),
            "processed": 0,
            "results": None,
            "created_at": time.time()
        }

        background_tasks.add_task(run_bulk_inference, job_id, df)
        return {"jobId": job_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/bulk-status/{job_id}")
async def get_status(job_id: str):
    job = bulk_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job expired or not found.")
    
    # Return minimal data if still processing to save bandwidth
    if job["status"] == "processing":
        return {k: v for k, v in job.items() if k != "results"}
    return job

@app.on_event("startup")
async def schedule_cleanup():
    """Removes old jobs from memory every 30 minutes"""
    async def cleanup():
        while True:
            await asyncio.sleep(1800) # 30 mins
            now = time.time()
            to_delete = [jid for jid, j in bulk_jobs.items() if now - j["created_at"] > 3600]
            for jid in to_delete:
                del bulk_jobs[jid]
                logger.info(f"Cleaned up Job {jid}")
    asyncio.create_task(cleanup())

@app.get("/health")
def health():
    return {"status": "online", "memory_jobs": len(bulk_jobs)}
