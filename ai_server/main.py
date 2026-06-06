import os
import logging
import traceback
from contextlib import asynccontextmanager
import torch
import uvicorn
from fastapi import FastAPI
from groq import Groq
from google import genai
from sentence_transformers import SentenceTransformer
from transformers import pipeline

from ai_server.config import logger
from ai_server.routes import transcribe, embed, chat, mindmap, analyze

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        logger.info("==================================")
        logger.info("🚀 Initializing SuperBrain AI Layer (Modular)")
        logger.info("==================================")

        # 1. Device Selection
        device = 0 if torch.cuda.is_available() else -1
        device_name = "GPU (CUDA)" if device == 0 else "CPU"
        logger.info(f"🖥️ Target Device: {device_name}")

        # 2. Load Whisper (ASR)
        pipe = None
        try:
            logger.info(
                "⏳ Loading Whisper Model (Oriserve/Whisper-Hindi2Hinglish-Prime)..."
            )
            pipe = pipeline(
                "automatic-speech-recognition",
                model="Oriserve/Whisper-Hindi2Hinglish-Prime",
                device=device,
                torch_dtype=torch.float16 if device == 0 else torch.float32,
                model_kwargs={"low_cpu_mem_usage": True},
            )
            logger.info("✅ Whisper Model Loaded")
        except Exception as whisper_err:
            logger.warning(
                f"⚠️ Could not load local Whisper model ({whisper_err}). "
                "The server will rely on Groq Whisper API for transcription."
            )

        app.state.pipe = pipe

        # 3. Load Sentence Transformer (Embeddings)
        logger.info("⏳ Loading Sentence Transformer (all-MiniLM-L6-v2)...")
        embedder = SentenceTransformer("all-MiniLM-L6-v2")
        if device == 0:
            embedder.to("cuda")
        logger.info("✅ Embedding Model Loaded")
        app.state.embedder = embedder

        # 4. Groq Setup
        groq_api_key = os.getenv("GROQ_API_KEY")
        if not groq_api_key:
            logger.warning("⚠️ GROQ_API_KEY missing from .env!")
        groq_client = Groq(api_key=groq_api_key)
        logger.info("✅ Groq Client Ready")
        app.state.groq_client = groq_client

        # 5. Gemini Setup
        gemini_api_key = os.getenv("GEMINI_API_KEY")
        if not gemini_api_key:
            logger.warning("⚠️ GEMINI_API_KEY missing from .env!")
            gemini_client = None
        else:
            gemini_client = genai.Client(api_key=gemini_api_key)
            logger.info("✅ Gemini Client Initialized (New SDK)")
        app.state.gemini_client = gemini_client

        logger.info("==================================")
        logger.info("🔥 AI Server Fully Operational (Modular)")
        logger.info("==================================")

    except Exception as e:
        logger.error(f"❌ CRITICAL STARTUP ERROR: {str(e)}")
        traceback.print_exc()
        raise e

    yield
    logger.info("Shutting down AI Server...")

app = FastAPI(lifespan=lifespan, title="SuperBrain AI Layer", version="2.0.0")

# Include routers
app.include_router(transcribe.router)
app.include_router(embed.router)
app.include_router(chat.router)
app.include_router(mindmap.router)
app.include_router(analyze.router)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
