from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.middleware.auth import get_current_user, get_current_cabinet_id
from app.database import get_db
from app.services.activity_service import log_activity

router = APIRouter(prefix="/dossiers", tags=["dossiers"])

STATUTS_VALIDES = [
    "reception_client", "analyse_interne", "attente_pieces",
    "demarches_admin", "redaction_projet",
    "observations_client", "signature_finale", "archive",
]


def generer_numero(cabinet_id: str, format_str: str, annee: int, seq: int) -> str:
    return (
        format_str
        .replace("{ANNEE}", str(annee))
        .replace("{SEQ:04d}", str(seq).zfill(4))
        .replace("{ID}", cabinet_id)
    )


class DossierCreate(BaseModel):
    type_acte: str
    client_id: Optional[str] = None
    notes_internes: Optional[str] = None
    infos_specifiques: Optional[dict] = None


class DossierUpdate(BaseModel):
    statut: Optional[str] = None
    assigne_a: Optional[str] = None
    notes_internes: Optional[str] = None
    infos_specifiques: Optional[dict] = None


@router.get("/dashboard-stats")
async def dashboard_stats(cabinet_id: str = Depends(get_current_cabinet_id)):
    db = get_db()
    all_dossiers = db.table("dossiers").select("id, statut, created_at, updated_at").eq("cabinet_id", cabinet_id).neq("statut", "archive").execute()
    dossiers = all_dossiers.data or []

    from datetime import datetime
    now = datetime.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0).isoformat()

    en_cours = sum(1 for d in dossiers if d["statut"] != "signature_finale")
    attente = sum(1 for d in dossiers if d["statut"] == "attente_pieces")
    redaction = sum(1 for d in dossiers if d["statut"] == "redaction_projet")
    finalises = sum(1 for d in dossiers if d["statut"] == "signature_finale" and d["created_at"] >= month_start)

    # Urgent: attente_pieces > 7 days
    urgents = []
    for d in dossiers:
        if d["statut"] == "attente_pieces":
            updated = datetime.fromisoformat(d["updated_at"].replace("Z", "+00:00").replace("+00:00", ""))
            days = (now - updated.replace(tzinfo=None)).days
            if days > 7:
                urgents.append({**d, "jours_attente": days})
    urgents.sort(key=lambda x: x["jours_attente"], reverse=True)

    # Recent activities
    activites = db.table("activites").select("*").eq("cabinet_id", cabinet_id).order("created_at", desc=True).limit(10).execute()

    return {
        "stats": {"en_cours": en_cours, "attente": attente, "redaction": redaction, "finalises": finalises},
        "urgents": urgents,
        "activites": activites.data or [],
    }


@router.get("")
async def list_dossiers(
    statut: Optional[str] = Query(None),
    type_acte: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    cabinet_id: str = Depends(get_current_cabinet_id),
):
    db = get_db()
    query = db.table("dossiers").select("*, utilisateurs!dossiers_assigne_a_fkey(nom, prenom)", count="exact").eq("cabinet_id", cabinet_id).neq("statut", "archive")
    if statut:
        query = query.eq("statut", statut)
    if type_acte:
        query = query.eq("type_acte", type_acte)
    offset = (page - 1) * limit
    result = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return {"dossiers": result.data, "total": result.count, "page": page}


@router.post("")
async def create_dossier(body: DossierCreate, user: dict = Depends(get_current_user)):
    cabinet_id = user["cabinet_id"]
    db = get_db()

    # Get config for numbering
    config = db.table("config_cabinet").select("format_numero, compteur").eq("cabinet_id", cabinet_id).maybe_single().execute()
    if not config.data:
        raise HTTPException(status_code=500, detail="Config cabinet manquante")

    annee = datetime.now().year
    new_seq = (config.data["compteur"] or 0) + 1
    numero = generer_numero(cabinet_id, config.data["format_numero"], annee, new_seq)

    # Increment counter
    db.table("config_cabinet").update({"compteur": new_seq}).eq("cabinet_id", cabinet_id).execute()

    # Create dossier
    dossier_data = {
        "cabinet_id": cabinet_id,
        "numero_dossier": numero,
        "type_acte": body.type_acte,
        "client_id": body.client_id,
        "notes_internes": body.notes_internes,
        "infos_specifiques": body.infos_specifiques or {},
        "created_by": user["id"],
    }
    result = db.table("dossiers").insert(dossier_data).execute()

    # Auto-create checklist from templates
    templates = db.table("checklist_templates").select("nom_document, obligatoire, ordre").or_(f"cabinet_id.eq.commun,cabinet_id.eq.{cabinet_id}").eq("type_acte", body.type_acte).order("ordre").execute()

    if templates.data:
        docs = [
            {
                "dossier_id": result.data[0]["id"],
                "cabinet_id": cabinet_id,
                "nom_document": t["nom_document"],
                "statut": "manquant",
            }
            for t in templates.data
        ]
        db.table("documents_dossier").insert(docs).execute()

    log_activity(cabinet_id, result.data[0]["id"], "dossier_cree", f"Dossier {numero} ouvert ({body.type_acte.replace('_',' ')})", user["id"])
    return {"success": True, "dossier": result.data[0]}


@router.get("/{dossier_id}")
async def get_dossier(dossier_id: str, cabinet_id: str = Depends(get_current_cabinet_id)):
    db = get_db()
    dossier = db.table("dossiers").select("*").eq("id", dossier_id).eq("cabinet_id", cabinet_id).maybe_single().execute()
    if not dossier.data:
        raise HTTPException(status_code=404, detail="Dossier non trouvé")

    parties = db.table("parties").select("*").eq("dossier_id", dossier_id).order("ordre").execute()
    documents = db.table("documents_dossier").select("*").eq("dossier_id", dossier_id).execute()
    actes = db.table("actes_generes").select("*").eq("dossier_id", dossier_id).order("version", desc=True).execute()

    return {
        "dossier": dossier.data,
        "parties": parties.data,
        "documents": documents.data,
        "actes": actes.data,
    }


@router.put("/{dossier_id}")
async def update_dossier(dossier_id: str, body: DossierUpdate, user: dict = Depends(get_current_user)):
    cabinet_id = user["cabinet_id"]
    db = get_db()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Aucune modification")
    if "statut" in updates and updates["statut"] not in STATUTS_VALIDES:
        raise HTTPException(status_code=400, detail=f"Statut invalide. Valides: {STATUTS_VALIDES}")
    updates["updated_at"] = "now()"
    result = db.table("dossiers").update(updates).eq("id", dossier_id).eq("cabinet_id", cabinet_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Dossier non trouvé")
    if "statut" in updates:
        label = updates["statut"].replace("_", " ")
        log_activity(cabinet_id, dossier_id, "statut_change", f"Statut passé à {label}", user["id"])
    return {"success": True, "dossier": result.data[0]}


@router.delete("/{dossier_id}")
async def archive_dossier(dossier_id: str, cabinet_id: str = Depends(get_current_cabinet_id)):
    db = get_db()
    result = db.table("dossiers").update({"statut": "archive", "updated_at": "now()"}).eq("id", dossier_id).eq("cabinet_id", cabinet_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Dossier non trouvé")
    return {"success": True, "message": "Dossier archivé"}
