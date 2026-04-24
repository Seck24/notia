from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import secrets
from datetime import datetime, timedelta, timezone
from app.middleware.auth import get_current_user, get_current_cabinet_id
from app.database import get_db

router = APIRouter(prefix="/dossiers/{dossier_id}", tags=["documents"])


@router.get("/documents")
async def list_documents(dossier_id: str, cabinet_id: str = Depends(get_current_cabinet_id)):
    db = get_db()
    dossier = db.table("dossiers").select("id").eq("id", dossier_id).eq("cabinet_id", cabinet_id).maybe_single().execute()
    if not dossier.data:
        raise HTTPException(status_code=404, detail="Dossier non trouvé")

    docs = db.table("documents_dossier").select("*").eq("dossier_id", dossier_id).execute()
    total = len(docs.data)
    recus = sum(1 for d in docs.data if d["statut"] in ("recu", "valide"))
    return {"documents": docs.data, "total": total, "recus": recus, "progression": round(recus / total * 100) if total else 0}


@router.post("/documents/{nom_document}/valider")
async def valider_document(dossier_id: str, nom_document: str, user: dict = Depends(get_current_user)):
    cabinet_id = user["cabinet_id"]
    db = get_db()
    result = db.table("documents_dossier").update({
        "statut": "valide",
        "valide_par": user["id"],
    }).eq("dossier_id", dossier_id).eq("cabinet_id", cabinet_id).eq("nom_document", nom_document).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Document non trouvé")
    return {"success": True, "document": result.data[0]}


@router.post("/upload-link")
async def generate_upload_link(dossier_id: str, user: dict = Depends(get_current_user)):
    cabinet_id = user["cabinet_id"]
    db = get_db()

    dossier = db.table("dossiers").select("id").eq("id", dossier_id).eq("cabinet_id", cabinet_id).maybe_single().execute()
    if not dossier.data:
        raise HTTPException(status_code=404, detail="Dossier non trouvé")

    # Get pending documents
    docs = db.table("documents_dossier").select("nom_document").eq("dossier_id", dossier_id).eq("statut", "manquant").execute()
    docs_attendus = [d["nom_document"] for d in docs.data]

    if not docs_attendus:
        raise HTTPException(status_code=400, detail="Aucun document manquant")

    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=72)

    db.table("upload_tokens").insert({
        "token": token,
        "dossier_id": dossier_id,
        "cabinet_id": cabinet_id,
        "documents_attendus": docs_attendus,
        "expires_at": expires.isoformat(),
        "created_by": user["id"],
    }).execute()

    return {
        "success": True,
        "token": token,
        "url": f"/upload/{token}",
        "expires_at": expires.isoformat(),
        "documents_attendus": docs_attendus,
    }
