from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import json as _json
from app.middleware.auth import get_current_user, get_current_cabinet_id
from app.database import get_db
from app.services.activity_service import log_activity
from app.services.claude_service import _get_client as get_claude, _claude_call_with_retry, MODEL

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


class DescriptionAnalyse(BaseModel):
    description: str


class CreerDepuisAnalyse(BaseModel):
    analyse: dict


ANALYSE_PROMPT = """Tu analyses une description de dossier notarial ivoirien.
Extrais les informations structurées et retourne UNIQUEMENT ce JSON (pas de texte autour) :
{
  "type_acte": "vente_immobiliere|constitution_sarl|succession|donation|ouverture_credit|null",
  "parties": [
    {
      "role": "vendeur|acquereur|associe|gerant|defunt|heritier|donateur|donataire|debiteur|creancier",
      "nom": "string",
      "prenom": "string",
      "type_partie": "personne_physique|personne_morale",
      "situation_matrimoniale": "celibataire|marie|divorce|veuf|null",
      "regime_matrimonial": "communaute|separation|null",
      "forme_juridique": "SARL|SAS|SA|SNC|GIE|null"
    }
  ],
  "infos_specifiques": {
    "bien_hypotheque": true|false|null,
    "banque_hypotheque": "string|null",
    "mode_paiement": "comptant|credit_bancaire|echelonne|null",
    "banque_credit": "string|null",
    "condition_suspensive": true|false|null,
    "capital_social": null,
    "siege_social": "string|null",
    "nature_bien": "string|null",
    "valeur_bien": null
  },
  "resume_compris": "phrase résumant ce qui a été compris",
  "documents_requis": ["CNI Vendeur", "CNI Acquéreur", ...],
  "points_attention": ["Conjoint à faire intervenir", ...]
}

Si une info n'est pas mentionnée → mettre null, JAMAIS inventer.
Les documents_requis doivent correspondre au type d'acte détecté.
Les points_attention signalent les clauses spéciales détectées."""


@router.post("/analyser-description")
async def analyser_description(body: DescriptionAnalyse, user: dict = Depends(get_current_user)):
    if not body.description or len(body.description.strip()) < 10:
        raise HTTPException(status_code=400, detail="Description trop courte")

    client = get_claude()
    message = _claude_call_with_retry(
        client,
        model=MODEL,
        max_tokens=2000,
        system=ANALYSE_PROMPT,
        messages=[{"role": "user", "content": body.description}],
    )

    text = message.content[0].text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1])

    try:
        analyse = _json.loads(text)
    except _json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="L'analyse n'a pas pu extraire les informations. Pouvez-vous préciser ?")

    return {"success": True, "analyse": analyse}


@router.post("/creer-depuis-analyse")
async def creer_depuis_analyse(body: CreerDepuisAnalyse, user: dict = Depends(get_current_user)):
    cabinet_id = user["cabinet_id"]
    db = get_db()
    analyse = body.analyse

    type_acte = analyse.get("type_acte")
    if not type_acte:
        raise HTTPException(status_code=400, detail="Type d'acte non identifié")

    # Get config for numbering
    config = db.table("config_cabinet").select("format_numero, compteur").eq("cabinet_id", cabinet_id).maybe_single().execute()
    if not config.data:
        raise HTTPException(status_code=500, detail="Config cabinet manquante")

    annee = datetime.now().year
    new_seq = (config.data["compteur"] or 0) + 1
    numero = generer_numero(cabinet_id, config.data["format_numero"], annee, new_seq)
    db.table("config_cabinet").update({"compteur": new_seq}).eq("cabinet_id", cabinet_id).execute()

    # Create dossier
    infos = analyse.get("infos_specifiques", {})
    # Clean nulls
    infos = {k: v for k, v in infos.items() if v is not None}

    dossier = db.table("dossiers").insert({
        "cabinet_id": cabinet_id,
        "numero_dossier": numero,
        "type_acte": type_acte,
        "infos_specifiques": infos,
        "notes_internes": analyse.get("resume_compris", ""),
        "created_by": user["id"],
    }).execute()

    dossier_id = dossier.data[0]["id"]

    # Create parties + link/create clients
    for p in analyse.get("parties", []):
        nom = p.get("nom", "")
        prenom = p.get("prenom", "")

        # Try to find existing client
        client_id = None
        if nom:
            existing = db.table("clients").select("id").eq("cabinet_id", cabinet_id).ilike("nom", f"%{nom}%").limit(1).execute()
            if existing.data:
                client_id = existing.data[0]["id"]
            else:
                # Create client
                new_client = db.table("clients").insert({
                    "cabinet_id": cabinet_id,
                    "type_client": "entreprise" if p.get("type_partie") == "personne_morale" else "particulier",
                    "nom": nom,
                    "prenom": prenom,
                    "situation_matrimoniale": p.get("situation_matrimoniale"),
                    "regime_matrimonial": p.get("regime_matrimonial"),
                    "raison_sociale": p.get("raison_sociale") if p.get("type_partie") == "personne_morale" else None,
                    "forme_juridique": p.get("forme_juridique"),
                }).execute()
                if new_client.data:
                    client_id = new_client.data[0]["id"]

        db.table("parties").insert({
            "dossier_id": dossier_id,
            "cabinet_id": cabinet_id,
            "role": p.get("role", "vendeur"),
            "type_partie": p.get("type_partie", "personne_physique"),
            "nom": nom,
            "prenom": prenom,
            "situation_matrimoniale": p.get("situation_matrimoniale"),
            "regime_matrimonial": p.get("regime_matrimonial"),
            "forme_juridique": p.get("forme_juridique"),
            "client_id": client_id,
        }).execute()

    # Create checklist from documents_requis or templates
    docs_requis = analyse.get("documents_requis", [])
    if docs_requis:
        docs = [{"dossier_id": dossier_id, "cabinet_id": cabinet_id, "nom_document": d, "statut": "manquant"} for d in docs_requis]
        db.table("documents_dossier").insert(docs).execute()
    else:
        templates = db.table("checklist_templates").select("nom_document").or_(f"cabinet_id.eq.commun,cabinet_id.eq.{cabinet_id}").eq("type_acte", type_acte).order("ordre").execute()
        if templates.data:
            docs = [{"dossier_id": dossier_id, "cabinet_id": cabinet_id, "nom_document": t["nom_document"], "statut": "manquant"} for t in templates.data]
            db.table("documents_dossier").insert(docs).execute()

    log_activity(cabinet_id, dossier_id, "dossier_cree", f"Dossier {numero} créé par IA ({type_acte.replace('_', ' ')})", user["id"])

    return {"success": True, "dossier_id": dossier_id, "numero": numero}


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
