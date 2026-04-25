"""
claude_service.py — Extraction de données + génération d'actes via Claude
Modèle : claude-sonnet-4-20250514
"""

import os
import re
import json
from anthropic import Anthropic
from datetime import date as _date

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
MODEL = "claude-sonnet-4-20250514"  # legacy alias — prefer MODEL_CRITIQUE / MODEL_STANDARD
MODEL_CRITIQUE = "claude-sonnet-4-20250514"      # Actes, vérification qualité, clauses
MODEL_STANDARD = "claude-haiku-4-5-20251001"  # Extraction, commandes, résumés

import time
import logging
from anthropic import APIStatusError, APIConnectionError, RateLimitError
try:
    from anthropic import OverloadedError
except ImportError:
    OverloadedError = None

_logger = logging.getLogger("claude_service")

def _claude_call_with_retry(client, *, max_attempts=4, base_delay=2.0, **kwargs):
    """Wrap client.messages.create() with exponential backoff on transient errors."""
    last_err = None
    for attempt in range(1, max_attempts + 1):
        try:
            return client.messages.create(**kwargs)
        except Exception as e:  # noqa: BLE001
            retriable = False
            if OverloadedError is not None and isinstance(e, OverloadedError):
                retriable = True
            elif isinstance(e, RateLimitError):
                retriable = True
            elif isinstance(e, APIStatusError) and getattr(e, "status_code", None) in (429, 503, 529):
                retriable = True
            elif isinstance(e, APIConnectionError):
                retriable = True
            # Fallback: some SDK versions raise a generic error whose body contains "overloaded"
            elif "overloaded" in str(e).lower() or "529" in str(e):
                retriable = True
            if not retriable or attempt == max_attempts:
                _logger.error("Claude call failed (attempt %d/%d): %s", attempt, max_attempts, e)
                raise
            delay = base_delay * (2 ** (attempt - 1))
            _logger.warning("Claude transient error (attempt %d/%d): %s — retrying in %.1fs", attempt, max_attempts, e, delay)
            time.sleep(delay)
            last_err = e
    if last_err:
        raise last_err


_client = None


def _get_client():
    global _client
    if _client is None:
        _client = Anthropic(api_key=ANTHROPIC_API_KEY)
    return _client


_UNITES = [
    "", "UN", "DEUX", "TROIS", "QUATRE", "CINQ", "SIX", "SEPT", "HUIT", "NEUF",
    "DIX", "ONZE", "DOUZE", "TREIZE", "QUATORZE", "QUINZE", "SEIZE",
    "DIX-SEPT", "DIX-HUIT", "DIX-NEUF",
]
_DIZAINES = [
    "", "", "VINGT", "TRENTE", "QUARANTE", "CINQUANTE",
    "SOIXANTE", "SOIXANTE", "QUATRE-VINGT", "QUATRE-VINGT",
]
_MOIS = [
    "", "JANVIER", "FEVRIER", "MARS", "AVRIL", "MAI", "JUIN",
    "JUILLET", "AOUT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DECEMBRE",
]
_JOURS_ORDINAUX = {
    1: "PREMIER", 2: "DEUX", 3: "TROIS", 4: "QUATRE", 5: "CINQ",
    6: "SIX", 7: "SEPT", 8: "HUIT", 9: "NEUF", 10: "DIX",
    11: "ONZE", 12: "DOUZE", 13: "TREIZE", 14: "QUATORZE", 15: "QUINZE",
    16: "SEIZE", 17: "DIX-SEPT", 18: "DIX-HUIT", 19: "DIX-NEUF", 20: "VINGT",
    21: "VINGT ET UN", 22: "VINGT-DEUX", 23: "VINGT-TROIS", 24: "VINGT-QUATRE",
    25: "VINGT-CINQ", 26: "VINGT-SIX", 27: "VINGT-SEPT", 28: "VINGT-HUIT",
    29: "VINGT-NEUF", 30: "TRENTE", 31: "TRENTE ET UN",
}


