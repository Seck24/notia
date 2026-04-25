from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from datetime import datetime, timezone
import re, unicodedata
from app.database import get_db
from app.services.activity_service import log_activity


def _slugify(text: str) -> str:
    """Convertir un nom en slug safe pour le storage (pas d'accents, pas d'espaces)."""
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')
    text = re.sub(r'[^\w\s.-]', '', text)
    text = re.sub(r'[\s]+', '_', text.strip())
    return text or 'document'

router = APIRouter(prefix="/upload", tags=["upload-public"])


def _validate_token(token: str):
    db = get_db()
    result = db.table("upload_tokens").select("*").eq("token", token).maybe_single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Lien invalide")

    data = result.data
    expires = datetime.fromisoformat(data["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires:
        raise HTTPException(status_code=410, detail="Ce lien a expiré")

    return data


@router.get("/{token}")
async def get_upload_info(token: str):
    data = _validate_token(token)
    db = get_db()

    docs = db.table("documents_dossier").select("nom_document, statut").eq("dossier_id", data["dossier_id"]).execute()
    cabinet = db.table("cabinets").select("nom, logo_url").eq("id", data["cabinet_id"]).maybe_single().execute()

    return {
        "valid": True,
        "cabinet": cabinet.data,
        "documents": docs.data,
        "documents_attendus": data["documents_attendus"],
    }


@router.post("/{token}/fichier")
async def upload_fichier(token: str, nom_document: str = Form(...), file: UploadFile = File(...)):
    import logging
    logger = logging.getLogger("upload")

    try:
        data = _validate_token(token)
        db = get_db()

        cabinet_id = data["cabinet_id"]
        dossier_id = data["dossier_id"]
        annee = datetime.now().year
        ext = file.filename.split(".")[-1] if file.filename else "jpg"
        safe_name = _slugify(nom_document)
        path = f"{cabinet_id}/dossiers/{annee}/{dossier_id}/originaux/{safe_name}.{ext}"

        content = await file.read()
        logger.info(f"Upload: {nom_document}, size={len(content)}, path={path}")

        # Upload to Supabase Storage
        try:
            db.storage.from_("documents-cabinets").upload(path, content, {"content-type": file.content_type or "image/jpeg"})
        except Exception as e:
            if "already exists" in str(e).lower() or "Duplicate" in str(e):
                db.storage.from_("documents-cabinets").update(path, content, {"content-type": file.content_type or "image/jpeg"})
            else:
                logger.error(f"Storage upload error: {e}")
                raise HTTPException(status_code=500, detail=f"Erreur upload: {e}")

        # Update document status
        db.table("documents_dossier").update({
            "statut": "recu",
            "fichier_path": path,
            "fichier_taille": len(content),
            "fichier_type": file.content_type,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
        }).eq("dossier_id", dossier_id).eq("cabinet_id", cabinet_id).eq("nom_document", nom_document).execute()

        try:
            log_activity(cabinet_id, dossier_id, "document_recu", f"Document '{nom_document}' reçu")
        except Exception:
            pass

        # Increment upload count
        try:
            db.table("upload_tokens").update({
                "nb_uploads": (data.get("nb_uploads") or 0) + 1,
            }).eq("token", token).execute()
        except Exception:
            pass

        return {"success": True, "nom_document": nom_document, "path": path}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")
