import os
from fastapi import APIRouter, Request, HTTPException
from ai_server.models import TranscribeRequest
from ai_server.services.whisper_service import run_whisper, convert_to_srt

router = APIRouter()

@router.post("/transcribe")
async def transcribe_audio(req: TranscribeRequest, request: Request):
    """Run ASR on audio file (used by core app for uploads)."""
    # Fetch pipeline and client from app state
    pipe = request.app.state.pipe
    groq_client = request.app.state.groq_client
    
    if not os.path.exists(req.audio_path):
        raise HTTPException(status_code=400, detail="Audio file path does not exist")
        
    try:
        result = run_whisper(req.audio_path, groq_client=groq_client, pipe=pipe)
        plain_text = result.get("text", "").strip()
        srt = convert_to_srt(result.get("chunks", []))
        return {
            "plain_text": plain_text,
            "srt": srt
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