def _nombre_en_lettres(n: int) -> str:
    """Convertit un entier (0-9999) en lettres majuscules françaises."""
    if n == 0:
        return "ZERO"
    parts = []
    if n >= 1000:
        m = n // 1000
        if m == 1:
            parts.append("MILLE")
        else:
            parts.append(_nombre_en_lettres(m) + " MILLE")
        n %= 1000
    if n >= 100:
        c = n // 100
        if c == 1:
            parts.append("CENT")
        else:
            parts.append(_UNITES[c] + " CENT")
        n %= 100
    if n >= 20:
        d = n // 10
        u = n % 10
        if d == 7 or d == 9:  # soixante-dix / quatre-vingt-dix
            base = _DIZAINES[d]
            sub = u + 10
            if sub == 11 and d == 7:
                parts.append(base + " ET ONZE")
            else:
                parts.append(base + "-" + _UNITES[sub])
        elif u == 0:
            parts.append(_DIZAINES[d])
        elif u == 1 and d != 8:
            parts.append(_DIZAINES[d] + " ET UN")
        else:
            parts.append(_DIZAINES[d] + "-" + _UNITES[u])
    elif n > 0:
        parts.append(_UNITES[n])
    return " ".join(parts)


def date_en_lettres(date_str: str) -> str:
    """
    Convertit "2026-04-01" → "L'AN DEUX MILLE VINGT-SIX, LE PREMIER AVRIL"
    Accepte aussi un objet date. Retourne une chaîne vide si la date est invalide.
    """
    try:
        if isinstance(date_str, _date):
            d = date_str
        else:
            d = _date.fromisoformat(str(date_str).strip())
        annee = _nombre_en_lettres(d.year)
        jour = _JOURS_ORDINAUX.get(d.day, str(d.day))
        mois = _MOIS[d.month]
        return f"L'AN {annee}, LE {jour} {mois}"
    except Exception:
        return ""


def calculer_frais_vente(prix: float) -> dict:
    """
    Calcule les frais notariaux pour une vente immobilière
    selon le barème DGI CI officiel.
    """
    droits_enregistrement = prix * 0.07       # 7%
    taxe_publicite        = prix * 0.012      # 1,2%
    droit_fixe            = 3_000             # FCFA fixe
    frais_conservation    = 15_000            # FCFA fixe

    if prix <= 5_000_000:
        emoluments = prix * 0.05
    elif prix <= 20_000_000:
        emoluments = 5_000_000 * 0.05 + (prix - 5_000_000) * 0.03
    elif prix <= 50_000_000:
        emoluments = (5_000_000 * 0.05
                      + 15_000_000 * 0.03
                      + (prix - 20_000_000) * 0.02)
    else:
        emoluments = (5_000_000 * 0.05
                      + 15_000_000 * 0.03
                      + 30_000_000 * 0.02
                      + (prix - 50_000_000) * 0.01)

    debours = 75_000

    total = (droits_enregistrement + taxe_publicite
             + droit_fixe + frais_conservation
             + emoluments + debours)

    return {
        "droits_enregistrement": round(droits_enregistrement),
        "taxe_publicite":        round(taxe_publicite),
        "droit_fixe":            droit_fixe,
        "frais_conservation":    frais_conservation,
        "emoluments_notaire":    round(emoluments),
        "debours":               debours,
        "total":                 round(total),
        "ratio_prix":            round((total / prix) * 100, 2),
    }


def nettoyer_markdown(texte: str) -> str:
    """Supprime tous les artefacts markdown du texte généré par Claude."""
    texte = re.sub(r'^#{1,6}\s*', '', texte, flags=re.MULTILINE)
    texte = re.sub(r'\*\*(.*?)\*\*', r'\1', texte)
    texte = re.sub(r'\*(.*?)\*', r'\1', texte)
    texte = re.sub(r'^\|.*\|$', '', texte, flags=re.MULTILINE)
    texte = re.sub(r'^\|[-\s|]+\|$', '', texte, flags=re.MULTILINE)
    texte = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', texte)
    texte = re.sub(r'\n{3,}', '\n\n', texte)
    return texte.strip()


def remplacer_a_completer(texte: str) -> str:
    """Remplace tous les marqueurs [À COMPLÉTER] par des tirets."""
    patterns = [
        r'\[À COMPLÉTER[^\]]*\]',
        r'\[A COMPLETER[^\]]*\]',
        r'\[COMPLÉTER[^\]]*\]',
        r'\[RECTIFIER[^\]]*\]',
        r'\[À PRÉCISER[^\]]*\]',
        r'\[À VÉRIFIER[^\]]*\]',
    ]
    for pattern in patterns:
        texte = re.sub(pattern, '____', texte, flags=re.IGNORECASE)
    return texte


