from app.database import get_db


def log_activity(cabinet_id: str, dossier_id: str, type_action: str, description: str, utilisateur_id: str = None):
    db = get_db()
    db.table("activites").insert({
        "cabinet_id": cabinet_id,
        "dossier_id": dossier_id,
        "type_action": type_action,
        "description": description,
        "utilisateur_id": utilisateur_id,
    }).execute()
