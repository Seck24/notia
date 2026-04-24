from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx
from app.config import SUPABASE_URL, SUPABASE_ANON_KEY
from app.database import get_db

security = HTTPBearer()


async def verify_supabase_jwt(token: str) -> dict:
    """Verify JWT by calling Supabase auth endpoint."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON_KEY},
            timeout=10,
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide")
        user_data = resp.json()
        return {"sub": user_data.get("id"), "email": user_data.get("email")}


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = await verify_supabase_jwt(credentials.credentials)
    auth_id = payload.get("sub")
    if not auth_id:
        raise HTTPException(status_code=401, detail="Token sans identifiant")

    db = get_db()
    result = db.table("utilisateurs").select("*").eq("auth_id", auth_id).maybe_single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé. Complétez l'onboarding.")
    return result.data


async def get_current_cabinet_id(user: dict = Depends(get_current_user)) -> str:
    return user["cabinet_id"]
