from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.middleware.auth import get_current_cabinet_id
from app.database import get_db

router = APIRouter(prefix="/dossiers/{dossier_id}/parties", tags=["parties"])


class PartieCreate(BaseModel):
    role: str
    type_partie: str = "personne_physique"
    nom: Optional[str] = None
    prenom: Optional[str] = None
    date_naissance: Optional[str] = None
    lieu_naissance: Optional[str] = None
    nationalite: str = "Ivoirienne"
    adresse: Optional[str] = None
    telephone: Optional[str] = None
    situation_matrimoniale: Optional[str] = None
    regime_matrimonial: Optional[str] = None
    conjoint_nom: Optional[str] = None
    conjoint_prenom: Optional[str] = None
    raison_sociale: Optional[str] = None
    forme_juridique: Optional[str] = None
    numero_rccm: Optional[str] = None
    gerant_nom: Optional[str] = None
    gerant_prenom: Optional[str] = None
    type_piece: Optional[str] = None
    numero_piece: Optional[str] = None
    date_expiration_piece: Optional[str] = None
    ordre: int = 1


class PartieUpdate(PartieCreate):
    role: Optional[str] = None


@router.post("")
async def add_partie(dossier_id: str, body: PartieCreate, cabinet_id: str = Depends(get_current_cabinet_id)):
    db = get_db()
    # Verify dossier belongs to cabinet
    dossier = db.table("dossiers").select("id").eq("id", dossier_id).eq("cabinet_id", cabinet_id).maybe_single().execute()
    if not dossier.data:
        raise HTTPException(status_code=404, detail="Dossier non trouvé")

    data = body.model_dump()
    data["dossier_id"] = dossier_id
    data["cabinet_id"] = cabinet_id
    result = db.table("parties").insert(data).execute()
    return {"success": True, "partie": result.data[0]}


@router.put("/{partie_id}")
async def update_partie(dossier_id: str, partie_id: str, body: PartieUpdate, cabinet_id: str = Depends(get_current_cabinet_id)):
    db = get_db()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Aucune modification")
    result = db.table("parties").update(updates).eq("id", partie_id).eq("dossier_id", dossier_id).eq("cabinet_id", cabinet_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Partie non trouvée")
    return {"success": True, "partie": result.data[0]}


@router.delete("/{partie_id}")
async def delete_partie(dossier_id: str, partie_id: str, cabinet_id: str = Depends(get_current_cabinet_id)):
    db = get_db()
    result = db.table("parties").delete().eq("id", partie_id).eq("dossier_id", dossier_id).eq("cabinet_id", cabinet_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Partie non trouvée")
    return {"success": True}
