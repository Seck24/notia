from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from slugify import slugify
import uuid
import secrets
import string
import logging
import httpx
from app.config import SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY
from app.database import get_db
from app.middleware.auth import get_current_user
from app.middleware.permissions import require_role
from supabase import create_client

router = APIRouter(prefix="/auth", tags=["auth"])
_logger = logging.getLogger("auth")


def _get_auth_client():
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def _get_admin_client():
    """Client with service_role key for admin operations (create users)."""
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def _generate_temp_password(length=12):
    chars = string.ascii_letters + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))


class RegisterRequest(BaseModel):
    email: str
    password: str
    nom_cabinet: str
    ville: str = "Abidjan"


class LoginRequest(BaseModel):
    email: str
    password: str


class InviteRequest(BaseModel):
    email: str
    nom: str
    prenom: str = ""
    role: str = "collaborateur"  # collaborateur | limite


class ChangePasswordRequest(BaseModel):
    new_password: str


class UpdateUserRoleRequest(BaseModel):
    role: str


@router.post("/register")
async def register(body: RegisterRequest):
    auth_client = _get_auth_client()

    try:
        auth_res = auth_client.auth.sign_up({"email": body.email, "password": body.password})
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur inscription: {e}")

    user = auth_res.user
    if not user:
        raise HTTPException(status_code=400, detail="Inscription échouée. Email déjà utilisé ?")

    cabinet_id = slugify(body.nom_cabinet, max_length=20) + "-" + uuid.uuid4().hex[:8]

    db = get_db()

    db.table("cabinets").insert({
        "id": cabinet_id,
        "nom": body.nom_cabinet,
        "email_principal": body.email,
        "ville": body.ville,
    }).execute()

    db.table("config_cabinet").insert({"cabinet_id": cabinet_id}).execute()

    db.table("abonnements").insert({
        "cabinet_id": cabinet_id,
        "plan": "starter",
        "prix_mensuel": 0,
        "statut": "essai",
    }).execute()

    # First user = admin
    db.table("utilisateurs").insert({
        "cabinet_id": cabinet_id,
        "auth_id": user.id,
        "email": body.email,
        "nom": body.nom_cabinet,
        "role": "admin",
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

    db = get_db()
    user = db.table("utilisateurs").select("*, cabinets(nom, ville, logo_url)").eq("auth_id", auth_res.user.id).maybe_single().execute()

    if not user.data:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    # Check if account is active
    if not user.data.get("actif", True):
        raise HTTPException(status_code=403, detail="Compte désactivé. Contactez votre notaire.")

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


# ── User management (admin only) ──

@router.get("/utilisateurs")
async def list_utilisateurs(user: dict = Depends(require_role("admin"))):
    """List all users in the cabinet (admin only)."""
    db = get_db()
    users = db.table("utilisateurs").select("id, nom, prenom, email, role, actif, created_at").eq("cabinet_id", user["cabinet_id"]).order("created_at").execute()
    return {"utilisateurs": users.data}


@router.post("/utilisateurs/inviter")
async def inviter_utilisateur(body: InviteRequest, user: dict = Depends(require_role("admin"))):
    """Invite a new user to the cabinet (admin only)."""
    if body.role not in ("collaborateur", "limite"):
        raise HTTPException(status_code=400, detail="Rôle invalide. Choix : collaborateur, limite")

    db = get_db()
    cabinet_id = user["cabinet_id"]

    # Check email not already used in this cabinet
    existing = db.table("utilisateurs").select("id").eq("cabinet_id", cabinet_id).eq("email", body.email).maybe_single().execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Un utilisateur avec cet email existe déjà")

    # Generate temp password
    temp_password = _generate_temp_password()

    # Create Supabase Auth user via admin API
    admin_client = _get_admin_client()
    try:
        auth_res = admin_client.auth.admin.create_user({
            "email": body.email,
            "password": temp_password,
            "email_confirm": True,
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur création compte: {e}")

    if not auth_res.user:
        raise HTTPException(status_code=400, detail="Création compte échouée")

    # Create utilisateur row
    full_name = f"{body.prenom} {body.nom}".strip() if body.prenom else body.nom
    db.table("utilisateurs").insert({
        "cabinet_id": cabinet_id,
        "auth_id": auth_res.user.id,
        "email": body.email,
        "nom": body.nom,
        "prenom": body.prenom,
        "role": body.role,
        "first_login": True,
    }).execute()

    # Get cabinet info for the email
    cabinet = db.table("cabinets").select("nom").eq("id", cabinet_id).maybe_single().execute()
    cabinet_nom = cabinet.data["nom"] if cabinet.data else "l'étude"
    notaire_nom = f"{user.get('prenom', '')} {user.get('nom', '')}".strip() or "Le notaire"

    # Send invitation email via Supabase edge function or direct SMTP
    # For now, return the temp password so admin can share it
    _logger.info("Invitation envoyée à %s (rôle: %s, cabinet: %s)", body.email, body.role, cabinet_id)

    return {
        "success": True,
        "message": f"Compte créé pour {full_name}",
        "email": body.email,
        "role": body.role,
        "temp_password": temp_password,
        "invitation_text": f"Bonjour {body.prenom or body.nom},\n\n{notaire_nom} vous invite à rejoindre l'étude {cabinet_nom} sur Notia.\n\nVos accès :\nEmail : {body.email}\nMot de passe temporaire : {temp_password}\n\nConnectez-vous sur :\nhttps://notia.preo-ia.info\n\nChangez votre mot de passe à la première connexion.",
    }


@router.put("/utilisateurs/{user_id}/role")
async def update_user_role(user_id: str, body: UpdateUserRoleRequest, user: dict = Depends(require_role("admin"))):
    """Update a user's role (admin only)."""
    if body.role not in ("admin", "collaborateur", "limite"):
        raise HTTPException(status_code=400, detail="Rôle invalide")

    db = get_db()
    result = db.table("utilisateurs").update({"role": body.role}).eq("id", user_id).eq("cabinet_id", user["cabinet_id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    return {"success": True, "user": result.data[0]}


@router.put("/utilisateurs/{user_id}/toggle-actif")
async def toggle_user_active(user_id: str, user: dict = Depends(require_role("admin"))):
    """Activate/deactivate a user (admin only). Cannot deactivate yourself."""
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Impossible de désactiver votre propre compte")

    db = get_db()
    target = db.table("utilisateurs").select("actif").eq("id", user_id).eq("cabinet_id", user["cabinet_id"]).maybe_single().execute()
    if not target.data:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    new_status = not target.data.get("actif", True)
    result = db.table("utilisateurs").update({"actif": new_status}).eq("id", user_id).execute()
    return {"success": True, "actif": new_status}


@router.post("/changer-mot-de-passe")
async def changer_mot_de_passe(body: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    """Change password. Clears first_login flag."""
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 8 caractères")

    admin_client = _get_admin_client()
    try:
        admin_client.auth.admin.update_user_by_id(user["auth_id"], {"password": body.new_password})
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur changement mot de passe: {e}")

    # Clear first_login flag
    db = get_db()
    db.table("utilisateurs").update({"first_login": False}).eq("id", user["id"]).execute()

    return {"success": True, "message": "Mot de passe modifié"}
