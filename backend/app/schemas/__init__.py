from app.schemas.bank_details import (
    BankDetailsCreate,
    BankDetailsRead,
    BankDetailsUpdate,
)
from app.schemas.event import EventCreate, EventRead, EventUpdate
from app.schemas.student import StudentCreate, StudentRead, StudentUpdate

__all__ = [
    "StudentCreate",
    "StudentRead",
    "StudentUpdate",
    "BankDetailsCreate",
    "BankDetailsRead",
    "BankDetailsUpdate",
    "EventCreate",
    "EventRead",
    "EventUpdate",
]
