from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
import httpx
from app.middleware.auth import get_current_user, get_current_cabinet_id
from app.database import get_db
from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from app.services.claude_service import generer_acte, extraire_donnees
from app.services.rag_service import get_rag_context
from app.services.activity_service import log_activity

router = APIRouter(tags=["generation"])


def detect_clauses_obligatoires(infos: dict, type_acte: str) -> list[str]:
    """Detect mandatory clauses based on dossier specifics."""
    clauses = []
    if infos.get("regime_matrimonial") == "communaute":
        clauses.append("Inclure clause d'intervention et consentement du conjoint (régime de communauté)")
    if infos.get("bien_hypotheque"):
        clauses.append("Inclure clause de mainlevée d'hypothèque préalable à la vente")
    if infos.get("mode_paiement") == "credit_bancaire":
        clauses.append("Inclure clause de délégation de prêt bancaire et subrogation")
        if infos.get("banque"):
            clauses.append(f"Mentionner l'établissement bancaire : {infos['banque']}")
    if infos.get("condition_suspensive"):
        clauses.append("Inclure clause suspensive d'obtention de prêt avec délai et conséquences")
    if infos.get("nature_bien") == "indivision":
        clauses.append("Inclure clause relative à la vente d'un bien en indivision")
    if type_acte == "constitution_sarl":
        clauses.append("Inclure référence aux pouvoirs du gérant (OHADA Acte Uniforme art. 328)")
    return clauses


@router.post("/dossiers/{dossier_id}/generer")
async def generer(dossier_id: str, user: dict = Depends(get_current_user)):
    cabinet_id = user["cabinet_id"]
    db = get_db()

    dossier = db.table("dossiers").select("*").eq("id", dossier_id).eq("cabinet_id", cabinet_id).maybe_single().execute()
    if not dossier.data:
        raise HTTPException(status_code=404, detail="Dossier non trouvé")

    dossier_data = dossier.data
    type_acte = dossier_data["type_acte"]
    infos = dossier_data.get("infos_specifiques", {})

    parties = db.table("parties").select("*").eq("dossier_id", dossier_id).order("ordre").execute()

    cabinet = db.table("cabinets").select("nom").eq("id", cabinet_id).maybe_single().execute()
    cabinet_nom = cabinet.data["nom"] if cabinet.data else "Cabinet Notarial"

    # Detect mandatory clauses
    clauses_obligatoires = detect_clauses_obligatoires(infos, type_acte)

    # Build form_data
    form_data = {
        "type_acte": type_acte,
        "infos_specifiques": infos,
        "parties": parties.data,
        "clauses_obligatoires": clauses_obligatoires,
    }

    # Extract structured data via Claude
    donnees = await extraire_donnees(type_acte, form_data)

    # Inject clauses into structured data
    if clauses_obligatoires:
        donnees["clauses_obligatoires"] = clauses_obligatoires

    # Get RAG context (3 common + 1 private)
    contexte_rag = await get_rag_context(type_acte, donnees, cabinet_id)

    # Generate the act
    texte_acte = await generer_acte(type_acte, donnees, contexte_rag, cabinet_nom)

    # Version count
    existing = db.table("actes_generes").select("version").eq("dossier_id", dossier_id).order("version", desc=True).limit(1).execute()
    version = (existing.data[0]["version"] + 1) if existing.data else 1

    # Store text in Supabase Storage
    file_path = f"{cabinet_id}/actes/{dossier_id}/v{version}.txt"
    try:
        db.storage.from_("documents-cabinets").upload(file_path, texte_acte.encode("utf-8"), {"content-type": "text/plain; charset=utf-8"})
    except Exception:
        try:
            db.storage.from_("documents-cabinets").update(file_path, texte_acte.encode("utf-8"), {"content-type": "text/plain; charset=utf-8"})
        except Exception:
            pass

    # Save to actes_generes
    acte = db.table("actes_generes").insert({
        "dossier_id": dossier_id,
        "cabinet_id": cabinet_id,
        "version": version,
        "fichier_path": file_path,
        "genere_par": user["id"],
        "statut": "brouillon",
    }).execute()

    # Update dossier status
    db.table("dossiers").update({"statut": "redaction_projet", "updated_at": "now()"}).eq("id", dossier_id).execute()

    log_activity(cabinet_id, dossier_id, "acte_genere", f"Acte v{version} généré ({type_acte.replace('_', ' ')})", user["id"])

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
        "clauses_detectees": clauses_obligatoires,
    }


@router.get("/dossiers/{dossier_id}/actes")
async def list_actes(dossier_id: str, cabinet_id: str = Depends(get_current_cabinet_id)):
    db = get_db()
    result = db.table("actes_generes").select("*").eq("dossier_id", dossier_id).eq("cabinet_id", cabinet_id).order("version", desc=True).execute()
    return {"actes": result.data}


@router.get("/dossiers/{dossier_id}/actes/{acte_id}/download")
async def download_acte(dossier_id: str, acte_id: str, cabinet_id: str = Depends(get_current_cabinet_id)):
    db = get_db()
    acte = db.table("actes_generes").select("*").eq("id", acte_id).eq("dossier_id", dossier_id).eq("cabinet_id", cabinet_id).maybe_single().execute()
    if not acte.data or not acte.data.get("fichier_path"):
        raise HTTPException(status_code=404, detail="Acte non trouvé")

    # Download from storage
    try:
        content = db.storage.from_("documents-cabinets").download(acte.data["fichier_path"])
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Fichier non trouvé: {e}")

    dossier = db.table("dossiers").select("numero_dossier").eq("id", dossier_id).maybe_single().execute()
    numero = dossier.data["numero_dossier"] if dossier.data else dossier_id[:8]
    filename = f"Notia_{numero}_v{acte.data['version']}.txt"

    return Response(
        content=content,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/dossiers/{dossier_id}/actes/{acte_id}/pdf")
async def download_pdf(dossier_id: str, acte_id: str, cabinet_id: str = Depends(get_current_cabinet_id)):
    db = get_db()
    acte = db.table("actes_generes").select("*").eq("id", acte_id).eq("dossier_id", dossier_id).eq("cabinet_id", cabinet_id).maybe_single().execute()
    if not acte.data or not acte.data.get("fichier_path"):
        raise HTTPException(status_code=404, detail="Acte non trouvé")

    try:
        content = db.storage.from_("documents-cabinets").download(acte.data["fichier_path"])
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Fichier non trouvé: {e}")

    text = content.decode("utf-8") if isinstance(content, bytes) else content

    # Convert to PDF via Gotenberg
    html = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body {{ font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; margin: 2.5cm; color: #1a1a1a; }}
    h1 {{ font-size: 14pt; text-transform: uppercase; text-align: center; margin-bottom: 20pt; }}
    </style></head><body><pre style="white-space: pre-wrap; font-family: 'Times New Roman', serif;">{text}</pre></body></html>"""

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "http://161.97.181.171:3000/forms/chromium/convert/html",
                files={"files": ("index.html", html.encode("utf-8"), "text/html")},
                data={"marginTop": "2.5", "marginBottom": "2.5", "marginLeft": "2", "marginRight": "2"},
                timeout=30,
            )
            resp.raise_for_status()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur conversion PDF: {e}")

    dossier = db.table("dossiers").select("numero_dossier").eq("id", dossier_id).maybe_single().execute()
    numero = dossier.data["numero_dossier"] if dossier.data else dossier_id[:8]
    filename = f"Notia_{numero}_v{acte.data['version']}.pdf"

    return Response(
        content=resp.content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
