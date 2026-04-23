"""
Точка входа при запуске из корня репозитория:

    uvicorn main:app --reload

Добавляет каталог `backend` в PYTHONPATH, чтобы пакет `app` находился корректно.
"""
from __future__ import annotations

import sys
from pathlib import Path

_backend_dir = Path(__file__).resolve().parent / "backend"
_backend_str = str(_backend_dir)
if _backend_str not in sys.path:
    sys.path.insert(0, _backend_str)

from app.main import app

__all__ = ["app"]
