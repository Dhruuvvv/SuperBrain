from fastapi import APIRouter, Request, HTTPException
from ai_server.models import EmbedRequest
from ai_server.services.embedding_service import generate_embedding

router = APIRouter()

@router.post("/embed")
async def embed_text(req: EmbedRequest, request: Request):
    """Generate 384-dimensional vector embedding for query text."""
    embedder = request.app.state.embedder
    if not embedder:
        raise HTTPException(status_code=500, detail="Embedding model not loaded")
    
    try:
        embedding = generate_embedding(embedder, req.text)
        return {"embedding": embedding}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
