from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from app.middleware.auth import get_current_user, get_current_cabinet_id
from app.database import get_db

router = APIRouter(prefix="/clients", tags=["clients"])


class ClientCreate(BaseModel):
    type_client: str = "particulier"
    nom: Optional[str] = None
    prenom: Optional[str] = None
    telephone: Optional[str] = None
    email: Optional[str] = None
    adresse: Optional[str] = None
    date_naissance: Optional[str] = None
    nationalite: str = "Ivoirienne"
    situation_matrimoniale: Optional[str] = None
    regime_matrimonial: Optional[str] = None
    conjoint_nom: Optional[str] = None
    conjoint_prenom: Optional[str] = None
    type_piece: Optional[str] = None
    numero_piece: Optional[str] = None
    raison_sociale: Optional[str] = None
    forme_juridique: Optional[str] = None
    numero_rccm: Optional[str] = None
    siege_social: Optional[str] = None
    representant_nom: Optional[str] = None
    representant_prenom: Optional[str] = None
    notes: Optional[str] = None


class ClientUpdate(ClientCreate):
    type_client: Optional[str] = None
    nationalite: Optional[str] = None


@router.get("")
async def list_clients(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    cabinet_id: str = Depends(get_current_cabinet_id),
):
    db = get_db()
    offset = (page - 1) * limit
    result = db.table("clients").select("*", count="exact").eq("cabinet_id", cabinet_id).order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return {"clients": result.data, "total": result.count, "page": page}


@router.get("/search")
async def search_clients(
    q: str = Query(..., min_length=1),
    cabinet_id: str = Depends(get_current_cabinet_id),
):
    db = get_db()
    result = db.table("clients").select("*").eq("cabinet_id", cabinet_id).or_(
        f"nom.ilike.%{q}%,prenom.ilike.%{q}%,telephone.ilike.%{q}%,raison_sociale.ilike.%{q}%,email.ilike.%{q}%"
    ).limit(10).execute()
    return {"clients": result.data}


@router.post("")
async def create_client(body: ClientCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    data = body.model_dump()
    data["cabinet_id"] = user["cabinet_id"]
    result = db.table("clients").insert(data).execute()
    return {"success": True, "client": result.data[0]}


@router.get("/{client_id}")
async def get_client(client_id: str, cabinet_id: str = Depends(get_current_cabinet_id)):
    db = get_db()
    client = db.table("clients").select("*").eq("id", client_id).eq("cabinet_id", cabinet_id).maybe_single().execute()
    if not client.data:
        raise HTTPException(status_code=404, detail="Client non trouvé")

    dossiers = db.table("dossiers").select("id, numero_dossier, type_acte, statut, created_at").eq("client_id", client_id).eq("cabinet_id", cabinet_id).order("created_at", desc=True).execute()

    return {"client": client.data, "dossiers": dossiers.data}


@router.put("/{client_id}")
async def update_client(client_id: str, body: ClientUpdate, cabinet_id: str = Depends(get_current_cabinet_id)):
    db = get_db()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Aucune modification")
    updates["updated_at"] = "now()"
    result = db.table("clients").update(updates).eq("id", client_id).eq("cabinet_id", cabinet_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Client non trouvé")
    return {"success": True, "client": result.data[0]}
