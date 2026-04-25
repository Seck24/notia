from app.database import get_db


def log_activity(cabinet_id: str, dossier_id: str, type_action: str, description: str, utilisateur_id: str = None, dossier_numero: str = None, client_nom: str = None):
    db = get_db()

    # Auto-fetch dossier_numero and client_nom if not provided
    if dossier_id and (not dossier_numero or not client_nom):
        try:
            dos = db.table("dossiers").select("numero_dossier, client_id").eq("id", dossier_id).maybe_single().execute()
            if dos.data:
                if not dossier_numero:
                    dossier_numero = dos.data.get("numero_dossier")
                if not client_nom and dos.data.get("client_id"):
                    cli = db.table("clients").select("nom, prenom").eq("id", dos.data["client_id"]).maybe_single().execute()
                    if cli.data:
                        client_nom = f"{cli.data.get('prenom', '')} {cli.data.get('nom', '')}".strip()
        except Exception:
            pass

    # Clean description — remove "(commande IA)" suffix
    description = description.replace(" (commande IA)", "")

    entry = {
        "cabinet_id": cabinet_id,
        "dossier_id": dossier_id,
        "type_action": type_action,
        "description": description,
        "utilisateur_id": utilisateur_id,
    }
    if dossier_numero:
        entry["dossier_numero"] = dossier_numero
    if client_nom:
        entry["client_nom"] = client_nom

    db.table("activites").insert(entry).execute()
