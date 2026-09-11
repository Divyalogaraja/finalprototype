"""
Vercel ASGI entrypoint.

Re-exports the existing FastAPI instance from backend/main.py.
Does not add, remove, or wrap any application routes.
"""
import os
import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parent / "backend"
_backend_str = str(_BACKEND)
if _backend_str not in sys.path:
    sys.path.insert(0, _backend_str)

# Vercel’s function filesystem is read-only except /tmp. Point SQLite there
# before backend.main imports store and calls init_db(). Local runs unchanged.
if os.environ.get("VERCEL"):
    import store as _store
    _store.DB_PATH = os.environ.get("RTX_DB_PATH", "/tmp/rtx.db")

from main import app  # noqa: E402

__all__ = ["app"]
