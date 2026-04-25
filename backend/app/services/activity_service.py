from app.database import get_db


def log_activity(cabinet_id: str, dossier_id: str, type_action: str, description: str, utilisateur_id: str = None, dossier_numero: str = None, client_nom: str = None):
    db = get_db()

    # Clean description — remove "(commande IA)" suffix
    description = description.replace(" (commande IA)", "")

    entry = {
        "cabinet_id": cabinet_id,
        "dossier_id": dossier_id,
        "type_action": type_action,
        "description": description,
        "utilisateur_id": utilisateur_id,
    }

    try:
        db.table("activites").insert(entry).execute()
    except Exception:
        pass
