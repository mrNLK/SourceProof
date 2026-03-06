import os
from dotenv import load_dotenv

load_dotenv()

EXA_API_KEY = os.getenv("EXA_API_KEY", "")
PARALLEL_API_KEY = os.getenv("PARALLEL_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "")
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
