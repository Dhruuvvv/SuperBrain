from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class TranscribeRequest(BaseModel):
    audio_path: str


class AnalyzeRequest(BaseModel):
    reel_id: str
    caption: str = ""
    caption_urls: List[str] = []
    content_mode: str = "video"   # "video" | "single_image" | "image_carousel"
    # Video mode fields
    audio_path: str = ""
    video_path: str = ""
    # Image mode fields
    image_paths: List[str] = []
    bypass_cache: bool = False


class EmbedRequest(BaseModel):
    text: str


class ChatContextItem(BaseModel):
    title: str = ""
    summary: str = ""
    instagram_url: str = ""
    author_username: str = ""
    plain_text: str = ""
    how_to_guide: Optional[Dict[str, Any]] = None


class ChatRequest(BaseModel):
    query: str
    context: List[ChatContextItem]


class MindMapRequest(BaseModel):
    title: str
    summary: str
    key_takeaways: List[str] = []
    plain_text: str = ""
    detail_level: str = "moderate"
