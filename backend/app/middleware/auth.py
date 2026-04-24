from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.config import SUPABASE_JWT_SECRET, SUPABASE_URL
from app.database import get_db

security = HTTPBearer()


def verify_supabase_jwt(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except JWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Token invalide: {e}")


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_supabase_jwt(credentials.credentials)
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
