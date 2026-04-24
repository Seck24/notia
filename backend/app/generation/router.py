from fastapi import APIRouter, Depends, HTTPException
from app.middleware.auth import get_current_user, get_current_cabinet_id
from app.database import get_db
from app.services.claude_service import generer_acte, extraire_donnees
from app.services.rag_service import get_rag_context
from app.services.activity_service import log_activity

router = APIRouter(tags=["generation"])


@router.post("/dossiers/{dossier_id}/generer")
async def generer(dossier_id: str, user: dict = Depends(get_current_user)):
    cabinet_id = user["cabinet_id"]
    db = get_db()

    # Get dossier with all data
    dossier = db.table("dossiers").select("*").eq("id", dossier_id).eq("cabinet_id", cabinet_id).maybe_single().execute()
    if not dossier.data:
        raise HTTPException(status_code=404, detail="Dossier non trouvé")

    dossier_data = dossier.data
    type_acte = dossier_data["type_acte"]

    # Get parties
    parties = db.table("parties").select("*").eq("dossier_id", dossier_id).order("ordre").execute()

    # Get cabinet info
    cabinet = db.table("cabinets").select("nom").eq("id", cabinet_id).maybe_single().execute()
    cabinet_nom = cabinet.data["nom"] if cabinet.data else "Cabinet Notarial"

    # Build form_data from dossier + parties
    form_data = {
        "type_acte": type_acte,
        "infos_specifiques": dossier_data.get("infos_specifiques", {}),
        "parties": parties.data,
    }

    # Extract structured data
    donnees = await extraire_donnees(type_acte, form_data)

    # Get RAG context (3 common + 1 private parallel)
    contexte_rag = await get_rag_context(type_acte, donnees, cabinet_id)

    # Generate the act
    texte_acte = await generer_acte(type_acte, donnees, contexte_rag, cabinet_nom)

    # Get current version count
    existing = db.table("actes_generes").select("version").eq("dossier_id", dossier_id).order("version", desc=True).limit(1).execute()
    version = (existing.data[0]["version"] + 1) if existing.data else 1

    # Save to actes_generes
    acte = db.table("actes_generes").insert({
        "dossier_id": dossier_id,
        "cabinet_id": cabinet_id,
        "version": version,
        "genere_par": user["id"],
        "statut": "brouillon",
    }).execute()

    # Update dossier status
    db.table("dossiers").update({"statut": "redaction_projet", "updated_at": "now()"}).eq("id", dossier_id).execute()

    log_activity(cabinet_id, dossier_id, "acte_genere", f"Acte v{version} généré ({type_acte.replace('_',' ')})", user["id"])

    # Log generation
    db.table("logs_generation").insert({
        "cabinet_id": cabinet_id,
        "dossier_id": dossier_id,
        "type_acte": type_acte,
        "version": version,
        "genere_par": user["id"],
    }).execute()

    return {
        "success": True,
        "acte_id": acte.data[0]["id"] if acte.data else None,
        "version": version,
        "texte": texte_acte,
    }


@router.get("/dossiers/{dossier_id}/actes")
async def list_actes(dossier_id: str, cabinet_id: str = Depends(get_current_cabinet_id)):
    db = get_db()
    result = db.table("actes_generes").select("*, utilisateurs!actes_generes_genere_par_fkey(nom)").eq("dossier_id", dossier_id).eq("cabinet_id", cabinet_id).order("version", desc=True).execute()
    return {"actes": result.data}
