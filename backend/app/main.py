from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers.bank_details import router as bank_details_router
from app.routers.students import router as students_router

API_PREFIX = "/api/v1"

app = FastAPI(
    title="СОПК — студенты и банковские реквизиты",
    version="1.0.0",
    description="REST API для формы: студент (`students`) и реквизиты (`bank_details`). "
    "Префикс всех ручек: `/api/v1`. Документация: `/docs` и `/redoc`.",
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


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
