from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from difflib import SequenceMatcher
import json as _json
from app.middleware.auth import get_current_user, get_current_cabinet_id
from app.middleware.permissions import require_permission, require_role, has_permission
from app.database import get_db
from app.services.activity_service import log_activity
from app.services.claude_service import _get_client as get_claude, _claude_call_with_retry, MODEL_STANDARD

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
    parties_decisions: Optional[list] = None


def _similarity(a: str, b: str) -> float:
    """Score de similarité entre deux chaînes (0-1)."""
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


def _rechercher_clients_similaires(db, cabinet_id: str, nom: str, prenom: str) -> list:
    """Cherche des clients existants similaires dans le cabinet."""
    if not nom and not prenom:
        return []

    search_term = nom or prenom
    results = db.table("clients").select(
        "id, nom, prenom, situation_matrimoniale, telephone, email, type_client"
    ).eq("cabinet_id", cabinet_id).or_(
        f"nom.ilike.%{search_term}%,prenom.ilike.%{search_term}%"
    ).limit(10).execute()

    # Si rien trouvé avec le nom, essayer avec le prénom
    if not results.data and prenom and nom:
        results = db.table("clients").select(
            "id, nom, prenom, situation_matrimoniale, telephone, email, type_client"
        ).eq("cabinet_id", cabinet_id).or_(
            f"nom.ilike.%{prenom}%,prenom.ilike.%{prenom}%"
        ).limit(10).execute()

    if not results.data:
        return []

    # Scorer chaque résultat
    nom_complet = f"{nom} {prenom}".strip()
    scored = []
    for c in results.data:
        c_nom = f"{c.get('nom', '')} {c.get('prenom', '')}".strip()
        c_nom_rev = f"{c.get('prenom', '')} {c.get('nom', '')}".strip()
        score = max(_similarity(nom_complet, c_nom), _similarity(nom_complet, c_nom_rev))
        if score > 0.4:
            scored.append({
                "id": c["id"],
                "nom": c.get("nom", ""),
                "prenom": c.get("prenom", ""),
                "situation_matrimoniale": c.get("situation_matrimoniale"),
                "telephone": c.get("telephone"),
                "email": c.get("email"),
                "score": round(score, 2),
                "confiance": "haute" if score > 0.8 else "moyenne",
            })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:3]


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
        model=MODEL_STANDARD,
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

    # Enrichir chaque partie avec les clients existants similaires
    cabinet_id = user["cabinet_id"]
    db = get_db()
    for p in analyse.get("parties", []):
        nom = p.get("nom", "")
        prenom = p.get("prenom", "")
        clients_similaires = _rechercher_clients_similaires(db, cabinet_id, nom, prenom)

        if clients_similaires:
            for c in clients_similaires:
                parties_count = db.table("parties").select("id", count="exact").eq("client_id", c["id"]).execute()
                c["nb_dossiers"] = parties_count.count or 0

            best = clients_similaires[0]
            p["clients_similaires"] = clients_similaires
            p["action_suggeree"] = "lier" if best["confiance"] == "haute" else "suggerer"
        else:
            p["clients_similaires"] = []
            p["action_suggeree"] = "creer"

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

    # Create parties + link/create clients (avec reconnaissance)
    decisions = {}
    if body.parties_decisions:
        for d in body.parties_decisions:
            decisions[d.get("index", -1)] = d

    for i, p in enumerate(analyse.get("parties", [])):
        nom = p.get("nom", "")
        prenom = p.get("prenom", "")
        decision = decisions.get(i)

        client_id = None
        if decision and decision.get("action") == "lier" and decision.get("client_id"):
            # Utiliser un client existant
            client_id = decision["client_id"]
        elif decision and decision.get("action") == "creer":
            # Créer nouveau client avec infos supplémentaires optionnelles
            infos = decision.get("infos_supplementaires") or {}
            new_client = db.table("clients").insert({
                "cabinet_id": cabinet_id,
                "type_client": "entreprise" if p.get("type_partie") == "personne_morale" else "particulier",
                "nom": nom,
                "prenom": prenom,
                "situation_matrimoniale": p.get("situation_matrimoniale"),
                "regime_matrimonial": p.get("regime_matrimonial"),
                "raison_sociale": p.get("raison_sociale") if p.get("type_partie") == "personne_morale" else None,
                "forme_juridique": p.get("forme_juridique"),
                "telephone": infos.get("telephone"),
                "email": infos.get("email"),
            }).execute()
            if new_client.data:
                client_id = new_client.data[0]["id"]
        else:
            # Fallback legacy : chercher ou créer
            if nom:
                existing = db.table("clients").select("id").eq("cabinet_id", cabinet_id).ilike("nom", f"%{nom}%").limit(1).execute()
                if existing.data:
                    client_id = existing.data[0]["id"]
                else:
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
async def dashboard_stats(user: dict = Depends(get_current_user)):
    cabinet_id = user["cabinet_id"]
    db = get_db()
    query = db.table("dossiers").select("id, statut, created_at, updated_at, numero_dossier, type_acte").eq("cabinet_id", cabinet_id).neq("statut", "archive")
    if user.get("role") == "limite":
        query = query.eq("assigne_a", user["id"])
    all_dossiers = query.execute()
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

    # Recent activities — enrich with dossier info via JOIN
    activites = db.table("activites").select("*, dossiers(numero_dossier, type_acte, parties(nom, prenom, role))").eq("cabinet_id", cabinet_id).order("created_at", desc=True).limit(10).execute()

    # Flatten dossier info into each activity
    enriched_activites = []
    for a in (activites.data or []):
        entry = {k: v for k, v in a.items() if k != "dossiers"}
        dos = a.get("dossiers")
        if dos:
            entry["dossier_numero"] = entry.get("dossier_numero") or dos.get("numero_dossier")
            entry["type_acte"] = dos.get("type_acte")
            entry["parties"] = dos.get("parties") or []
        # Clean "(commande IA)" from old descriptions
        if entry.get("description"):
            entry["description"] = entry["description"].replace(" (commande IA)", "")
        enriched_activites.append(entry)

    return {
        "stats": {"en_cours": en_cours, "attente": attente, "redaction": redaction, "finalises": finalises},
        "urgents": urgents,
        "activites": enriched_activites,
    }


