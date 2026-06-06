import os
import json
import hashlib
from ai_server.config import logger

def get_cache_filepath(reel_id: str) -> str:
    # Clean/hash reel_id to be a safe filename
    hashed = hashlib.sha256(reel_id.encode('utf-8')).hexdigest()
    os.makedirs("temp/cache", exist_ok=True)
    return os.path.join("temp/cache", f"{hashed}.json")

def get_cached_response(reel_id: str) -> dict | None:
    filepath = get_cache_filepath(reel_id)
    if os.path.exists(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
                logger.info(f"Cache HIT for reel_id: {reel_id} (hash: {os.path.basename(filepath)})")
                return data
        except Exception as e:
            logger.warning(f"Failed to read cache for {reel_id}: {e}")
    return None

def save_cached_response(reel_id: str, data: dict):
    filepath = get_cache_filepath(reel_id)
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logger.info(f"Cached response saved for reel_id: {reel_id} (hash: {os.path.basename(filepath)})")
    except Exception as e:
        logger.warning(f"Failed to save cache for {reel_id}: {e}")
