from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class BankDetailsCreate(BaseModel):
    bank_name: str = Field(..., max_length=255)
    bik: str = Field(..., max_length=20)
    correspondent_account: str | None = Field(None, max_length=30)
    account_number: str = Field(..., max_length=30)
    is_active: bool = True


class BankDetailsUpdate(BaseModel):
    bank_name: str | None = Field(None, max_length=255)
    bik: str | None = Field(None, max_length=20)
    correspondent_account: str | None = Field(None, max_length=30)
    account_number: str | None = Field(None, max_length=30)
    is_active: bool | None = None


class BankDetailsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    bank_details_id: int
    student_id: int
    bank_name: str
    bik: str
    correspondent_account: str | None
    account_number: str
    is_active: bool
    created_at: datetime
