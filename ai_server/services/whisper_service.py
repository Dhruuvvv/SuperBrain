import os
import re
import json
import torch
from transformers import pipeline
from ai_server.config import logger
from ai_server.utils.hallucination import seconds_to_srt_time

def transliterate_to_hinglish(text: str, groq_client) -> str:
    """Transliterates Devanagari (Hindi) text to Romanized Hinglish (Latin script)."""
    if not text.strip():
        return text
    try:
        system_prompt = (
            "You are an expert translator and transliterator. "
            "Your task is to transliterate Devanagari (Hindi script) text to Romanized Hinglish (Latin/English script).\n"
            "Rules:\n"
            "1. Do NOT translate English words to Hindi. Keep English words in English (e.g. 'Git', 'commands', 'repository').\n"
            "2. Transliterate all Devanagari words to their phonetic Romanized Hinglish representation (e.g. 'क्या करता है' -> 'kya karta hai', 'आपकी' -> 'aapki', 'काम करता है' -> 'kaam karta hai').\n"
            "3. Maintain the exact original sentence structure, punctuation, capitalization, and spacing.\n"
            "4. Return ONLY the transliterated Romanized Hinglish text. Do not add any explanation, notes, or intro."
        )
        response = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.1,
            max_tokens=2048
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.warning(f"Failed to transliterate full text: {e}")
        return text

def transliterate_chunks(chunks: list, groq_client) -> list:
    """Transliterates a list of Whisper chunks to Romanized Hinglish in a single batch call."""
    if not chunks:
        return chunks
    
    texts = [c.get("text", "") for c in chunks]
    try:
        system_prompt = (
            "You are an expert transliterator. Your task is to transliterate a list of Hindi/Devanagari text strings into Romanized Hinglish (Latin/English script) strings.\n"
            "Rules:\n"
            "1. Transliterate Devanagari to phonetic Romanized Hinglish (e.g., 'नमस्ते' -> 'namaste').\n"
            "2. Keep English words in English.\n"
            "3. Keep the exact same list size, order, and punctuation.\n"
            "4. Return a JSON object with a single key 'results' which contains the array of transliterated strings."
        )
        
        response = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps({"texts": texts}, ensure_ascii=False)}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.1,
            response_format={"type": "json_object"},
            max_tokens=2048
        )
        
        res_data = json.loads(response.choices[0].message.content)
        results = res_data.get("results", [])
        
        if len(results) == len(chunks):
            new_chunks = []
            for idx, chunk in enumerate(chunks):
                new_chunk = chunk.copy()
                new_chunk["text"] = results[idx]
                new_chunks.append(new_chunk)
            return new_chunks
        else:
            logger.warning("Transliterated chunks count mismatch. Using original chunks.")
            return chunks
    except Exception as e:
        logger.warning(f"Failed to transliterate chunks: {e}")
        return chunks


def load_whisper(device_id: int):
    """Loads the local Whisper speech-to-text pipeline."""
    logger.info("⏳ Loading Whisper Model (Oriserve/Whisper-Hindi2Hinglish-Prime)...")
    pipe = pipeline(
        "automatic-speech-recognition",
        model="Oriserve/Whisper-Hindi2Hinglish-Prime",
        device=device_id,
        torch_dtype=torch.float16 if device_id == 0 else torch.float32,
        model_kwargs={"low_cpu_mem_usage": True},
    )
    logger.info("✅ Whisper Model Loaded")
    return pipe


def run_whisper(audio_path: str, groq_client=None, pipe=None):
    """Run Whisper transcription. Tries Groq API first for speed, falls back to local pipeline on failure."""
    result = None
    if groq_client and os.path.exists(audio_path):
        try:
            logger.info(f"Attempting fast Groq Whisper transcription for: {audio_path}")
            with open(audio_path, "rb") as f:
                response = groq_client.audio.transcriptions.create(
                    file=(os.path.basename(audio_path), f.read()),
                    model="whisper-large-v3",
                    response_format="verbose_json"
                )
            
            # Map verbose_json to the pipeline's structure
            chunks = []
            segments = getattr(response, "segments", []) or response.get("segments", [])
            for seg in segments:
                if hasattr(seg, "get"):
                    start = seg.get("start", 0.0)
                    end = seg.get("end", 0.0)
                    text = seg.get("text", "")
                else:
                    start = getattr(seg, "start", 0.0)
                    end = getattr(seg, "end", 0.0)
                    text = getattr(seg, "text", "")
                chunks.append({
                    "timestamp": (start, end),
                    "text": text
                })
            
            full_text = getattr(response, "text", "") or response.get("text", "")
            logger.info(f"Groq Whisper transcription successful (Word count: {len(full_text.split())})")
            result = {
                "text": full_text,
                "chunks": chunks
            }
        except Exception as e:
            logger.warning(f"Groq Whisper transcription failed, falling back to local: {e}")

    if not result:
        # Fallback to local pipeline
        if not pipe:
            logger.error("Local Whisper model is not loaded and Groq transcription was not successful.")
            raise RuntimeError("ASR transcription unavailable: local model not loaded and Groq failed.")

        logger.info(f"Running local Whisper transcription for: {audio_path}")
        result = pipe(
            audio_path, return_timestamps=True, chunk_length_s=30, ignore_warning=True, batch_size=8
        )

    # Transliteration check
    if result and groq_client:
        text_content = result.get("text", "")
        if text_content and re.search(r"[\u0900-\u097F]", text_content):
            logger.info("Detected Devanagari characters in transcription. Transliterating to Romanized Hinglish...")
            transliterated_text = transliterate_to_hinglish(text_content, groq_client)
            transliterated_chunks = transliterate_chunks(result.get("chunks", []), groq_client)
            result = {
                "text": transliterated_text,
                "chunks": transliterated_chunks
            }

    return result


def convert_to_srt(chunks: list) -> str:
    """Converts Whisper chunks to SRT string"""
    srt_lines = []
    for index, chunk in enumerate(chunks):
        ts = chunk.get("timestamp") or (0.0, 0.0)
        start = ts[0] or 0
        end = ts[1] or 0
        text = chunk.get("text", "").strip()

        srt_lines.append(str(index + 1))
        srt_lines.append(f"{seconds_to_srt_time(start)} --> {seconds_to_srt_time(end)}")
        srt_lines.append(text)
        srt_lines.append("")  # blank line
    return "\n".join(srt_lines)
