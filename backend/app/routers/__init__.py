from app.routers.bank_details import router as bank_details_router
from app.routers.events import router as events_router
from app.routers.event_types import router as event_types_router
from app.routers.students import router as students_router
from app.routers.event_participation import (
    router as event_participation_router,
    root as participants_router,
)
from app.routers.reports import router as reports_router

__all__ = [
    "bank_details_router",
    "events_router",
    "event_types_router",
    "students_router",
    "event_participation_router",
    "participants_router",
    "reports_router",
]
