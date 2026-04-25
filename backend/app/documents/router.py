from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
import secrets
import logging
from datetime import datetime, timedelta, timezone
from app.middleware.auth import get_current_user, get_current_cabinet_id
from app.database import get_db

router = APIRouter(prefix="/dossiers/{dossier_id}", tags=["documents"])
_logger = logging.getLogger("documents")


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


@router.post("/documents/{nom_document}/marquer-recu")
async def marquer_recu(dossier_id: str, nom_document: str, user: dict = Depends(get_current_user)):
    """Marquer un document comme reçu (apporté en main propre, sans fichier)."""
    cabinet_id = user["cabinet_id"]
    db = get_db()
    result = db.table("documents_dossier").update({
        "statut": "recu",
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }).eq("dossier_id", dossier_id).eq("cabinet_id", cabinet_id).eq("nom_document", nom_document).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Document non trouvé")
    return {"success": True, "document": result.data[0]}


@router.post("/documents/{nom_document}/rejeter")
async def rejeter_document(dossier_id: str, nom_document: str, user: dict = Depends(get_current_user)):
    """Rejeter un document."""
    cabinet_id = user["cabinet_id"]
    db = get_db()
    result = db.table("documents_dossier").update({
        "statut": "rejete",
    }).eq("dossier_id", dossier_id).eq("cabinet_id", cabinet_id).eq("nom_document", nom_document).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Document non trouvé")
    return {"success": True, "document": result.data[0]}


@router.post("/documents/upload")
async def upload_document_clerc(
    dossier_id: str,
    nom_document: str = Form(...),
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Upload d'un document par le clerc directement depuis la checklist."""
    cabinet_id = user["cabinet_id"]
    db = get_db()

    dossier = db.table("dossiers").select("id").eq("id", dossier_id).eq("cabinet_id", cabinet_id).maybe_single().execute()
    if not dossier.data:
        raise HTTPException(status_code=404, detail="Dossier non trouvé")

    annee = datetime.now().year
    ext = file.filename.split(".")[-1] if file.filename else "jpg"
    path = f"{cabinet_id}/dossiers/{annee}/{dossier_id}/originaux/{nom_document}.{ext}"
    content = await file.read()

    try:
        db.storage.from_("documents-cabinets").upload(path, content, {"content-type": file.content_type or "image/jpeg"})
    except Exception as e:
        if "already exists" in str(e).lower() or "Duplicate" in str(e):
            db.storage.from_("documents-cabinets").update(path, content, {"content-type": file.content_type or "image/jpeg"})
        else:
            raise HTTPException(status_code=500, detail=f"Erreur upload: {e}")

    db.table("documents_dossier").update({
        "statut": "recu",
        "fichier_path": path,
        "fichier_taille": len(content),
        "fichier_type": file.content_type,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }).eq("dossier_id", dossier_id).eq("cabinet_id", cabinet_id).eq("nom_document", nom_document).execute()

    # Claude Vision extraction
    extraction = None
    if file.content_type and (file.content_type.startswith("image/") or file.content_type == "application/pdf"):
        try:
            from app.services.claude_service import extraire_donnees_document
            extraction = await extraire_donnees_document(
                nom_document=nom_document, file_content=content,
                content_type=file.content_type, dossier_id=dossier_id, cabinet_id=cabinet_id,
            )
        except Exception as e:
            _logger.warning("Extraction Claude Vision échouée pour %s: %s", nom_document, e)

    return {"success": True, "nom_document": nom_document, "path": path, "extraction": extraction}


@router.post("/documents/{nom_document}/apercu")
async def get_document_url(dossier_id: str, nom_document: str, user: dict = Depends(get_current_user)):
    """Génère une URL signée temporaire pour aperçu du document."""
    cabinet_id = user["cabinet_id"]
    db = get_db()
    doc = db.table("documents_dossier").select("fichier_path").eq("dossier_id", dossier_id).eq("cabinet_id", cabinet_id).eq("nom_document", nom_document).maybe_single().execute()
    if not doc.data or not doc.data.get("fichier_path"):
        raise HTTPException(status_code=404, detail="Fichier non trouvé")
    try:
        result = db.storage.from_("documents-cabinets").create_signed_url(doc.data["fichier_path"], 3600)
        return {"url": result["signedURL"], "nom_document": nom_document}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur aperçu: {e}")


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
