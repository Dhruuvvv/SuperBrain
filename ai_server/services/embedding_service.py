from sentence_transformers import SentenceTransformer
from ai_server.config import logger

def load_embedder(device: str = "cpu") -> SentenceTransformer:
    logger.info("⏳ Loading Sentence Transformer (all-MiniLM-L6-v2)...")
    embedder = SentenceTransformer("all-MiniLM-L6-v2")
    if device == "cuda":
        embedder.to("cuda")
    logger.info("✅ Embedding Model Loaded")
    return embedder

def generate_embedding(embedder: SentenceTransformer, text: str) -> list:
    """Generate 384-dimensional vector embedding for text."""
    if not embedder:
        raise RuntimeError("Embedding model is not loaded.")
    embedding_tensor = embedder.encode(text)
    return embedding_tensor.tolist()
