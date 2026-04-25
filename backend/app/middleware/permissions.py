"""
Système de permissions par rôle pour NotIA.
Rôles : admin (notaire), collaborateur (clerc principal), limite (clerc junior/secrétaire)
"""

from fastapi import Depends, HTTPException
from app.middleware.auth import get_current_user

PERMISSIONS = {
    'admin': [
        'voir_tous_dossiers',
        'voir_stats_cabinet',
        'creer_dossier',
        'generer_acte',
        'valider_acte',
        'gerer_utilisateurs',
        'configurer_cabinet',
        'voir_tous_clients',
    ],
    'collaborateur': [
        'voir_tous_dossiers',
        'creer_dossier',
        'generer_acte',
        'voir_tous_clients',
    ],
    'limite': [
        'voir_ses_dossiers',
        'creer_dossier',
        'uploader_documents',
        'voir_tous_clients',
    ],
}


def has_permission(user_role: str, permission: str) -> bool:
    return permission in PERMISSIONS.get(user_role, [])


def require_permission(permission: str):
    """FastAPI dependency that checks if the current user has the required permission."""
    async def _check(user: dict = Depends(get_current_user)):
        role = user.get("role", "limite")
        if not has_permission(role, permission):
            raise HTTPException(status_code=403, detail=f"Permission refusée : {permission}")
        return user
    return _check


def require_role(*roles):
    """FastAPI dependency that checks if the current user has one of the required roles."""
    async def _check(user: dict = Depends(get_current_user)):
        role = user.get("role", "limite")
        if role not in roles:
            raise HTTPException(status_code=403, detail="Accès réservé")
        return user
    return _check