@router.get("")
async def list_dossiers(
    statut: Optional[str] = Query(None),
    type_acte: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    cabinet_id = user["cabinet_id"]
    db = get_db()
    query = db.table("dossiers").select("*, utilisateurs!dossiers_assigne_a_fkey(nom, prenom), clients(nom, prenom), parties(nom, prenom, role)", count="exact").eq("cabinet_id", cabinet_id).neq("statut", "archive")
    # Limité: only sees assigned dossiers
    if user.get("role") == "limite":
        query = query.eq("assigne_a", user["id"])
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


class CommandeRequest(BaseModel):
    texte: str


def _extraire_json(texte: str) -> dict:
    """Extraire un objet JSON même si Claude ajoute du texte autour."""
    import re
    texte = texte.strip()
    if texte.startswith("```"):
        lines = texte.split("\n")
        texte = "\n".join(lines[1:-1])
    match = re.search(r'\{.*\}', texte, re.DOTALL)
    if match:
        return _json.loads(match.group())
    raise ValueError("Pas de JSON trouvé")


def _fuzzy_match_doc(nom_cherche: str, docs: list) -> str | None:
    """Trouver le document le plus proche dans la liste."""
    nom_lower = nom_cherche.lower()
    # Match exact ou partiel
    for d in docs:
        doc_name = d["nom_document"].lower()
        if nom_lower in doc_name or doc_name in nom_lower:
            return d["nom_document"]
    # Sinon similarité
    best, best_score = None, 0
    for d in docs:
        score = _similarity(nom_lower, d["nom_document"].lower())
        if score > best_score:
            best, best_score = d["nom_document"], score
    return best if best_score > 0.4 else None


def _safe_log(cabinet_id, dossier_id, type_action, description, user_id):
    """Log activité sans crasher si la table n'a pas toutes les colonnes."""
    try:
        log_activity(cabinet_id, dossier_id, type_action, description, user_id)
    except Exception:
        pass


@router.post("/{dossier_id}/commande")
async def executer_commande(dossier_id: str, body: CommandeRequest, user: dict = Depends(get_current_user)):
    cabinet_id = user["cabinet_id"]
    db = get_db()

    # Charger contexte dossier
    dossier = db.table("dossiers").select("*").eq("id", dossier_id).eq("cabinet_id", cabinet_id).maybe_single().execute()
    if not dossier.data:
        raise HTTPException(status_code=404, detail="Dossier non trouvé")

    docs = db.table("documents_dossier").select("nom_document, statut").eq("dossier_id", dossier_id).execute()
    parties_list = db.table("parties").select("nom, prenom, role").eq("dossier_id", dossier_id).execute()

    docs_list = [f"{d['nom_document']} ({d['statut']})" for d in (docs.data or [])]
    parties_str = [f"{p.get('prenom', '')} {p.get('nom', '')} ({p.get('role', '')})" for p in (parties_list.data or [])]

    system_prompt = f"""Tu es l'assistant d'un clerc notarial ivoirien. Tu interprètes des commandes en français naturel et tu retournes une action JSON structurée.

CONTEXTE DU DOSSIER :
- Type : {dossier.data['type_acte']}
- Statut actuel : {dossier.data['statut']}
- Documents : {_json.dumps(docs_list, ensure_ascii=False)}
- Parties : {_json.dumps(parties_str, ensure_ascii=False)}
- Infos : {_json.dumps(dossier.data.get('infos_specifiques', {}) or {{}}, ensure_ascii=False)}

ACTIONS DISPONIBLES ET LEURS DÉCLENCHEURS :

changer_statut :
  "passer en X", "statut X", "étape X", "aller à X", "retourner à X", "revenir à X", "retournons à X", "on est en X", "dossier complet"
  params: {{ "nouveau_statut": "reception_client|analyse_interne|attente_pieces|demarches_admin|redaction_projet|observations_client|signature_finale" }}

marquer_document_recu :
  "X reçu", "j'ai reçu X", "X ok", "X arrivé", "X transmis"
  params: {{ "nom_document": "string" }}

marquer_document_manquant :
  "X pas reçu", "X manquant", "annuler X", "X non valide", "X invalide", "X à refaire", "X n'est pas bon", "X pas bon", "remettre X en attente"
  params: {{ "nom_document": "string" }}

valider_document :
  "valider X", "X validé", "X conforme", "X approuvé", "X correct"
  params: {{ "nom_document": "string" }}

rejeter_document :
  "rejeter X", "X rejeté", "X refusé", "X incorrect", "X à corriger", "X mauvaise qualité"
  params: {{ "nom_document": "string", "raison": "string" }}

marquer_tous_recus :
  "tous reçus", "tout reçu", "tous les documents sont là", "dossier complet", "tout est là"
  params: {{}}

envoyer_lien_upload :
  "envoyer lien", "lien client", "envoyer au client", "link client"
  params: {{}}

envoyer_relance :
  "relancer client", "relance", "rappel client", "envoyer rappel"
  params: {{}}

generer_acte :
  "générer acte", "générer", "rédiger acte", "créer acte", "lancer génération"
  params: {{}}

mettre_a_jour_valeur :
  "valeur X", "montant X", "prix X", "le bien vaut X", "X francs", "X FCFA"
  params: {{ "champ": "string", "valeur": "any" }}

ajouter_note :
  "noter que", "note :", "remarque", "attention", "important"
  params: {{ "note": "string" }}

inconnu :
  Aucune correspondance trouvée
  params: {{}}

RÈGLES IMPORTANTES :
- Comprendre l'intention même si mal écrit
- Les noms de documents sont approximatifs (chercher le plus proche dans la liste)
- Accepter les fautes de frappe courantes
- Retourner UNIQUEMENT le JSON, rien d'autre

FORMAT DE RÉPONSE OBLIGATOIRE :
{{
  "action": "nom_action",
  "params": {{}},
  "confirmation": "phrase courte décrivant ce qui va être fait",
  "execute": true
}}

Si action = inconnu :
{{
  "action": "inconnu",
  "params": {{}},
  "confirmation": "",
  "execute": false,
  "suggestions": ["CNI vendeur reçu", "passer en rédaction", "envoyer lien au client", "générer l'acte"]
}}"""

    # Appel Claude
    try:
        client = get_claude()
        message = _claude_call_with_retry(
            client, model=MODEL_STANDARD, max_tokens=500,
            system=system_prompt,
            messages=[{"role": "user", "content": body.texte}],
        )
        text = message.content[0].text.strip()
    except Exception:
        return {"statut": "erreur", "message": "Erreur de communication avec l'IA"}

    # Parsing robuste
    try:
        parsed = _extraire_json(text)
    except (ValueError, _json.JSONDecodeError):
        return {
            "statut": "inconnu",
            "action": "inconnu",
            "suggestions": ["CNI vendeur reçu", "passer en rédaction", "envoyer lien au client", "générer l'acte"],
        }

    action = parsed.get("action", "inconnu")
    params = parsed.get("params", {})
    confirmation = parsed.get("confirmation", "")

    if action == "inconnu":
        return {
            "statut": "inconnu",
            "action": "inconnu",
            "confirmation": confirmation,
            "suggestions": parsed.get("suggestions", ["CNI vendeur reçu", "passer en rédaction", "envoyer lien au client"]),
        }

    # Exécution de l'action
    donnees_mises_a_jour = {}

    try:
        if action == "changer_statut" and params.get("nouveau_statut"):
            new_statut = params["nouveau_statut"]
            if new_statut in STATUTS_VALIDES:
                db.table("dossiers").update({"statut": new_statut, "updated_at": "now()"}).eq("id", dossier_id).eq("cabinet_id", cabinet_id).execute()
                _safe_log(cabinet_id, dossier_id, "statut_change", f"Statut passé à {new_statut.replace('_', ' ')}", user["id"])
                donnees_mises_a_jour = {"statut": new_statut}

        elif action == "marquer_document_recu" and params.get("nom_document"):
            matched = _fuzzy_match_doc(params["nom_document"], docs.data or [])
            if matched:
                db.table("documents_dossier").update({"statut": "recu", "uploaded_at": datetime.now().isoformat()}).eq("dossier_id", dossier_id).eq("cabinet_id", cabinet_id).eq("nom_document", matched).execute()
                _safe_log(cabinet_id, dossier_id, "document_recu", f"Document '{matched}' marqué reçu", user["id"])
                confirmation = f"Document '{matched}' marqué comme reçu"
                donnees_mises_a_jour = {"document": matched, "nouveau_statut": "recu"}

        elif action == "marquer_document_manquant" and params.get("nom_document"):
            matched = _fuzzy_match_doc(params["nom_document"], docs.data or [])
            if matched:
                db.table("documents_dossier").update({"statut": "manquant", "uploaded_at": None}).eq("dossier_id", dossier_id).eq("cabinet_id", cabinet_id).eq("nom_document", matched).execute()
                _safe_log(cabinet_id, dossier_id, "document_manquant", f"Document '{matched}' remis en attente", user["id"])
                confirmation = f"Document '{matched}' remis en attente"
                donnees_mises_a_jour = {"document": matched, "nouveau_statut": "manquant"}

        elif action == "valider_document" and params.get("nom_document"):
            matched = _fuzzy_match_doc(params["nom_document"], docs.data or [])
            if matched:
                db.table("documents_dossier").update({"statut": "valide"}).eq("dossier_id", dossier_id).eq("cabinet_id", cabinet_id).eq("nom_document", matched).execute()
                _safe_log(cabinet_id, dossier_id, "document_valide", f"Document '{matched}' validé", user["id"])
                confirmation = f"Document '{matched}' validé"
                donnees_mises_a_jour = {"document": matched, "nouveau_statut": "valide"}

        elif action == "rejeter_document" and params.get("nom_document"):
            matched = _fuzzy_match_doc(params["nom_document"], docs.data or [])
            if matched:
                raison = params.get("raison", "")
                db.table("documents_dossier").update({"statut": "rejete"}).eq("dossier_id", dossier_id).eq("cabinet_id", cabinet_id).eq("nom_document", matched).execute()
                _safe_log(cabinet_id, dossier_id, "document_rejete", f"Document '{matched}' rejeté : {raison}", user["id"])
                confirmation = f"Document '{matched}' rejeté" + (f" — {raison}" if raison else "")
                donnees_mises_a_jour = {"document": matched, "nouveau_statut": "rejete"}

        elif action == "marquer_tous_recus":
            db.table("documents_dossier").update({"statut": "recu", "uploaded_at": datetime.now().isoformat()}).eq("dossier_id", dossier_id).eq("cabinet_id", cabinet_id).eq("statut", "manquant").execute()
            _safe_log(cabinet_id, dossier_id, "document_recu", "Tous les documents marqués reçus", user["id"])
            donnees_mises_a_jour = {"tous_documents": "recu"}

        elif action == "mettre_a_jour_valeur" and params.get("champ"):
            infos = dossier.data.get("infos_specifiques", {}) or {}
            infos[params["champ"]] = params["valeur"]
            db.table("dossiers").update({"infos_specifiques": infos, "updated_at": "now()"}).eq("id", dossier_id).eq("cabinet_id", cabinet_id).execute()
            donnees_mises_a_jour = {"infos_specifiques": {params["champ"]: params["valeur"]}}

        elif action == "ajouter_note":
            note = params.get("note", "")
            old_notes = dossier.data.get("notes_internes", "") or ""
            new_notes = f"{old_notes}\n[{datetime.now().strftime('%d/%m %H:%M')}] {note}".strip()
            db.table("dossiers").update({"notes_internes": new_notes, "updated_at": "now()"}).eq("id", dossier_id).eq("cabinet_id", cabinet_id).execute()
            donnees_mises_a_jour = {"notes_internes": new_notes}

        elif action == "envoyer_lien_upload":
            return {"statut": "ok", "action": action, "confirmation": confirmation, "donnees_mises_a_jour": {}, "needs_frontend_action": "upload_link"}

        elif action == "envoyer_relance":
            return {"statut": "ok", "action": action, "confirmation": confirmation, "donnees_mises_a_jour": {}, "needs_frontend_action": "relance"}

        elif action == "generer_acte":
            return {"statut": "ok", "action": action, "confirmation": confirmation, "donnees_mises_a_jour": {}, "needs_frontend_action": "generer"}

        else:
            return {"statut": "inconnu", "action": action, "suggestions": ["CNI vendeur reçu", "passer en rédaction", "envoyer lien au client"]}

    except Exception as e:
        return {"statut": "erreur", "message": f"Erreur lors de l'exécution : {str(e)}"}

    return {"statut": "ok", "action": action, "confirmation": confirmation, "donnees_mises_a_jour": donnees_mises_a_jour}
