import os
from typing import Optional

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError(
        "Supabase credentials are missing in the .env file "
        "(required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)"
    )

# Service role client for admin operations (bypasses RLS)
db: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Anon client respects RLS policies
anon_db: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY) if SUPABASE_ANON_KEY else db


def get_db_with_token(token: Optional[str] = None) -> Client:
    """Get a Supabase client with optional user token for RLS enforcement"""
    if token and SUPABASE_ANON_KEY:
        client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        client.postgrest.auth(token)
        return client
    return db
