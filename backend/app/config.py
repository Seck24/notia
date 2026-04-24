import os

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://rbujxzyvsftvzyxfifke.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
WORD_SERVICE_URL = os.getenv("WORD_SERVICE_URL", "http://161.97.181.171:8001/generate-word")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "https://notia.preo-ia.info,http://localhost:5173").split(",")