async def extraire_donnees_document(
    nom_document: str, file_content: bytes, content_type: str,
    dossier_id: str, cabinet_id: str,
) -> dict:
    """Utilise Claude Vision pour extraire les données d'un document scanné."""
    import base64
    client = _get_client()
    db_module = __import__("app.database", fromlist=["get_db"])
    db = db_module.get_db()

    nom_lower = nom_document.lower()
    if any(k in nom_lower for k in ("cni", "carte d'identité", "identité")):
        doc_type, prompt = "CNI", "Extrais de cette CNI : nom, prenom, numero, date_naissance, date_expiration, nationalite. JSON uniquement."
    elif "passeport" in nom_lower:
        doc_type, prompt = "passeport", "Extrais de ce passeport : nom, prenom, numero, date_naissance, date_expiration, nationalite. JSON uniquement."
    elif any(k in nom_lower for k in ("titre foncier", "tf", "certificat foncier")):
        doc_type, prompt = "titre_foncier", "Extrais de ce titre foncier : numero_tf, superficie, localisation, proprietaire. JSON uniquement."
    else:
        doc_type, prompt = "autre", "Extrais toutes les informations pertinentes de ce document juridique (noms, numéros, dates, montants). JSON uniquement."

    if content_type.startswith("image/"):
        block = {"type": "image", "source": {"type": "base64", "media_type": content_type, "data": base64.b64encode(file_content).decode()}}
    elif content_type == "application/pdf":
        block = {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": base64.b64encode(file_content).decode()}}
    else:
        return {"doc_type": doc_type, "extracted": False, "reason": "Type non supporté"}

    msg = _claude_call_with_retry(client, model=MODEL_STANDARD, max_tokens=1500,
        messages=[{"role": "user", "content": [block, {"type": "text", "text": prompt}]}])
    text = msg.content[0].text.strip()
    if text.startswith("```"):
        text = "\n".join(text.split("\n")[1:-1])
    try:
        extracted = json.loads(text)
    except json.JSONDecodeError:
        return {"doc_type": doc_type, "extracted": False, "raw": text}

    result = {"doc_type": doc_type, "extracted": True, "data": extracted}

    # Compare identity docs with parties
    if doc_type in ("CNI", "passeport"):
        ext_nom = (extracted.get("nom") or "").upper().strip()
        if ext_nom:
            parties = db.table("parties_dossier").select("nom, prenom, role").eq("dossier_id", dossier_id).execute()
            mismatches = [{"role": p["role"], "nom_fiche": f"{p.get('prenom', '')} {p.get('nom', '')}".strip(),
                           "nom_document": f"{extracted.get('prenom', '')} {ext_nom}".strip()}
                          for p in parties.data if (p.get("nom") or "").upper().strip() and (p.get("nom") or "").upper().strip() != ext_nom]
            if mismatches:
                result["alertes"] = mismatches

    # Auto-fill titre foncier data
    if doc_type == "titre_foncier":
        try:
            dos = db.table("dossiers").select("infos_specifiques").eq("id", dossier_id).maybe_single().execute()
            if dos.data:
                infos = dos.data.get("infos_specifiques") or {}
                if extracted.get("numero_tf"): infos["numero_titre_foncier"] = extracted["numero_tf"]
                if extracted.get("superficie"): infos["superficie"] = extracted["superficie"]
                db.table("dossiers").update({"infos_specifiques": infos}).eq("id", dossier_id).execute()
        except Exception as e:
            _logger.warning("Mise à jour infos TF échouée: %s", e)

    return result


async def extraire_donnees(type_acte: str, form_data: dict) -> dict:
    """
    Extrait et structure les données du formulaire via Claude.
    Retourne un dict JSON propre avec les informations clés.
    """
    client = _get_client()

    prompt = f"""Tu es un assistant juridique spécialisé en droit notarial ivoirien.
Analyse les données suivantes issues d'un formulaire pour un acte de type : {type_acte}

Données du formulaire :
{json.dumps(form_data, ensure_ascii=False, indent=2)}

Extrais et structure toutes les informations pertinentes en JSON.
Identifie les parties (vendeur/acquéreur, donateur/donataire, etc.), le bien concerné,
les montants, dates, et toute condition particulière.
Si des informations semblent manquantes ou incohérentes, signale-les.

Réponds UNIQUEMENT avec le JSON structuré, sans texte autour."""

    message = _claude_call_with_retry(client,
        model=MODEL_STANDARD,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )

    text = message.content[0].text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1])
    return json.loads(text)


