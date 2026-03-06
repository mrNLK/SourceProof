from supabase import create_client, Client
from strata import config

supabase: Client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
