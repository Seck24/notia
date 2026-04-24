from supabase import create_client
from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY

_client = None


def get_db():
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _client
