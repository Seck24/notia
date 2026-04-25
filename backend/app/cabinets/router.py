from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional
from app.middleware.auth import get_current_user, get_current_cabinet_id
from app.database import get_db

router = APIRouter(prefix="/cabinets", tags=["cabinets"])


class CabinetUpdate(BaseModel):
    nom: Optional[str] = None
    telephone: Optional[str] = None
    adresse: Optional[str] = None
    ville: Optional[str] = None


class ConfigUpdate(BaseModel):
    format_numero: Optional[str] = None
    compteur: Optional[int] = None
    types_actes: Optional[list[str]] = None
    statuts_custom: Optional[dict] = None
    bareme: Optional[dict] = None
    checklist_custom: Optional[dict] = None


@router.get("/{cabinet_id}")
async def get_cabinet(cabinet_id: str, current_cabinet: str = Depends(get_current_cabinet_id)):
    if cabinet_id != current_cabinet:
        raise HTTPException(status_code=403, detail="Accès refusé")
    db = get_db()
    cabinet = db.table("cabinets").select("*").eq("id", cabinet_id).maybe_single().execute()
    if not cabinet.data:
        raise HTTPException(status_code=404, detail="Cabinet non trouvé")
    return cabinet.data


@router.put("/{cabinet_id}")
async def update_cabinet(cabinet_id: str, body: CabinetUpdate, current_cabinet: str = Depends(get_current_cabinet_id)):
    if cabinet_id != current_cabinet:
        raise HTTPException(status_code=403, detail="Accès refusé")
    db = get_db()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Aucune modification")
    updates["updated_at"] = "now()"
    result = db.table("cabinets").update(updates).eq("id", cabinet_id).execute()
    return {"success": True, "cabinet": result.data[0] if result.data else None}


@router.get("/{cabinet_id}/config")
async def get_config(cabinet_id: str, current_cabinet: str = Depends(get_current_cabinet_id)):
    if cabinet_id != current_cabinet:
        raise HTTPException(status_code=403, detail="Accès refusé")
    db = get_db()
    config = db.table("config_cabinet").select("*").eq("cabinet_id", cabinet_id).maybe_single().execute()
    return config.data


@router.put("/{cabinet_id}/config")
async def update_config(cabinet_id: str, body: ConfigUpdate, current_cabinet: str = Depends(get_current_cabinet_id)):
    if cabinet_id != current_cabinet:
        raise HTTPException(status_code=403, detail="Accès refusé")
    db = get_db()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Aucune modification")
    result = db.table("config_cabinet").update(updates).eq("cabinet_id", cabinet_id).execute()
    return {"success": True, "config": result.data[0] if result.data else None}


@router.post("/{cabinet_id}/logo")
async def upload_logo(cabinet_id: str, file: UploadFile = File(...), current_cabinet: str = Depends(get_current_cabinet_id)):
    if cabinet_id != current_cabinet:
        raise HTTPException(status_code=403, detail="Accès refusé")
    db = get_db()
    ext = file.filename.split('.')[-1] if file.filename else 'png'
    path = f"logos/{cabinet_id}/logo.{ext}"
    content = await file.read()
    try:
        db.storage.from_("documents-cabinets").upload(path, content, {"content-type": file.content_type or "image/png"})
    except Exception as e:
        if "already exists" in str(e).lower() or "Duplicate" in str(e):
            db.storage.from_("documents-cabinets").update(path, content, {"content-type": file.content_type or "image/png"})
        else:
            raise HTTPException(status_code=500, detail=f"Erreur upload: {e}")
    # Generate signed URL (bucket is private)
    try:
        signed = db.storage.from_("documents-cabinets").create_signed_url(path, 60 * 60 * 24 * 365)  # 1 year
        logo_url = signed["signedURL"]
    except Exception:
        from app.config import SUPABASE_URL
        logo_url = f"{SUPABASE_URL}/storage/v1/object/public/documents-cabinets/{path}"
    db.table("cabinets").update({"logo_url": logo_url}).eq("id", cabinet_id).execute()
    return {"success": True, "logo_url": logo_url}


@router.post("/{cabinet_id}/parse-format")
async def parse_format_from_example(cabinet_id: str, body: dict, current_cabinet: str = Depends(get_current_cabinet_id)):
    """Parse un exemple de numéro pour en déduire le format."""
    if cabinet_id != current_cabinet:
        raise HTTPException(status_code=403, detail="Accès refusé")
    import re
    exemple = body.get("exemple", "").strip()
    if not exemple:
        raise HTTPException(status_code=400, detail="Exemple requis")

    # Detect year (4 digits that look like a year)
    format_str = exemple
    year_match = re.search(r'(20\d{2})', format_str)
    if year_match:
        format_str = format_str.replace(year_match.group(1), '{ANNEE}', 1)

    # Detect sequence (last group of digits)
    seq_match = re.search(r'(\d{2,6})(?!.*\d)', format_str)
    if seq_match:
        digits = len(seq_match.group(1))
        format_str = format_str[:seq_match.start(1)] + '{SEQ:0' + str(digits) + 'd}' + format_str[seq_match.end(1):]

    # Preview
    preview = format_str.replace('{ANNEE}', '2026').replace('{SEQ:04d}', '0001').replace('{SEQ:03d}', '001').replace('{SEQ:05d}', '00001').replace('{SEQ:06d}', '000001').replace('{SEQ:02d}', '01')

    return {"format": format_str, "preview": preview, "exemple_original": exemple}