async def generer_acte(
    type_acte: str,
    donnees_structurees: dict,
    contexte_rag: dict,
    cabinet_nom: str,
) -> str:
    """
    Génère un acte notarial complet via Claude avec contexte RAG.
    Retourne le texte de l'acte propre (sans markdown, sans [À COMPLÉTER]).
    """
    client = _get_client()

    # Formater le contexte RAG
    rag_context = ""
    if contexte_rag.get("clauses"):
        rag_context += "CLAUSES ET MODÈLES DE RÉFÉRENCE\n"
        for i, c in enumerate(contexte_rag["clauses"], 1):
            rag_context += f"\n--- Clause {i} ---\n{c}\n"
    if contexte_rag.get("obligations"):
        rag_context += "\nOBLIGATIONS LÉGALES APPLICABLES\n"
        for i, o in enumerate(contexte_rag["obligations"], 1):
            rag_context += f"\n--- Obligation {i} ---\n{o}\n"
    if contexte_rag.get("tarifs"):
        rag_context += "\nTARIFS ET HONORAIRES\n"
        for i, t in enumerate(contexte_rag["tarifs"], 1):
            rag_context += f"\n--- Tarif {i} ---\n{t}\n"

    # Calcul des frais pour vente immobilière
    frais_section = ""
    if type_acte == "vente_immobiliere":
        try:
            prix_raw = (donnees_structurees.get("financier", {}).get("prix")
                        or donnees_structurees.get("prix"))
            if prix_raw:
                prix = float(str(prix_raw).replace(" ", "").replace("\u202f", ""))
                frais = calculer_frais_vente(prix)
                frais_section = f"""
FRAIS ET DROITS (barème DGI CI officiel) :
- Droits d'enregistrement (7%) : {frais['droits_enregistrement']:,} FCFA
- Taxe de publicité foncière (1,2%) : {frais['taxe_publicite']:,} FCFA
- Droit fixe : {frais['droit_fixe']:,} FCFA
- Frais Conservation Foncière : {frais['frais_conservation']:,} FCFA
- Émoluments notaire (barème tranches) : {frais['emoluments_notaire']:,} FCFA
- Débours estimés : {frais['debours']:,} FCFA
TOTAL FRAIS ET DROITS : {frais['total']:,} FCFA (soit {frais['ratio_prix']}% du prix)
"""
        except Exception:
            pass

    # Date de l'acte en lettres
    _date_section = donnees_structurees.get("date_acte")
    if isinstance(_date_section, dict):
        date_raw = _date_section.get("date_acte")
    elif isinstance(_date_section, str):
        date_raw = _date_section
    else:
        date_raw = None
    if not date_raw:
        date_raw = str(_date.today())
    date_lettres = date_en_lettres(date_raw) or "L'AN DEUX MILLE VINGT-SIX"

    system_prompt = f"""Tu es un expert en rédaction d'actes notariaux en Côte d'Ivoire.
Tu rédiges des actes conformes au droit ivoirien et aux Actes Uniformes OHADA.

RÈGLES DE RÉDACTION :
- Style notarial ivoirien formel et solennel
- Références légales précises (articles du Code Civil, OHADA, Code Foncier)
- Structure classique : comparution, exposé, stipulations, clauses, mentions légales
- Le document est établi par : {cabinet_nom}
- DATE EXACTE DE L'ACTE : {date_lettres}
  Utiliser EXACTEMENT cette formule en ouverture de l'acte (ex: "{date_lettres}")
  Ne jamais écrire une autre année ou une autre date.

RÈGLE ABSOLUE DE FORMATAGE :
- Ne jamais utiliser de symboles markdown dans l'acte :
  pas de ####, pas de ***, pas de --, pas de []
- Les titres d'articles s'écrivent : "ARTICLE 1 — TITRE" (avec tiret long em dash)
  pas "#### ARTICLE 1 — TITRE"
- Les listes utilisent le tiret simple suivi d'un espace : "-"
- Tout le texte doit être du français juridique pur sans aucun artefact markdown

RÈGLE ABSOLUE POUR LES CHAMPS MANQUANTS :
- Si une information n'est pas disponible, NE PAS écrire [À COMPLÉTER]
- À la place, utiliser des tirets de soulignement : ____
- Exemples : date manquante → "le ____" / nom manquant → "Monsieur/Madame ____"
- Exception : si une information critique est absente (ex: prix de vente), signaler
  en début de document : "INFORMATION MANQUANTE : [CHAMP] non fourni."

DROITS D'ENREGISTREMENT (vente immobilière) :
- Taux obligatoire DGI CI : 7% du prix de vente (JAMAIS 4%)
- Taxe publicité foncière : 1,2% du prix
- Toujours calculer et mentionner le détail des frais{frais_section}

CONTEXTE JURIDIQUE (base légale RAG) :
{rag_context if rag_context else "Utilise tes connaissances du droit notarial ivoirien."}

TERMINE TOUJOURS par :
---
AVERTISSEMENT : Ce document est un DRAFT généré par intelligence artificielle.
Il doit être révisé et validé par le Notaire titulaire avant tout usage juridique."""

    user_prompt = f"""Rédige un acte notarial complet de type : {type_acte}

Données structurées :
{json.dumps(donnees_structurees, ensure_ascii=False, indent=2)}

Rédige l'acte complet, prêt à être converti en document Word.
RAPPEL : Aucun symbole markdown. Utiliser ____ pour les champs manquants."""

    message = _claude_call_with_retry(client,
        model=MODEL_CRITIQUE,
        max_tokens=4000,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )

    texte = message.content[0].text
    texte = nettoyer_markdown(texte)
    texte = remplacer_a_completer(texte)
    return texte


