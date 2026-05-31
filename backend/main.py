from fastapi import FastAPI 
from fastapi.middleware.cors import CORSMiddleware 
app = FastAPI() 
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]) 
@app.get("/api/v1/events") 
def get_events(): return [{"event_id": 1, "event_name": "Тест", "start_date": "2024-12-01"}] 
