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


def build_structured_document(metadata: dict, visual_desc: str, transcript: str) -> str:
    """
    Build a labeled, structured document combining all searchable metadata fields.
    This enhances vector retrieval compatibility and semantic matching.
    """
    parts = []
    
    # 1. Title
    title = metadata.get("title", "").strip()
    if title:
        parts.append(f"Title:\n{title}")
        
    # 2. Category
    category = metadata.get("content_type", "").strip()
    if category:
        parts.append(f"Category:\n{category}")
        
    # 3. Tags
    tags = metadata.get("tags", [])
    if isinstance(tags, list) and tags:
        tags_str = ", ".join(t.strip() for t in tags if t.strip())
        if tags_str:
            parts.append(f"Tags:\n{tags_str}")
            
    # 4. Mentioned Tools
    tools = metadata.get("mentioned_tools_or_websites", []) or metadata.get("mentioned_tools", [])
    if isinstance(tools, list) and tools:
        tools_str = ", ".join(t.strip() for t in tools if t.strip())
        if tools_str:
            parts.append(f"Mentioned Tools:\n{tools_str}")
            
    # 5. Resources
    resources = metadata.get("resources", [])
    if isinstance(resources, list) and resources:
        res_parts = []
        for r in resources:
            if not isinstance(r, dict):
                continue
            name = r.get("resource_name", "").strip()
            res_type = r.get("resource_type", "").strip()
            desc = r.get("description", "").strip()
            url = r.get("resource_url", "")
            
            res_info = name
            if res_type:
                res_info += f" ({res_type})"
            if url:
                res_info += f" - {url}"
            if desc:
                res_info += f": {desc}"
            if res_info:
                res_parts.append(res_info)
        if res_parts:
            parts.append("Resources:\n" + "\n".join(res_parts))
            
    # 6. Extracted URLs
    urls = metadata.get("extracted_urls", [])
    if isinstance(urls, list) and urls:
        urls_str = ", ".join(u.strip() for u in urls if u.strip())
        if urls_str:
            parts.append(f"Extracted URLs:\n{urls_str}")
            
    # 7. Summary
    summary = metadata.get("summary", "").strip()
    if summary:
        parts.append(f"Summary:\n{summary}")
        
    # 8. Transcript
    if transcript and transcript.strip():
        parts.append(f"Transcript:\n{transcript.strip()}")
        
    # 9. Visual Description
    if visual_desc and visual_desc.strip():
        parts.append(f"Visual Description:\n{visual_desc.strip()}")
        
    return "\n\n".join(parts)