async def generer_dnsv(
    donnees_structurees: dict,
    cabinet_nom: str,
) -> str:
    """
    Génère la DNSV (Déclaration Notariale de Souscription et de Versement)
    pour une constitution de SARL en Côte d'Ivoire.
    """
    client = _get_client()

    societe = donnees_structurees.get("societe", donnees_structurees)
    denomination = societe.get("denomination", "____")
    capital = societe.get("capital", "____")
    banque = societe.get("numero_compte", "____")

    _date_section2 = donnees_structurees.get("date_acte")
    if isinstance(_date_section2, dict):
        date_raw = _date_section2.get("date_acte")
    elif isinstance(_date_section2, str):
        date_raw = _date_section2
    else:
        date_raw = None
    if not date_raw:
        date_raw = str(_date.today())
    date_lettres = date_en_lettres(date_raw) or "L'AN DEUX MILLE VINGT-SIX"

    system_prompt = f"""Tu es un notaire expert en droit des sociétés ivoirien.
Rédige une DNSV (Déclaration Notariale de Souscription et de Versement)
conforme au droit OHADA et ivoirien pour une SARL en constitution.

RÈGLE ABSOLUE DE FORMATAGE :
- Aucun symbole markdown (pas de #, **, *, |)
- Titres : "SECTION 1 — TITRE" uniquement
- Champs manquants : ____ (jamais [À COMPLÉTER])
- Français juridique formel pur
- DATE EXACTE DE L'ACTE : {date_lettres} — Utiliser EXACTEMENT cette formule

Le document est établi par : {cabinet_nom}"""

    user_prompt = f"""Rédige la DNSV complète pour la société suivante :

{json.dumps(donnees_structurees, ensure_ascii=False, indent=2)}

Structure obligatoire :
1. En-tête : DÉCLARATION NOTARIALE DE SOUSCRIPTION ET DE VERSEMENT
2. Identification du notaire soussigné ({cabinet_nom})
3. Certifie que les associés fondateurs ont souscrit et versé le capital de {capital} FCFA
4. Tableau des associés : Nom | Parts | Montant FCFA | %
5. Mention du dépôt des fonds auprès de la banque
6. Condition de déblocage : sur présentation de l'extrait RCCM
7. Date, lieu, signature du notaire
8. Avertissement DRAFT

RAPPEL : Aucun symbole markdown. ____ pour les champs manquants."""

    message = _claude_call_with_retry(client,
        model=MODEL_CRITIQUE,
        max_tokens=2000,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )

    texte = message.content[0].text
    texte = nettoyer_markdown(texte)
    texte = remplacer_a_completer(texte)
    return texte
