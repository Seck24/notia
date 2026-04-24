from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import CORS_ORIGINS
from app.auth.router import router as auth_router
from app.cabinets.router import router as cabinets_router
from app.dossiers.router import router as dossiers_router
from app.parties.router import router as parties_router
from app.documents.router import router as documents_router
from app.upload_public.router import router as upload_router
from app.generation.router import router as generation_router

app = FastAPI(title="Notia API", version="2.0.0", description="API de gestion notariale intelligente")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(cabinets_router)
app.include_router(dossiers_router)
app.include_router(parties_router)
app.include_router(documents_router)
app.include_router(upload_router)
app.include_router(generation_router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}
