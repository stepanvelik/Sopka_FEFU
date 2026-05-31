from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.startup_db import apply_startup_schema_patches
from app.routers.bank_details import router as bank_details_router
from app.routers.events import router as events_router
from app.routers.event_types import router as event_types_router
from app.routers.students import router as students_router
from app.routers.event_participation import router as event_participation_router
from app.routers.reports import router as reports_router


API_PREFIX = "/api/v1"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await apply_startup_schema_patches()
    yield


app = FastAPI(
    title="СОПК — студенты и банковские реквизиты",
    version="1.0.0",
    description="REST API для формы: студент (`students`) и реквизиты (`bank_details`). "
    "Префикс всех ручек: `/api/v1`. Документация: `/docs` и `/redoc`.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(students_router, prefix=API_PREFIX)
app.include_router(bank_details_router, prefix=API_PREFIX)
app.include_router(events_router, prefix=API_PREFIX)
app.include_router(event_types_router, prefix=API_PREFIX)
app.include_router(event_participation_router, prefix=API_PREFIX)
app.include_router(reports_router, prefix=API_PREFIX)

@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
