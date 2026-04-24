import httpx
from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY

MISTRAL_API_KEY = None  # Set from env in config

async def embed_text(text: str) -> list[float]:
    """Get Mistral embedding for a text query."""
    from app.config import ANTHROPIC_API_KEY
    import os
    api_key = os.getenv("MISTRAL_API_KEY", "")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.mistral.ai/v1/embeddings",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"model": "mistral-embed", "input": [text]},
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()["data"][0]["embedding"]


async def search_rag(query: str, tenant_id: str = "commun", top_k: int = 4, type_filter: str = None) -> list[dict]:
    """Search RAG documents by cosine similarity."""
    embedding = await embed_text(query)

    # Use Supabase RPC for vector search
    async with httpx.AsyncClient() as client:
        body = {
            "query_embedding": embedding,
            "match_count": top_k,
            "filter_tenant": tenant_id,
        }
        resp = await client.post(
            f"{SUPABASE_URL}/rest/v1/rpc/recherche_rag",
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json",
            },
            json=body,
            timeout=30,
        )
        if resp.status_code == 200:
            return resp.json()

    # Fallback: direct query if RPC doesn't exist
    return []


async def get_rag_context(type_acte: str, donnees: dict, cabinet_id: str) -> dict:
    """Get full RAG context for document generation: clauses + obligations + tarifs."""
    import asyncio

    clause_query = f"clauses modèles pour acte {type_acte} en droit ivoirien"
    obligation_query = f"obligations légales OHADA Code Civil pour {type_acte}"
    tarif_query = f"tarifs honoraires notariaux {type_acte} Côte d'Ivoire"

    # 3 parallel searches on common RAG
    results = await asyncio.gather(
        search_rag(clause_query, "commun", 4),
        search_rag(obligation_query, "commun", 4),
        search_rag(tarif_query, "commun", 3),
    )

    # 1 search on private RAG (cabinet models)
    private_results = await search_rag(f"modèle acte {type_acte}", cabinet_id, 3)

    context = {
        "clauses": [r.get("contenu", "") for r in results[0]],
        "obligations": [r.get("contenu", "") for r in results[1]],
        "tarifs": [r.get("contenu", "") for r in results[2]],
    }

    if private_results:
        context["clauses_cabinet"] = [r.get("contenu", "") for r in private_results]

    return context
