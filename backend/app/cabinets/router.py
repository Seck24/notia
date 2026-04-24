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
    path = f"logos/{cabinet_id}/logo.{file.filename.split('.')[-1]}"
    content = await file.read()
    db.storage.from_("documents-cabinets").upload(path, content, {"content-type": file.content_type})
    logo_url = f"{db.supabase_url}/storage/v1/object/public/documents-cabinets/{path}"
    db.table("cabinets").update({"logo_url": logo_url}).eq("id", cabinet_id).execute()
    return {"success": True, "logo_url": logo_url}
