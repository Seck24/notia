from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from slugify import slugify
import uuid
from app.config import SUPABASE_URL, SUPABASE_ANON_KEY
from app.database import get_db
from app.middleware.auth import get_current_user
from supabase import create_client

router = APIRouter(prefix="/auth", tags=["auth"])


def _get_auth_client():
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


class RegisterRequest(BaseModel):
    email: str
    password: str
    nom_cabinet: str
    ville: str = "Abidjan"


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/register")
async def register(body: RegisterRequest):
    auth_client = _get_auth_client()

    # 1. Create Supabase Auth user
    try:
        auth_res = auth_client.auth.sign_up({"email": body.email, "password": body.password})
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur inscription: {e}")

    user = auth_res.user
    if not user:
        raise HTTPException(status_code=400, detail="Inscription échouée. Email déjà utilisé ?")

    # 2. Generate cabinet_id
    cabinet_id = slugify(body.nom_cabinet, max_length=20) + "-" + uuid.uuid4().hex[:8]

    db = get_db()

    # 3. Create cabinet
    db.table("cabinets").insert({
        "id": cabinet_id,
        "nom": body.nom_cabinet,
        "email_principal": body.email,
        "ville": body.ville,
    }).execute()

    # 4. Create config_cabinet
    db.table("config_cabinet").insert({"cabinet_id": cabinet_id}).execute()

    # 5. Create abonnement starter
    db.table("abonnements").insert({
        "cabinet_id": cabinet_id,
        "plan": "starter",
        "prix_mensuel": 0,
        "statut": "essai",
    }).execute()

    # 6. Create utilisateur (notaire role = admin of the cabinet)
    db.table("utilisateurs").insert({
        "cabinet_id": cabinet_id,
        "auth_id": user.id,
        "email": body.email,
        "nom": body.nom_cabinet,
        "role": "notaire",
    }).execute()

    return {
        "success": True,
        "cabinet_id": cabinet_id,
        "message": "Cabinet créé. Vérifiez votre email pour confirmer le compte.",
    }


@router.post("/login")
async def login(body: LoginRequest):
    auth_client = _get_auth_client()
    try:
        auth_res = auth_client.auth.sign_in_with_password({"email": body.email, "password": body.password})
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Identifiants incorrects: {e}")

    session = auth_res.session
    if not session:
        raise HTTPException(status_code=401, detail="Connexion échouée")

    # Get user info
    db = get_db()
    user = db.table("utilisateurs").select("*, cabinets(nom, ville, logo_url)").eq("auth_id", auth_res.user.id).maybe_single().execute()

    return {
        "success": True,
        "access_token": session.access_token,
        "refresh_token": session.refresh_token,
        "user": user.data,
    }


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    db = get_db()
    cabinet = db.table("cabinets").select("*").eq("id", user["cabinet_id"]).maybe_single().execute()
    config = db.table("config_cabinet").select("*").eq("cabinet_id", user["cabinet_id"]).maybe_single().execute()

    return {
        "user": user,
        "cabinet": cabinet.data,
        "config": config.data,
    }
