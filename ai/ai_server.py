import os
import json
import logging
import asyncio
import traceback
import base64
import subprocess
import re
import time
from urllib.parse import urlparse
from functools import partial
from contextlib import asynccontextmanager
from typing import Dict, Any

import torch
import uvicorn
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel
from transformers import pipeline
from sentence_transformers import SentenceTransformer
from groq import Groq
from google import genai
from google.genai import types
from dotenv import load_dotenv

# --- Configuration & Logging ---
load_dotenv()
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("SuperBrain-AI")

# Global variables for models
pipe = None
embedder = None
groq_client = None
gemini_model = None
gemini_client = None

# --- Utility Functions ---

INVALID_TLD_PATTERNS = [
    "windows", "exe", "app", "zip", "rar", "pdf", "jpg", "png", "mp4", "dmg"
]
SOCIAL_DOMAINS = [
    "instagram.com", "facebook.com", "twitter.com", 
    "x.com", "tiktok.com", "youtube.com", "t.me"
]

# === MODIFIED BY GROK ===
import hashlib

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


def is_valid_extracted_url(url: str) -> bool:
    url_lower = url.lower().strip()
    if not url_lower:
        return False
        
    try:
        parsed = urlparse(url_lower)
        # Extract host
        host = parsed.netloc or parsed.path.split("/")[0]
        
        # Strip scheme or paths just to get the clean host
        if "://" in host:
            host = host.split("://")[-1]
        if "/" in host:
            host = host.split("/")[0]
            
        host = host.strip()
        
        # Host name validation: Must only contain alphanumeric, dots, hyphens, underscores
        if not re.match(r"^[a-z0-9\.\-_]+$", host):
            return False
            
        # Ensure it has a valid structure with dots
        parts = host.split(".")
        if len(parts) < 2:
            return False
            
        tld = parts[-1]
        
        # Must have valid TLD (at least 2 chars)
        if len(tld) < 2:
            return False
            
        # Check for invalid TLDs
        if tld in INVALID_TLD_PATTERNS:
            return False
            
        # Skip social media domains for raw OCR URLs
        for domain in SOCIAL_DOMAINS:
            if domain in host:
                return False
                
    except Exception:
        return False
        
    return True


GENERIC_TECH_TERMS = {
    "react", "reactjs", "react.js", "html", "css", "javascript", "js", "typescript", "ts",
    "nodejs", "node", "npm", "yarn", "pnpm", "python", "py", "pip", "poetry",
    "api", "sdk", "json", "sql", "graphql", "rest", "mongodb", "postgres", "postgresql",
    "mysql", "sqlite", "ai", "ml", "llm", "mcp", "rag", "agent", "tailwind", "tailwindcss",
    "nextjs", "next.js", "express", "fastapi", "django", "flask", "github", "gitlab", "bitbucket",
    "git", "docker", "kubernetes", "k8s", "aws", "gcp", "azure", "vercel", "netlify", "heroku", "render",
    "css-in-js", "styled-components", "sass", "less", "bootstrap", "material-ui", "mui", "shadcn",
    "shadcn/ui", "shadcn ui", "copilot", "chatgpt", "claude", "gemini", "llama", "deepseek",
    "linear", "stripe", "loom", "figma", "canva", "notion"
}


def is_valid_brand_for_search(name: str) -> bool:
    """
    Check if the brand name is high-confidence and not a generic tech term or direct domain.
    If it contains a dot, it's already a domain/URL so we bypass Serper search.
    """
    name_lower = name.lower().strip()
    if not name_lower or len(name_lower) < 2:
        return False
        
    # If it contains a dot, it's already a domain. We handle it directly without Serper.
    if "." in name_lower:
        return False
        
    if name_lower in GENERIC_TECH_TERMS:
        return False
        
    # Skip if name is just numbers or special characters
    if re.match(r"^\d+$", name_lower):
        return False
        
    return True


def serper_search(brand_name: str) -> str | None:
    """
    Search Serper API for the official website of the given brand name.
    Filters out social media, profiles, and low-confidence pages.
    """
    api_key = os.getenv("SERPER_API_KEY")
    if not api_key:
        logger.warning("SERPER_API_KEY not found in environment variables. Skipping Serper search.")
        return None

    url = "https://google.serper.dev/search"
    headers = {
        "X-API-KEY": api_key,
        "Content-Type": "application/json"
    }
    
    clean_brand = brand_name.strip()
    if not clean_brand:
        return None
        
    logger.info(f"Serper API search for brand: '{clean_brand}'")
    
    # We query the brand name.
    import urllib.request
    import urllib.parse
    payload = json.dumps({"q": clean_brand, "num": 4}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            organic = res_data.get("organic", [])
            for result in organic:
                link = result.get("link")
                if not link:
                    continue
                
                link_lower = link.lower()
                
                # Useless links / Social media domains that aren't the official brand page
                social_domains = [
                    "instagram.com", "twitter.com", "x.com", "facebook.com", 
                    "threads.net", "tiktok.com", "youtube.com", "linkedin.com",
                    "pinterest.com", "reddit.com", "medium.com", "behance.net",
                    "dribbble.com"
                ]
                
                if any(domain in link_lower for domain in social_domains):
                    continue
                
                # Verify link format
                if not (link_lower.startswith("http://") or link_lower.startswith("https://")):
                    continue
                    
                # Skip subpages that are clearly not homepages/resource pages
                if any(x in link_lower for x in ["/login", "/signup", "/terms", "/privacy", "/policy", "/cookie"]):
                    continue
                    
                return link
    except Exception as e:
        logger.error(f"Serper search failed for '{brand_name}': {e}")
    return None


def seconds_to_srt_time(seconds: float) -> str:
    """Converts seconds to SRT timestamp format (HH:MM:SS,mmm)"""
    if seconds is None:
        seconds = 0
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02}:{minutes:02}:{secs:02},{millis:03}"


def find_evidence_in_whisper_chunks(chunks: list, term: str, caption: str = "", ocr_text: str = "") -> dict:
    term_lower = term.lower().strip()
    if not term_lower:
        return {"evidence_text": "", "timestamp_start": None, "timestamp_end": None, "is_transcript": False, "is_caption": False, "is_ocr": False}
        
    best_chunk = None
    best_index = -1
    
    # 1. Check Whisper Chunks
    if chunks:
        # Exact substring search in chunks
        for idx, chunk in enumerate(chunks):
            chunk_text = chunk.get("text", "").lower()
            if term_lower in chunk_text:
                best_chunk = chunk
                best_index = idx
                break
                
        # Fuzzy word search in chunks if no exact substring
        if not best_chunk:
            from difflib import SequenceMatcher
            max_ratio = 0.0
            for idx, chunk in enumerate(chunks):
                chunk_text = chunk.get("text", "").lower()
                for w in chunk_text.split():
                    w_clean = re.sub(r"[^\w]", "", w)
                    if len(w_clean) >= 3:
                        ratio = SequenceMatcher(None, term_lower, w_clean).ratio()
                        if ratio > 0.82 and ratio > max_ratio:
                            max_ratio = ratio
                            best_chunk = chunk
                            best_index = idx

    if best_chunk:
        ts = best_chunk.get("timestamp") or (0.0, 0.0)
        start_sec = ts[0] if ts[0] is not None else 0.0
        end_sec = ts[1] if ts[1] is not None else 0.0
        start_srt = seconds_to_srt_time(start_sec)
        end_srt = seconds_to_srt_time(end_sec)
        
        # Build context
        context_parts = []
        if best_index > 0:
            context_parts.append(chunks[best_index - 1].get("text", "").strip())
        context_parts.append(best_chunk.get("text", "").strip())
        if best_index < len(chunks) - 1:
            context_parts.append(chunks[best_index + 1].get("text", "").strip())
            
        return {
            "evidence_text": " ".join(context_parts),
            "timestamp_start": start_srt,
            "timestamp_end": end_srt,
            "is_transcript": True,
            "is_caption": False,
            "is_ocr": False
        }

    # 2. Check Caption
    if caption:
        caption_lower = caption.lower()
        if term_lower in caption_lower:
            for line in caption.split("\n"):
                if term_lower in line.lower():
                    return {
                        "evidence_text": f"Caption: {line.strip()}",
                        "timestamp_start": None,
                        "timestamp_end": None,
                        "is_transcript": False,
                        "is_caption": True,
                        "is_ocr": False
                    }

    # 3. Check OCR / Visual Text Content
    if ocr_text:
        ocr_lower = ocr_text.lower()
        if term_lower in ocr_lower:
            for line in ocr_text.split("\n"):
                if term_lower in line.lower():
                    return {
                        "evidence_text": f"Visual Text: {line.strip()}",
                        "timestamp_start": None,
                        "timestamp_end": None,
                        "is_transcript": False,
                        "is_caption": False,
                        "is_ocr": True
                    }

    return {
        "evidence_text": "",
        "timestamp_start": None,
        "timestamp_end": None,
        "is_transcript": False,
        "is_caption": False,
        "is_ocr": False
    }


def check_resource_hallucination(name: str, url: str, transcript: str, caption: str, ocr: str, raw_urls: list, raw_repos: list) -> tuple[bool, str]:
    raw_text = " ".join(filter(None, [transcript, caption, ocr])).lower()
    name_lower = name.lower().strip()
    
    if not name_lower:
        return False, ""
        
    has_name_mention = False
    if name_lower in raw_text:
        has_name_mention = True
    else:
        from difflib import SequenceMatcher
        # Check if the name matches any word fuzzymatching
        for w in raw_text.split():
            w_clean = re.sub(r"[^\w]", "", w)
            if len(w_clean) >= 4:
                if SequenceMatcher(None, name_lower, w_clean).ratio() > 0.8:
                    has_name_mention = True
                    break

    if not has_name_mention:
        return True, "Resource name not found in transcript, caption, or visual text (Resource substitution or AI hallucination)."

    if url:
        url_lower = url.lower().strip()
        all_raw = [r.lower().strip() for r in raw_urls + raw_repos if r]
        
        # Exact match is valid
        if any(url_lower in r for r in all_raw):
            return False, ""
            
        # Check for URL path modification
        from difflib import SequenceMatcher
        for raw in all_raw:
            parsed_raw = urlparse(raw)
            parsed_ai = urlparse(url_lower)
            if parsed_raw.netloc == parsed_ai.netloc and parsed_raw.netloc:
                path_raw = parsed_raw.path.strip("/")
                path_ai = parsed_ai.path.strip("/")
                if path_raw and path_ai and path_raw != path_ai:
                    if SequenceMatcher(None, path_raw, path_ai).ratio() >= 0.75:
                        return True, f"URL path modification detected: '{url}' looks like a hallucinated copy of '{raw}'."

        return True, "URL was generated by AI but not found in the raw inputs."

    return False, ""


def calculate_confidence(hallucination_flag: bool, is_regex: bool, is_transcript: bool, is_ocr: bool, is_caption: bool, has_evidence: bool) -> float:
    if hallucination_flag:
        return 15.0
        
    score = 50.0
    if is_regex:
        score = 95.0
    elif is_ocr and is_transcript:
        score = 92.0
    elif is_transcript:
        score = 85.0
    elif is_ocr:
        score = 80.0
    elif is_caption:
        score = 75.0
        
    if has_evidence:
        score += 5.0
        
    return min(100.0, score)


def convert_to_srt(chunks: list) -> str:
    """Converts Whisper chunks to SRT string"""
    srt_lines = []
    for index, chunk in enumerate(chunks):
        start = chunk["timestamp"][0] or 0
        end = chunk["timestamp"][1] or 0
        text = chunk["text"].strip()

        srt_lines.append(str(index + 1))
        srt_lines.append(f"{seconds_to_srt_time(start)} --> {seconds_to_srt_time(end)}")
        srt_lines.append(text)
        srt_lines.append("")  # blank line
    return "\n".join(srt_lines)


def run_whisper(audio_path: str):
    """Run Whisper transcription. Tries Groq API first for speed, falls back to local pipeline on failure."""
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
            return {
                "text": full_text,
                "chunks": chunks
            }
        except Exception as e:
            logger.warning(f"Groq Whisper transcription failed, falling back to local: {e}")

    # Fallback to local pipeline
    if not pipe:
        logger.error("Local Whisper model is not loaded and Groq transcription was not successful.")
        raise RuntimeError("ASR transcription unavailable: local model not loaded and Groq failed.")

    logger.info(f"Running local Whisper transcription for: {audio_path}")
    result = pipe(
        audio_path, return_timestamps=True, chunk_length_s=30, ignore_warning=True, batch_size=8
    )
    return result


def extract_frames(video_path: str, num_frames: int = 4) -> list:
    """Extract N evenly spaced frames from video as base64 JPEG strings."""
    frames = []

    # Get video duration
    probe_cmd = [
        "ffprobe",
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_streams",
        video_path,
    ]
    try:
        probe_result = subprocess.run(probe_cmd, capture_output=True, text=True)

        info = json.loads(probe_result.stdout)
        duration = float(info["streams"][0].get("duration", 30))
    except:
        duration = 30  # fallback assume 30 sec

    # Extract frames at even intervals
    for i in range(num_frames):
        timestamp = (duration / (num_frames + 1)) * (i + 1)
        frame_path = video_path.replace(".mp4", f"_frame{i}.jpg")

        cmd = [
            "ffmpeg",
            "-ss",
            str(timestamp),
            "-i",
            video_path,
            "-vframes",
            "1",
            "-q:v",
            "2",
            "-y",
            frame_path,
        ]
        subprocess.run(cmd, capture_output=True)

        if os.path.exists(frame_path):
            with open(frame_path, "rb") as f:
                frames.append(
                    {
                        "mime_type": "image/jpeg",
                        "data": base64.b64encode(f.read()).decode(),
                    }
                )
            os.remove(frame_path)  # cleanup frame file

    return frames


def parse_gemini_response(response_text: str) -> dict:
    """
    Parses Gemini's custom formatted string response into a structured dict with:
    - urls_found (list of str)
    - repositories_found (list of str)
    - visible_products_or_websites (list of dict with keys: name, confidence, reason)
    - incidental_mentions (list of str)
    - text_content (str)
    - visual_description (str)
    """
    result = {
        "urls_found": [],
        "repositories_found": [],
        "visible_products_or_websites": [],
        "incidental_mentions": [],
        "text_content": "",
        "visual_description": response_text
    }
    
    if not response_text:
        return result
        
    try:
        headers = [
            "URLS_FOUND:",
            "REPOSITORIES_FOUND:",
            "VISIBLE_PRODUCTS_OR_WEBSITES:",
            "INCIDENTAL_MENTIONS:",
            "POSSIBLE_WEBSITES_OR_TOOLS:",
            "MENTIONED_BRANDS:",
            "TEXT_CONTENT:",
            "VISUAL_DESCRIPTION:"
        ]
        
        # Locate indices of each header
        positions = []
        for header in headers:
            idx = response_text.find(header)
            if idx != -1:
                positions.append((idx, header))
        
        # Sort positions by where they appear in the text
        positions.sort()
        
        # Extract content between headers
        sections = {}
        for i in range(len(positions)):
            start_idx, header = positions[i]
            content_start = start_idx + len(header)
            if i + 1 < len(positions):
                end_idx = positions[i+1][0]
                content = response_text[content_start:end_idx].strip()
            else:
                content = response_text[content_start:].strip()
            sections[header] = content
            
        # 1. Extract URLs
        if "URLS_FOUND:" in sections:
            urls_raw = sections["URLS_FOUND:"]
            if urls_raw.lower().strip() not in ["none", "none.", ""]:
                for line in urls_raw.split("\n"):
                    line = line.strip().strip("-•*").strip()
                    if line and len(line) > 4 and "." in line:
                        if not line.startswith("http"):
                            full_url = "https://" + line
                        else:
                            full_url = line
                        if is_valid_extracted_url(full_url) and full_url not in result["urls_found"]:
                            result["urls_found"].append(full_url)
                            
        # 2. Extract Repositories
        if "REPOSITORIES_FOUND:" in sections:
            repos_raw = sections["REPOSITORIES_FOUND:"]
            if repos_raw.lower().strip() not in ["none", "none.", ""]:
                for line in repos_raw.split("\n"):
                    line = line.strip().strip("-•*").strip()
                    if line and len(line) > 4:
                        lower_line = line.lower()
                        if "github.com/" in lower_line or "gitlab.com/" in lower_line:
                            if not line.startswith("http"):
                                line = "https://" + line
                            if line not in result["repositories_found"]:
                                result["repositories_found"].append(line)
                        elif "/" in line and not line.startswith("http") and " " not in line:
                            parts_slash = [p for p in line.split("/") if p]
                            if len(parts_slash) >= 2 and all(re.match(r"^[a-zA-Z0-9_.-]+$", p) for p in parts_slash[:2]):
                                repo_url = f"https://github.com/{parts_slash[0]}/{parts_slash[1]}"
                                if repo_url not in result["repositories_found"]:
                                    result["repositories_found"].append(repo_url)
                                
        # 3. Extract Visible Products Or Websites (Name | Confidence | Reason)
        # Fallback to POSSIBLE_WEBSITES_OR_TOOLS or MENTIONED_BRANDS if VISIBLE_PRODUCTS_OR_WEBSITES is missing
        products_raw = None
        if "VISIBLE_PRODUCTS_OR_WEBSITES:" in sections:
            products_raw = sections["VISIBLE_PRODUCTS_OR_WEBSITES:"]
        elif "POSSIBLE_WEBSITES_OR_TOOLS:" in sections:
            products_raw = sections["POSSIBLE_WEBSITES_OR_TOOLS:"]
        elif "MENTIONED_BRANDS:" in sections:
            products_raw = sections["MENTIONED_BRANDS:"]

        if products_raw and products_raw.lower().strip() not in ["none", "none.", ""]:
            for line in products_raw.split("\n"):
                line = line.strip().strip("-•*").strip()
                if not line:
                    continue
                # Parse pipe format if available
                parts = line.split("|")
                if len(parts) >= 2:
                    name = parts[0].strip()
                    confidence_str = parts[1].strip()
                    reason = parts[2].strip() if len(parts) > 2 else "No reasoning provided."
                    try:
                        confidence_str_clean = re.sub(r"[^\d\.]", "", confidence_str)
                        confidence = float(confidence_str_clean)
                        if confidence > 1.0:
                            confidence = confidence / 100.0
                    except:
                        confidence = 0.5
                        
                    if name and name.lower() not in ["none", ""]:
                        result["visible_products_or_websites"].append({
                            "name": name,
                            "confidence": confidence,
                            "reason": reason
                        })
                else:
                    name = line.strip()
                    if name and name.lower() not in ["none", ""]:
                        is_domain = "." in name
                        default_conf = 0.9 if is_domain else 0.7
                        result["visible_products_or_websites"].append({
                            "name": name,
                            "confidence": default_conf,
                            "reason": "Extracted from legacy format / list fallback."
                        })

        # 4. Extract Incidental Mentions
        if "INCIDENTAL_MENTIONS:" in sections:
            incidental_raw = sections["INCIDENTAL_MENTIONS:"]
            if incidental_raw.lower().strip() not in ["none", "none.", ""]:
                for line in incidental_raw.split("\n"):
                    line = line.strip().strip("-•*").strip()
                    if line and len(line) > 1:
                        line = line.strip(" '\"`(),.[]")
                        if line and line not in result["incidental_mentions"]:
                            result["incidental_mentions"].append(line)
                            
        # 5. Extract text content
        if "TEXT_CONTENT:" in sections:
            result["text_content"] = sections["TEXT_CONTENT:"]
            
        # 6. Extract visual description
        if "VISUAL_DESCRIPTION:" in sections:
            result["visual_description"] = sections["VISUAL_DESCRIPTION:"]
            
    except Exception as e:
        logger.warning(f"Error parsing Gemini response: {e}")
        
    return result


def generate_content_with_retry(client, contents, model="gemini-2.5-flash-lite", max_retries=4, initial_delay=2.0):
    """Wrapper around generate_content that implements exponential backoff retries for transient errors."""
    delay = initial_delay
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=model,
                contents=contents
            )
            return response
        except Exception as e:
            err_msg = str(e)
            is_transient = any(term in err_msg for term in ["503", "UNAVAILABLE", "429", "RESOURCE_EXHAUSTED"]) or "temporary" in err_msg.lower() or "overloaded" in err_msg.lower()
            
            if is_transient and attempt < max_retries - 1:
                logger.warning(f"Gemini API request failed (attempt {attempt + 1}/{max_retries}) with error: {err_msg}. Retrying in {delay}s...")
                time.sleep(delay)
                delay *= 2.0  # exponential backoff
            else:
                logger.error(f"Gemini API request failed permanently on attempt {attempt + 1}/{max_retries}: {err_msg}")
                raise e


def run_gemini_analysis(video_path: str) -> dict:
    """
    Extract frames every 2 seconds for complete coverage.
    Special focus on text/URLs and brands visible on screen.
    """
    if not os.path.exists(video_path):
        return {
            "urls_found": [],
            "mentioned_brand_names": [],
            "text_content": "",
            "visual_description": "Video file not available"
        }

    try:
        # Get exact video duration
        probe = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json",
             "-show_streams", video_path],
            capture_output=True, text=True
        )
        duration = 15.0  # default
        try:
            info = json.loads(probe.stdout)
            for stream in info.get("streams", []):
                if stream.get("codec_type") == "video":
                    duration = float(stream.get("duration", 15))
                    break
        except:
            pass

        logger.info(f"Video duration: {duration:.1f}s — extracting frames every 2s")

        # Extract frame every 2 seconds — no important moment missed
        parts = []
        timestamp = 0.5  # start from 0.5s (skip black first frame)
        frame_count = 0

        while timestamp < duration and frame_count < 20:  # max 20 frames
            frame_path = video_path.replace(".mp4", f"_f{frame_count}.jpg")
            result = subprocess.run(
                ["ffmpeg", "-ss", str(timestamp), "-i", video_path,
                 "-vframes", "1", "-q:v", "2", "-y", frame_path],
                capture_output=True
            )
            if os.path.exists(frame_path):
                with open(frame_path, "rb") as f:
                    img_bytes = f.read()
                parts.append(
                    types.Part.from_bytes(
                        data=img_bytes,
                        mime_type="image/jpeg"
                    )
                )
                os.remove(frame_path)
                frame_count += 1

            timestamp += 2.0  # every 2 seconds

        if not parts:
            return {
                "urls_found": [],
                "repositories_found": [],
                "visible_products_or_websites": [],
                "incidental_mentions": [],
                "text_content": "",
                "visual_description": "Could not extract frames from video"
            }

        logger.info(f"Extracted {frame_count} frames for Gemini analysis")

        # URL and brand-focused analysis prompt
        parts.append(types.Part.from_text(text="""
Analyze ALL these video frames carefully in sequence. These are from an Instagram Reel.
Perform a production-grade visual product intelligence assessment.

TASK 1 — URL DETECTION (High Confidence):
- Pay extremely close attention to the bottom/top overlay text, watermarks, browser URL address bars, code file contents showing URLs, or any embedded QR codes/links.
- Extract EXACTLY and ONLY real website URLs or domains physically visible on the screen.
- Do NOT complete, infer, guess, or hallucinate URLs. If a URL/domain name is not physically visible on the screen, do NOT list it.
- Never guess a TLD (like .com, .io, .dev) if it's not visible.
- If you see a brand name or keyword but no actual URL, do NOT list it here (list it under VISIBLE_PRODUCTS_OR_WEBSITES instead).
- Format: one URL/domain per line. If none are physically visible, write "none".

TASK 2 — REPOSITORIES DETECTION:
- Extract any GitLab/GitHub repositories physically visible on screen (e.g., github.com/user/repo).
- Do NOT guess repository names. If none, write "none".

TASK 3 — VISIBLE PRODUCTS OR WEBSITES (Central Focus & Intent Analysis):
- Identify products, websites, apps, or SaaS tools that are actively demonstrated, shown, or used on screen, or are the central focus of the scene (e.g. browser showing a dashboard, screen recording, dashboard UI, tool workspace).
- For each product, assign a confidence score between 0.0 and 1.0 (where 0.9+ means the app UI/dashboard is clearly demonstrated or active on screen; 0.7-0.8 means the product logo or browser tab is visible; <=0.6 means the product is only passively shown as a passing reference).
- Provide a brief reason for the product presence and confidence score.
- STRICT RULE: Format each line EXACTLY as: Name | Confidence | Reason
- Example: Retool | 0.95 | Dashboard UI shown as creator designs an app canvas

TASK 4 — INCIDENTAL MENTIONS (No Search):
- Identify any incidental keywords, supporting technologies, frameworks, libraries (e.g. React, HTML, CSS, JavaScript, Python, Tailwind, etc.), subtitles, or educational overlay text.
- These are secondary details, framework badges, code snippets, or generic mentions that are NOT actively demonstrated as a product UI or a website.
- List each name on a separate line. If none, write "none".

TASK 5 — VISUAL DESCRIPTION:
- Provide a clear, detailed, frame-by-frame visual summary explaining the topic of the video and what actions/UIs are being demonstrated.

Format your response EXACTLY like this:
URLS_FOUND:
[one per line, or "none"]
REPOSITORIES_FOUND:
[one per line, or "none"]
VISIBLE_PRODUCTS_OR_WEBSITES:
[Format: Name | Confidence | Reason (or "none")]
INCIDENTAL_MENTIONS:
[one per line, or "none"]
VISUAL_DESCRIPTION:
[detailed description]
"""))

        response = generate_content_with_retry(
            gemini_client,
            contents=[types.Content(parts=parts, role="user")]
        )

        return parse_gemini_response(response.text)

    except Exception as e:
        logger.error(f"Gemini analysis failed: {str(e)}")
        return {
            "urls_found": [],
            "repositories_found": [],
            "visible_products_or_websites": [],
            "incidental_mentions": [],
            "text_content": "",
            "visual_description": "Visual analysis unavailable"
        }


# --- FastAPI Lifespan ---


@asynccontextmanager
async def lifespan(app: FastAPI):
    global pipe, embedder, groq_client, gemini_model, gemini_client
    try:
        logger.info("==================================")
        logger.info("🚀 Initializing SuperBrain AI Layer")
        logger.info("==================================")

        # 1. Device Selection
        device = 0 if torch.cuda.is_available() else -1
        device_name = "GPU (CUDA)" if device == 0 else "CPU"
        logger.info(f"🖥️ Target Device: {device_name}")

        # 2. Load Whisper (ASR)
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

        # 3. Load Sentence Transformer (Embeddings)
        logger.info("⏳ Loading Sentence Transformer (all-MiniLM-L6-v2)...")
        embedder = SentenceTransformer("all-MiniLM-L6-v2")
        if device == 0:
            embedder.to("cuda")
        logger.info("✅ Embedding Model Loaded")

        # 4. Groq Setup
        groq_api_key = os.getenv("GROQ_API_KEY")
        if not groq_api_key:
            logger.warning("⚠️ GROQ_API_KEY missing from .env!")
        groq_client = Groq(api_key=groq_api_key)
        logger.info("✅ Groq Client Ready")

        # 5. Gemini Setup
        gemini_api_key = os.getenv("GEMINI_API_KEY")
        if not gemini_api_key:
            logger.warning("⚠️ GEMINI_API_KEY missing from .env!")
        else:
            gemini_client = genai.Client(api_key=gemini_api_key)
            logger.info("✅ Gemini Client Initialized (New SDK)")

        logger.info("==================================")
        logger.info("🔥 AI Server Fully Operational")
        logger.info("==================================")

    except Exception as e:
        logger.error(f"❌ CRITICAL STARTUP ERROR: {str(e)}")
        traceback.print_exc()
        raise e

    yield
    logger.info("Shutting down AI Server...")


# --- Models & API ---

app = FastAPI(lifespan=lifespan, title="SuperBrain AI Layer", version="2.0.0")


class TranscribeRequest(BaseModel):
    audio_path: str


class AnalyzeRequest(BaseModel):
    reel_id: str
    caption: str = ""
    caption_urls: list = []
    content_mode: str = "video"   # "video" | "single_image" | "image_carousel"
    # Video mode fields
    audio_path: str = ""
    video_path: str = ""
    # Image mode fields
    image_paths: list = []
    bypass_cache: bool = False


class EmbedRequest(BaseModel):
    text: str


class ChatContextItem(BaseModel):
    title: str = ""
    summary: str = ""
    instagram_url: str = ""
    author_username: str = ""
    plain_text: str = ""
    how_to_guide: dict = None


class ChatRequest(BaseModel):
    query: str
    context: list[ChatContextItem]


class MindMapRequest(BaseModel):
    title: str
    summary: str
    key_takeaways: list[str] = []
    plain_text: str = ""
    detail_level: str = "moderate"


# ---------------------------------------------------------
# ENDPOINT: Basic Transcription (Legacy Compatibility)
# ---------------------------------------------------------
@app.post("/transcribe")
async def transcribe(req: TranscribeRequest):
    """Simple transcription endpoint. Runs blocking code in thread."""
    loop = asyncio.get_event_loop()

    # Run heavy computation in a thread pool to avoid blocking the event loop
    result = await loop.run_in_executor(
        None, run_whisper, req.audio_path
    )

    srt = convert_to_srt(result["chunks"])
    return {"plain_text": result["text"], "srt": srt}


def run_gemini_single_image(image_path: str) -> dict:
    """Analyze a single photo post using Gemini Vision."""
    if not os.path.exists(image_path):
        return {
            "urls_found": [],
            "repositories_found": [],
            "visible_products_or_websites": [],
            "incidental_mentions": [],
            "text_content": "",
            "visual_description": "Image file not available"
        }

    try:
        with open(image_path, "rb") as f:
            img_bytes = f.read()

        ext = image_path.lower().split(".")[-1]
        mime = "image/jpeg" if ext in ["jpg", "jpeg"] else \
               "image/png" if ext == "png" else "image/webp"

        parts = [
            types.Part.from_bytes(data=img_bytes, mime_type=mime),
            types.Part.from_text(text="""
Analyze this Instagram photo post carefully.
Perform a production-grade visual product intelligence assessment.

TASK 1 — URL DETECTION (High Confidence):
- Pay extremely close attention to the bottom/top overlay text, watermarks, browser URL address bars, code file contents showing URLs, or any embedded QR codes/links.
- Extract EXACTLY and ONLY real website URLs or domains physically visible on the screen.
- Do NOT complete, infer, guess, or hallucinate URLs. If a URL/domain name is not physically visible on the screen, do NOT list it.
- Never guess a TLD (like .com, .io, .dev) if it's not visible.
- If you see a brand name or keyword but no actual URL, do NOT list it here (list it under VISIBLE_PRODUCTS_OR_WEBSITES instead).
- Format: one URL/domain per line. If none are physically visible, write "none".

TASK 2 — REPOSITORIES DETECTION:
- Extract any GitLab/GitHub repositories physically visible on screen (e.g., github.com/user/repo).
- Do NOT guess repository names. If none, write "none".

TASK 3 — VISIBLE PRODUCTS OR WEBSITES (Central Focus & Intent Analysis):
- Identify products, websites, apps, or SaaS tools that are actively demonstrated, shown, or used on screen, or are the central focus of the scene (e.g. browser showing a dashboard, screen recording, dashboard UI, tool workspace).
- For each product, assign a confidence score between 0.0 and 1.0 (where 0.9+ means the app UI/dashboard is clearly demonstrated or active on screen; 0.7-0.8 means the product logo or browser tab is visible; <=0.6 means the product is only passively shown as a passing reference).
- Provide a brief reason for the product presence and confidence score.
- STRICT RULE: Format each line EXACTLY as: Name | Confidence | Reason
- Example: Retool | 0.95 | Dashboard UI shown as creator designs an app canvas

TASK 4 — INCIDENTAL MENTIONS (No Search):
- Identify any incidental keywords, supporting technologies, frameworks, libraries (e.g. React, HTML, CSS, JavaScript, Python, Tailwind, etc.), subtitles, or educational overlay text.
- These are secondary details, framework badges, code snippets, or generic mentions that are NOT actively demonstrated as a product UI or a website.
- List each name on a separate line. If none, write "none".

TASK 5 — READ ALL TEXT:
- Extract and read ALL readable text visible in the image.
- Headings, body text, labels, captions, overlays.

TASK 6 — DESCRIBE THE IMAGE:
- What is visually shown in this image and what is its overall topic or message?

Format EXACTLY like this (no deviation):
URLS_FOUND:
[one per line, or "none"]
REPOSITORIES_FOUND:
[one per line, or "none"]
VISIBLE_PRODUCTS_OR_WEBSITES:
[Format: Name | Confidence | Reason (or "none")]
INCIDENTAL_MENTIONS:
[one per line, or "none"]
TEXT_CONTENT:
[all readable text from the image]
VISUAL_DESCRIPTION:
[overall description of the image and its topic]
""")]

        response = generate_content_with_retry(
            gemini_client,
            contents=[types.Content(parts=parts, role="user")]
        )
        return parse_gemini_response(response.text)

    except Exception as e:
        logger.error(f"Single image analysis failed: {str(e)}")
        return {
            "urls_found": [],
            "repositories_found": [],
            "visible_products_or_websites": [],
            "incidental_mentions": [],
            "text_content": "",
            "visual_description": "Visual analysis unavailable"
        }


def run_gemini_image_carousel(image_paths: list) -> dict:
    """Analyze multiple carousel images/slides using Gemini Vision."""
    if not image_paths:
        return {
            "urls_found": [],
            "repositories_found": [],
            "visible_products_or_websites": [],
            "incidental_mentions": [],
            "text_content": "",
            "visual_description": "No images available"
        }

    try:
        parts = []

        for img_path in image_paths[:25]:  # max 25 slides
            if not os.path.exists(img_path):
                continue
            with open(img_path, "rb") as f:
                img_bytes = f.read()

            ext = img_path.lower().split(".")[-1]
            mime = "image/jpeg" if ext in ["jpg", "jpeg"] else \
                   "image/png" if ext == "png" else "image/webp"

            parts.append(types.Part.from_bytes(data=img_bytes, mime_type=mime))

        if not parts:
            return {
                "urls_found": [],
                "repositories_found": [],
                "visible_products_or_websites": [],
                "incidental_mentions": [],
                "text_content": "",
                "visual_description": "Could not read carousel images"
            }

        parts.append(types.Part.from_text(text="""
These are slides from an Instagram carousel post, in order.
Analyze ALL slides carefully.
Perform a production-grade visual product intelligence assessment.

TASK 1 — URL DETECTION (High Confidence):
- Pay extremely close attention to the bottom/top overlay text, watermarks, browser URL address bars, code file contents showing URLs, or any embedded QR codes/links.
- Extract EXACTLY and ONLY real website URLs or domains physically visible on the screen.
- Do NOT complete, infer, guess, or hallucinate URLs. If a URL/domain name is not physically visible on the screen, do NOT list it.
- Never guess a TLD (like .com, .io, .dev) if it's not visible.
- If you see a brand name or keyword but no actual URL, do NOT list it here (list it under VISIBLE_PRODUCTS_OR_WEBSITES instead).
- Format: one URL/domain per line. If none are physically visible, write "none".

TASK 2 — REPOSITORIES DETECTION:
- Extract any GitLab/GitHub repositories physically visible on screen (e.g., github.com/user/repo).
- Do NOT guess repository names. If none, write "none".

TASK 3 — VISIBLE PRODUCTS OR WEBSITES (Central Focus & Intent Analysis):
- Identify products, websites, apps, or SaaS tools that are actively demonstrated, shown, or used on screen, or are the central focus of the scene (e.g. browser showing a dashboard, screen recording, dashboard UI, tool workspace).
- For each product, assign a confidence score between 0.0 and 1.0 (where 0.9+ means the app UI/dashboard is clearly demonstrated or active on screen; 0.7-0.8 means the product logo or browser tab is visible; <=0.6 means the product is only passively shown as a passing reference).
- Provide a brief reason for the product presence and confidence score.
- STRICT RULE: Format each line EXACTLY as: Name | Confidence | Reason
- Example: Retool | 0.95 | Dashboard UI shown as creator designs an app canvas

TASK 4 — INCIDENTAL MENTIONS (No Search):
- Identify any incidental keywords, supporting technologies, frameworks, libraries (e.g. React, HTML, CSS, JavaScript, Python, Tailwind, etc.), subtitles, or educational overlay text.
- These are secondary details, framework badges, code snippets, or generic mentions that are NOT actively demonstrated as a product UI or a website.
- List each name on a separate line. If none, write "none".

TASK 5 — READ ALL TEXT FROM ALL SLIDES:
- Extract ALL text from every slide in order.
- Headings, descriptions, bullet points, labels.
- Labeled by slide number: [Slide 1], [Slide 2], etc.

TASK 6 — DESCRIBE THE CAROUSEL:
- What is the overall topic of this carousel post?
- What is each slide about (brief per-slide summary)?

Format EXACTLY like this (no deviation):
URLS_FOUND:
[one per line, or "none"]
REPOSITORIES_FOUND:
[one per line, or "none"]
VISIBLE_PRODUCTS_OR_WEBSITES:
[Format: Name | Confidence | Reason (or "none")]
INCIDENTAL_MENTIONS:
[one per line, or "none"]
TEXT_CONTENT:
[all text from all slides, labeled by slide number]
VISUAL_DESCRIPTION:
[overall topic and per-slide summary]
"""))

        response = generate_content_with_retry(
            gemini_client,
            contents=[types.Content(parts=parts, role="user")]
        )
        return parse_gemini_response(response.text)

    except Exception as e:
        logger.error(f"Carousel image analysis failed: {str(e)}")
        return {
            "urls_found": [],
            "repositories_found": [],
            "visible_products_or_websites": [],
            "incidental_mentions": [],
            "text_content": "",
            "visual_description": "Visual analysis unavailable"
        }


# ---------------------------------------------------------
# ENDPOINT: Full Pipeline (Robust & Non-Blocking)
# ---------------------------------------------------------
@app.post("/analyze_reel")
async def analyze_reel(req: AnalyzeRequest):
    """
    Complete AI Pipeline:
    1. Caching Check
    2. Validation
    3. Transcription & Visual Analysis (Parallel Non-blocking)
    4. LLM Metadata Extraction (With timeout)
    5. Vector Embeddings (Non-blocking)
    """
    # Check cache first using reel_id hash unless bypassed
    if not req.bypass_cache:
        cached_res = get_cached_response(req.reel_id)
        if cached_res is not None:
            return cached_res

    import time
    pipeline_start = time.time()
    groq_error = None

    logger.info(f"[{req.reel_id}] Mode: {req.content_mode} | "
                f"Audio: {req.audio_path or 'none'} | "
                f"Images: {len(req.image_paths)}")

    loop = asyncio.get_event_loop()

    # ================================================================
    # ROUTE BY CONTENT MODE
    # ================================================================

    # ================================================================
    # ROUTE BY CONTENT MODE
    # ================================================================

    visual_desc_clean = ""
    gemini_urls = []
    repositories_found = []
    visible_products_or_websites = []
    incidental_mentions = []
    gemini_text_content = ""
    plain_text = ""
    srt = ""
    whisper_result = {"text": "", "chunks": []}

    if req.content_mode == "single_image":
        # --- Single Photo Post ---
        logger.info(f"[{req.reel_id}] Single image mode")

        if not req.image_paths:
            raise HTTPException(status_code=400, detail="No image path provided")

        gemini_res = await loop.run_in_executor(
            None, run_gemini_single_image, req.image_paths[0]
        )
        visual_desc_clean = gemini_res.get("visual_description", "")
        gemini_urls = gemini_res.get("urls_found", [])
        repositories_found = gemini_res.get("repositories_found", [])
        visible_products_or_websites = gemini_res.get("visible_products_or_websites", [])
        incidental_mentions = gemini_res.get("incidental_mentions", [])
        gemini_text_content = gemini_res.get("text_content", "")
        plain_text = gemini_text_content
        srt = ""

    elif req.content_mode == "image_carousel":
        # --- Image Carousel Post ---
        logger.info(f"[{req.reel_id}] Image carousel mode — {len(req.image_paths)} slides")

        gemini_res = await loop.run_in_executor(
            None, run_gemini_image_carousel, req.image_paths
        )
        visual_desc_clean = gemini_res.get("visual_description", "")
        gemini_urls = gemini_res.get("urls_found", [])
        repositories_found = gemini_res.get("repositories_found", [])
        visible_products_or_websites = gemini_res.get("visible_products_or_websites", [])
        incidental_mentions = gemini_res.get("incidental_mentions", [])
        gemini_text_content = gemini_res.get("text_content", "")
        plain_text = gemini_text_content
        srt = ""

    else:
        # --- Video / Reel (default) ---
        logger.info(f"[{req.reel_id}] Video mode — running Whisper + Gemini in parallel")
        
        # Audio handling (allow silent videos)
        whisper_future = None
        if req.audio_path and os.path.exists(req.audio_path):
            whisper_future = loop.run_in_executor(None, run_whisper, req.audio_path)
        else:
            logger.info(f"[{req.reel_id}] No valid audio path provided. Assuming silent video.")

        gemini_future = loop.run_in_executor(None, run_gemini_analysis, req.video_path)

        whisper_result = {"text": "", "chunks": []}
        gemini_res = {
            "urls_found": [],
            "repositories_found": [],
            "visible_products_or_websites": [],
            "incidental_mentions": [],
            "text_content": "",
            "visual_description": "Visual analysis failed or timed out"
        }

        try:
            if whisper_future:
                whisper_result, gemini_res = await asyncio.gather(
                    whisper_future, gemini_future
                )
            else:
                gemini_res = await gemini_future
        except Exception as e:
            logger.error(f"[{req.reel_id}] Parallel processing failed: {str(e)}")

        plain_text = whisper_result.get("text", "").strip()
        if plain_text.lower() in ["nan", "none", "null", ""]:
            plain_text = ""
        srt = convert_to_srt(whisper_result.get("chunks", []))

        visual_desc_clean = gemini_res.get("visual_description", "")
        gemini_urls = gemini_res.get("urls_found", [])
        repositories_found = gemini_res.get("repositories_found", [])
        visible_products_or_websites = gemini_res.get("visible_products_or_websites", [])
        incidental_mentions = gemini_res.get("incidental_mentions", [])

    # Filter brand names to only search for high-confidence/domain-like brands using Serper API in parallel
    resolved_brand_urls = []
    brands_to_resolve = []
    
    for product in visible_products_or_websites:
        name = product.get("name", "").strip()
        confidence = product.get("confidence", 0.0)
        
        if not name:
            continue
            
        # Domain-First: If name contains a dot, it's already a domain/URL. Bypass Serper search!
        if "." in name:
            formatted_url = name
            if not formatted_url.startswith("http"):
                formatted_url = "https://" + formatted_url
            if is_valid_extracted_url(formatted_url):
                logger.info(f"[{req.reel_id}] Direct domain detected: '{name}'. Adding directly to resolved URLs.")
                if formatted_url not in resolved_brand_urls:
                    resolved_brand_urls.append(formatted_url)
            continue
            
        # Ignore List: Filter out generic tech keywords
        if name.lower().strip() in GENERIC_TECH_TERMS:
            logger.info(f"[{req.reel_id}] Ignoring generic tech term '{name}' from Serper search.")
            continue
            
        # Confidence threshold: Must be >= 0.75 to query Serper
        if confidence >= 0.75:
            brands_to_resolve.append(name)
            logger.info(f"[{req.reel_id}] Brand '{name}' confidence {confidence} is >= 0.75. Adding to Serper search list.")
        else:
            logger.info(f"[{req.reel_id}] Product '{name}' confidence {confidence} is below threshold 0.75. Skipping Serper.")
            
    if brands_to_resolve:
        logger.info(f"[{req.reel_id}] Resolving {len(brands_to_resolve)} brand name URLs via Serper...")
        tasks = []
        for brand in brands_to_resolve:
            tasks.append(loop.run_in_executor(None, serper_search, brand))
            
        try:
            serper_results = await asyncio.gather(*tasks)
            for idx, resolved_url in enumerate(serper_results):
                brand_name = brands_to_resolve[idx]
                if resolved_url:
                    logger.info(f"[{req.reel_id}] Serper resolved brand '{brand_name}' -> {resolved_url}")
                    if resolved_url not in resolved_brand_urls:
                        resolved_brand_urls.append(resolved_url)
                else:
                    logger.info(f"[{req.reel_id}] Serper could not resolve brand '{brand_name}'")
        except Exception as serper_err:
            logger.error(f"[{req.reel_id}] Serper batch search failed: {serper_err}")

    # For image modes: use OCR text for Groq context but save short summary to DB
    groq_context_text = plain_text  # default: for video mode, same as plain_text

    if req.content_mode in ["single_image", "image_carousel"] and gemini_text_content:
        groq_context_text = gemini_text_content  # full OCR for Groq — better context
        plain_text = ""  # will be set to short summary after metadata generation

    _slide_count = len(req.image_paths) if req.content_mode == "image_carousel" else 0
    _takeaway_instruction = (
        "Generate between 4 to 8 of the MOST important and useful key takeaways from the entire carousel. Prioritize quality over quantity."
        if _slide_count > 1
        else "Write EXACTLY 3 to 4 takeaways — no more, no less."
    )

    # 3. Handle Empty Transcript + Missing Visuals
    _check_text = groq_context_text if req.content_mode in ["single_image", "image_carousel"] else plain_text
    is_transcript_empty = len(_check_text.strip()) < 10
    is_visual_unavailable = (
        "unavailable" in visual_desc_clean.lower()
        or "not available" in visual_desc_clean.lower()
        or "failed" in visual_desc_clean.lower()
        or len(visual_desc_clean) < 10
    )

    if is_transcript_empty and is_visual_unavailable:
        logger.warning(
            f"[{req.reel_id}] Both transcript and visuals are missing. Returning fallback."
        )
        return {
            "success": False,
            "error": "Both transcript and visuals are missing",
            "transcript": {"plain_text": plain_text, "srt": srt},
            "visual_description": visual_desc_clean,
            "metadata": {
                "title": "Short Video / No Content",
                "summary": "The audio is too short and visual analysis failed.",
                "key_takeaways": [],
                "tags": ["short", "no-content"],
                "content_type": "Unknown",
                "mentioned_tools_or_websites": [],
                "telegram_bots_mentioned": [],
                "extracted_urls": [],
                "language_detected": "Unknown",
            },
            "repositories_found": [],
            "visible_products_or_websites": [],
            "incidental_mentions": [],
            "embedding": [0.0] * 384,
        }

    # 4. Step: Metadata Extraction via Groq (LLM)
    # For image posts, groq_context_text has OCR content; for video, same as plain_text
    _transcript_for_groq = groq_context_text if req.content_mode in ["single_image", "image_carousel"] else plain_text

    prompt = f"""
    You are analyzing an Instagram Reel/Post to extract structured, high-value information for a knowledge management app.

    You have the following sources of information:

    AUDIO TRANSCRIPT (what was spoken or text extracted from images):
    {_transcript_for_groq if _transcript_for_groq and len(_transcript_for_groq.strip()) > 10 else "No speech detected — background music or silence only"}

    VISUAL ANALYSIS (what was seen in the video):
    {visual_desc_clean}

    INSTAGRAM CAPTION (posted by creator):
    {req.caption if req.caption else "No caption available"}

    POTENTIAL URLS, REPOSITORIES AND BRANDS DETECTED:
    - Caption URLs: {req.caption_urls}
    - Visually Detected URLs (from screen): {gemini_urls}
    - Visually Detected Repositories: {repositories_found}
    - Visually Detected Products & Websites: {[p['name'] for p in visible_products_or_websites]}
    - Serper Resolved Brand/Website URLs: {resolved_brand_urls}
    - Incidental Mentions: {incidental_mentions}

    ---

    IMPORTANT RULES:

    1. KEY TAKEAWAYS must be written from the USER'S PERSPECTIVE — what can they DO, LEARN, or GET from this content?
       - WRONG style: "The video explains that OpenAI gives 250K tokens"
       - RIGHT style: "You can get 250K free daily tokens from OpenAI by enabling data sharing in settings"
       - Each takeaway = one specific, actionable insight the user can act on
       - Maximum 8 takeaways. Each one must be genuinely useful, not filler.

    2. EXTRACTED_URLS — HIGH-VALUE & STRICT DETERMINISTIC RESOLUTION:
       - ONLY return URLs that are explicitly provided in the input lists above ("Caption URLs", "Visually Detected URLs", "Visually Detected Repositories", or "Serper Resolved Brand/Website URLs").
       - Never guess, extrapolate, construct, or hallucinate a URL for a tool name, brand name, or project if it is not present in those lists.
       - Do NOT return social media follow requests like "follow @syntaix.ai", links to personal social media profile pages, or "link in bio" placeholders. If a URL is for a social media platform (like instagram.com, facebook.com, twitter.com, x.com, tiktok.com, youtube.com, etc.) and is NOT a high-value resource/tool, exclude it.
       - If no valid, explicitly provided URLs are in the inputs, return an empty array [].
       - Double-check your list of "extracted_urls": if any URL in your list is not present in one of the input lists, remove it.

    3. CONTENT TYPE — be specific. Use: Tutorial | Recipe | Finance | Tech | Motivation | 
       Fitness | Art | Comedy | News | Review | Lifestyle | Education | other
    4. LANGUAGE — if mixed Hindi+English, return "hinglish". If silent, return "silent".

    Generate ONLY a strict JSON object with no extra text or markdown:
    {{
      "title": "Short smart title max 65 characters — describe what the reel is actually about",
      "summary": "2-4 lines. What is this reel about and why should the user care?",
      "key_takeaways": [
        "{_takeaway_instruction}",
        "Each takeaway = 1-2 sentences from USER perspective: what they can DO or LEARN.",
        "For carousel: each takeaway summarizes a key point/slide. If a takeaway comes from a specific slide, you can optionally mention it naturally (e.g. 'From the pricing slide...' or 'As shown in slide 3...'), but do NOT enforce rigid '[Slide X]' prefix formatting."
      ],
      "tags": ["relevant", "topic", "tags", "max 6"],
      "content_type": "Tutorial | Recipe | Finance | Tech | etc.",
      "mentioned_tools_or_websites": ["Tool or website NAMES only — no URLs here"],
      "telegram_bots_mentioned": ["Name of telegram bot 1", "Name of bot 2 — only if Telegram bots are explicitly mentioned, e.g. 'Multi Saver Bot', else empty array"],
      "extracted_urls": ["https://actual-url.com", "only real, explicitly provided URLs — no fabrication/guesses"],
      "language_detected": "en | hi | gu | hinglish | silent",
      "resources": [
        {{
          "resource_name": "Resource Name (e.g. Supabase, Retool, Cursor)",
          "resource_type": "Website | GitHub Repository | Documentation | YouTube Channel | API | MCP Server | AI Tool | Library | Database | Course | Book | Research Paper",
          "resource_url": "Direct URL ONLY if explicitly provided in the input, otherwise null",
          "description": "Brief description of the resource and its role in the reel"
        }}
      ]
    }}
    """

    try:
        chat_completion = await loop.run_in_executor(
            None,
            partial(
                groq_client.chat.completions.create,
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.3-70b-versatile",
                temperature=0.0,
                response_format={"type": "json_object"},
                timeout=25.0,  # 25 second timeout
            ),
        )

        metadata = json.loads(chat_completion.choices[0].message.content)
        logger.info(f"[{req.reel_id}] Metadata extraction successful.")

    except Exception as e:
        logger.error(f"[{req.reel_id}] Groq Metadata failed: {str(e)}")
        groq_error = f"Groq metadata failed: {str(e)}"
        metadata = {
            "title": "Analysis Timeout",
            "summary": "AI was unable to generate a summary in time.",
            "key_takeaways": [],
            "tags": [],
            "content_type": "Unknown",
            "mentioned_tools_or_websites": [],
            "telegram_bots_mentioned": [],
            "extracted_urls": [],
            "language_detected": "Unknown",
        }

    # For image posts: set plain_text to the AI-generated summary (short, clean) or empty string on failure
    if req.content_mode in ["single_image", "image_carousel"]:
        if metadata.get("title") == "Analysis Timeout":
            plain_text = ""
        else:
            plain_text = metadata.get("summary", "")

    # --- Step 4a: Smart Post-processing of Mentioned Tools & Bot URLs ---
    try:
        extracted_urls = metadata.get("extracted_urls", [])
        if not isinstance(extracted_urls, list):
            extracted_urls = []

        # Merge Serper-resolved brand URLs as a failsafe
        for res_url in resolved_brand_urls:
            if res_url not in extracted_urls:
                extracted_urls.append(res_url)

        # Merge visually detected repositories as a failsafe
        for repo_url in repositories_found:
            if repo_url not in extracted_urls:
                extracted_urls.append(repo_url)

        # Known platform URL patterns
        KNOWN_PLATFORMS = {
            "telegram": "https://t.me/",
            "youtube": "https://youtube.com/",
            "instagram": "https://instagram.com/",
            "github": "https://github.com/",
            "notion": "https://notion.so",
            "figma": "https://figma.com",
            "canva": "https://canva.com",
            "chatgpt": "https://chat.openai.com",
            "claude": "https://claude.ai",
        }

        # Clean and check mentioned tools
        mentioned_tools = metadata.get("mentioned_tools_or_websites", [])
        if not isinstance(mentioned_tools, list):
            mentioned_tools = []

        for tool in list(mentioned_tools):
            tool_lower = tool.lower().strip()
            # If any known platform is in the tool name, add its standard URL if not already present
            for platform, url in KNOWN_PLATFORMS.items():
                if platform in tool_lower:
                    if url not in extracted_urls:
                        extracted_urls.append(url)

        # Process Telegram Bots
        bots_mentioned = metadata.get("telegram_bots_mentioned", [])
        if isinstance(bots_mentioned, list) and bots_mentioned:
            for bot in bots_mentioned:
                bot_clean = bot.strip()
                if bot_clean:
                    # Search instruction display format
                    bot_username = bot_clean.replace(" ", "").replace("@", "")
                    search_instruction = f"Search '@{bot_username}' on Telegram"
                    if search_instruction not in mentioned_tools:
                        mentioned_tools.append(search_instruction)
                    
                    # Direct t.me search link
                    t_me_link = f"https://t.me/{bot_username}"
                    if t_me_link not in extracted_urls:
                        extracted_urls.append(t_me_link)

        # Clean and validate URLs
        cleaned_urls = []
        for url in extracted_urls:
            url = url.strip()
            if not url:
                continue
            
            # Ensure it is a valid format
            if not url.startswith("http"):
                url = "https://" + url
                
            # Filter out social self-promotion / useless links
            url_lower = url.lower()
            
            # Skip instagram reel/post links (self links)
            if "instagram.com" in url_lower and any(x in url_lower for x in ["/reel/", "/p/", "/tv/", "/stories/"]):
                continue
                
            # Skip generic user profiles on social networks if they are just follow calls
            # (e.g. instagram.com/some_creator/ or twitter.com/some_creator/)
            # But keep github.com/user, notion.so/..., t.me/bot...
            is_useless_social = False
            social_domains = ["instagram.com/", "twitter.com/", "x.com/", "facebook.com/", "threads.net/", "tiktok.com/"]
            for dom in social_domains:
                if dom in url_lower:
                    path = url_lower.split(dom)[1].strip("/")
                    # If there's no nested slash, it's just a username/profile
                    if "/" not in path or len(path.split("/")) == 1:
                        is_useless_social = True
                        break
                        
            if is_useless_social:
                logger.info(f"Filtering out social profile link: {url}")
                continue
                
            # Add to list if not duplicate
            if url not in cleaned_urls:
                cleaned_urls.append(url)

        metadata["extracted_urls"] = cleaned_urls
        metadata["mentioned_tools_or_websites"] = mentioned_tools
        logger.info(f"[{req.reel_id}] Smart post-processing completed. Extracted URLs: {cleaned_urls}")

    except Exception as process_err:
        logger.warning(f"[{req.reel_id}] Smart post-processing failed (non-critical): {str(process_err)}")

    # --- Step 4b: Generate How-To Guide (only for actionable content) ---
    how_to_guide = None
    actionable_types = ["tutorial", "recipe", "tech", "finance", "fitness", "education"]
    content_type_lower = metadata.get("content_type", "").lower()
    is_actionable = any(t in content_type_lower for t in actionable_types)

    if is_actionable:
        logger.info(f"[{req.reel_id}] Generating how-to guide...")
        try:
            howto_prompt = f"""
            Based on this Instagram Reel content, create a practical step-by-step guide.

            Title: {metadata.get("title", "")}
            Summary: {metadata.get("summary", "")}
            Key Takeaways: {metadata.get("key_takeaways", [])}
            Audio Transcript: {plain_text[:500] if plain_text else "No speech"}
            Visual Content: {visual_desc_clean[:300]}

            Create a practical how-to guide a user can follow. 

            Generate ONLY a strict JSON object:
            {{
              "how_to_title": "How to [specific action from this reel]",
              "materials_needed": ["item or tool needed 1", "item 2 — only if clearly mentioned, else empty array"],
              "steps": [
                "Step 1: Specific actionable instruction",
                "Step 2: Next instruction",
                "Step 3: Continue...",
                "Maximum 7 steps. Each step must be clear and doable."
              ],
              "estimated_time": "e.g. 5 minutes | 30 minutes | 1 hour — estimate based on content"
            }}
            """
            howto_completion = await loop.run_in_executor(
                None,
                partial(
                    groq_client.chat.completions.create,
                    messages=[{"role": "user", "content": howto_prompt}],
                    model="llama-3.3-70b-versatile",
                    temperature=0.0,
                    response_format={"type": "json_object"},
                    timeout=20.0,
                ),
            )
            how_to_guide = json.loads(howto_completion.choices[0].message.content)
            logger.info(f"[{req.reel_id}] How-to guide generated successfully.")
        except Exception as e:
            logger.warning(
                f"[{req.reel_id}] How-to guide generation failed (non-critical): {str(e)}"
            )
            how_to_guide = None

    # 5. Step: Generate Vector Embeddings (Offloaded to thread)
    try:
        logger.info(f"[{req.reel_id}] Generating embeddings...")
        text_for_embedding = f"{metadata.get('title', '')} {metadata.get('summary', '')} {visual_desc_clean} {plain_text}"

        embedding_tensor = await loop.run_in_executor(
            None, partial(embedder.encode, text_for_embedding)
        )
        embedding = embedding_tensor.tolist()

    except Exception as e:
        logger.error(f"[{req.reel_id}] Embedding failed: {str(e)}")
        embedding = [0.0] * 384

    # --- Step 6: Global Resource Extraction Framework Processing ---
    resources_list = []
    seen_urls = set()
    seen_names = set()
    
    # Process AI-extracted resources
    ai_resources = metadata.get("resources", [])
    if isinstance(ai_resources, list):
        for res in ai_resources:
            if not isinstance(res, dict):
                continue
            name = res.get("resource_name", "").strip()
            res_type = res.get("resource_type", "Website").strip()
            url = res.get("resource_url")
            if url:
                url = url.strip()
            
            if not name:
                continue
                
            # Find evidence
            ev = find_evidence_in_whisper_chunks(
                chunks=whisper_result.get("chunks", []) if isinstance(whisper_result, dict) else [],
                term=name,
                caption=req.caption,
                ocr_text=visual_desc_clean
            )
            
            # Check hallucination
            is_hallucinated, explanation = check_resource_hallucination(
                name=name,
                url=url,
                transcript=plain_text,
                caption=req.caption,
                ocr=visual_desc_clean,
                raw_urls=metadata.get("extracted_urls", []),
                raw_repos=repositories_found
            )
            
            res_desc = res.get("description", "")
            if is_hallucinated and explanation:
                res_desc = f"{res_desc} (Warning: {explanation})".strip()
                
            # Confidence score
            confidence = calculate_confidence(
                hallucination_flag=is_hallucinated,
                is_regex=False,
                is_transcript=ev.get("is_transcript", False),
                is_ocr=ev.get("is_ocr", False),
                is_caption=ev.get("is_caption", False),
                has_evidence=bool(ev.get("evidence_text"))
            )
            
            resource_obj = {
                "resource_name": name,
                "resource_type": res_type,
                "resource_url": url,
                "description": res_desc,
                "confidence": confidence,
                "verification_status": "pending_verification",
                "hallucination_flag": is_hallucinated,
                "evidence_text": ev.get("evidence_text", ""),
                "timestamp_start": ev.get("timestamp_start"),
                "timestamp_end": ev.get("timestamp_end")
            }
            resources_list.append(resource_obj)
            if url:
                seen_urls.add(url.lower())
            seen_names.add(name.lower())

    # Inject deterministically extracted URLs
    for url in metadata.get("extracted_urls", []):
        if url.lower() in seen_urls:
            continue
            
        parsed = urlparse(url)
        name = parsed.netloc.replace("www.", "") if parsed.netloc else url
        res_type = "Website"
        if "github.com" in url.lower():
            res_type = "GitHub Repository"
            parts = parsed.path.strip("/").split("/")
            if len(parts) >= 2:
                name = f"{parts[0]}/{parts[1]}"
                
        # Find evidence
        ev = find_evidence_in_whisper_chunks(
            chunks=whisper_result.get("chunks", []) if isinstance(whisper_result, dict) else [],
            term=name,
            caption=req.caption,
            ocr_text=visual_desc_clean
        )
        
        confidence = calculate_confidence(
            hallucination_flag=False,
            is_regex=True,
            is_transcript=ev.get("is_transcript", False),
            is_ocr=ev.get("is_ocr", False),
            is_caption=ev.get("is_caption", False),
            has_evidence=bool(ev.get("evidence_text"))
        )
        
        resource_obj = {
            "resource_name": name,
            "resource_type": res_type,
            "resource_url": url,
            "description": f"Deterministically extracted resource.",
            "confidence": confidence,
            "verification_status": "pending_verification",
            "hallucination_flag": False,
            "evidence_text": ev.get("evidence_text", "") or f"Pattern match for {url}",
            "timestamp_start": ev.get("timestamp_start"),
            "timestamp_end": ev.get("timestamp_end")
        }
        resources_list.append(resource_obj)
        seen_urls.add(url.lower())

    processing_time = round(time.time() - pipeline_start, 2)
    logger.info(f"[{req.reel_id}] Pipeline complete. Returning results.")
    
    response_data = {
        "success": groq_error is None,
        "error": groq_error,
        "transcript": {"plain_text": plain_text, "srt": srt},
        "visual_description": visual_desc_clean,
        "metadata": metadata,
        "extracted_urls": metadata.get("extracted_urls", []),
        "mentioned_brand_names": [p["name"] for p in visible_products_or_websites],
        "repositories_found": repositories_found,
        "visible_products_or_websites": visible_products_or_websites,
        "incidental_mentions": incidental_mentions,
        "how_to_guide": how_to_guide,
        "embedding": embedding,
        "processing_time_seconds": processing_time,
        "resources": resources_list
    }
    
    # Save result to cache
    save_cached_response(req.reel_id, response_data)
    
    return response_data


@app.post("/embed")
async def embed_text(req: EmbedRequest):
    """Generate 384-dimensional vector embedding for query text."""
    if not embedder:
        raise HTTPException(status_code=500, detail="Embedding model not loaded")
    
    loop = asyncio.get_event_loop()
    try:
        embedding_tensor = await loop.run_in_executor(
            None, partial(embedder.encode, req.text)
        )
        return {"embedding": embedding_tensor.tolist()}
    except Exception as e:
        logger.error(f"Embedding query failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat")
async def chat_with_context(req: ChatRequest):
    """Answer user query using retrieved RAG context via Groq LLM."""
    if not groq_client:
        raise HTTPException(status_code=500, detail="Groq client not initialized")

    # Build prompt context
    context_str = ""
    for idx, item in enumerate(req.context):
        context_str += f"=== Save [{idx + 1}] ===\n"
        context_str += f"Title: {item.title}\n"
        context_str += f"Author: @{item.author_username}\n"
        context_str += f"URL: {item.instagram_url}\n"
        context_str += f"Summary: {item.summary}\n"
        if item.how_to_guide:
            title = item.how_to_guide.get("how_to_title", "")
            steps = item.how_to_guide.get("steps", [])
            context_str += f"Guide Title: {title}\n"
            context_str += "Steps:\n" + "\n".join(f"- {s}" for s in steps) + "\n"
        if item.plain_text:
            context_str += f"Transcript Snippet: {item.plain_text[:800]}...\n"
        context_str += "\n"

    system_prompt = (
        "You are SuperBrain, a visual product intelligence AI assistant. "
        "Your task is to answer the user's questions about their bookmarked Instagram reels, posts, and carousels. "
        "Use the provided context containing titles, summaries, guides, and transcripts of their saved posts.\n\n"
        "Guidelines:\n"
        "1. Answer using ONLY facts from the provided context. If the answer is not in the context, say so.\n"
        "2. Be concise, technical, and direct.\n"
        "3. If referencing a saved post, cite it by mentioning the Title and the exact URL so the user can open it.\n"
        "4. Output in clean Markdown formatting."
    )

    user_content = f"Context of my saved posts:\n{context_str}\nUser Question: {req.query}"

    loop = asyncio.get_event_loop()
    try:
        completion = await loop.run_in_executor(
            None,
            partial(
                groq_client.chat.completions.create,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                model="llama-3.3-70b-versatile",
                temperature=0.2,
                max_tokens=1000
            )
        )
        answer = completion.choices[0].message.content
        return {"answer": answer}
    except Exception as e:
        logger.error(f"Groq chat completion failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/mindmap")
async def generate_mind_map(req: MindMapRequest):
    """Generate structured mind-map hierarchy using Groq Llama 3.3."""
    if not groq_client:
        raise HTTPException(status_code=500, detail="Groq client not initialized")

    detail_instruction = ""
    if req.detail_level == "concise":
        detail_instruction = (
            "CRITICAL FORMAT RULES - DETAIL LEVEL: CONCISE\n"
            "- You MUST create a high-level, extremely clean and minimal mind map.\n"
            "- Limit the number of major branches in your JSON 'branches' array to EXACTLY 2 or 3.\n"
            "- Limit each branch's 'points' array to EXACTLY 1 or 2 high-level takeaway points.\n"
            "- Focus ONLY on the absolute core message and skip all sub-details, examples, or incidental facts."
        )
    elif req.detail_level == "detailed":
        detail_instruction = (
            "CRITICAL FORMAT RULES - DETAIL LEVEL: DETAILED\n"
            "- You MUST create a deep, comprehensive, and highly granular mind map.\n"
            "- Extract at least 5 or 6 distinct major branches from the transcript.\n"
            "- Include 4 to 6 detailed, informative points under each branch.\n"
            "- Actively dig deep into the provided text/transcript to extract specific tools, commands, step-by-step procedures, libraries, tips, websites, and concrete examples. Make sure every branch is packed with information."
        )
    else:
        # moderate
        detail_instruction = (
            "CRITICAL FORMAT RULES - DETAIL LEVEL: MODERATE\n"
            "- You MUST create a balanced, standard mind map.\n"
            "- Limit the major branches to EXACTLY 3 or 4.\n"
            "- Limit each branch's points to EXACTLY 2 or 3 points.\n"
            "- Balance high-level conceptual takeaways with primary action points."
        )

    system_prompt = (
        "You are an expert concepts extraction and visualization AI.\n"
        "Your task is to analyze the provided title, summary, key takeaways, and transcript of a video curation, "
        "and organize them into a clean, hierarchical mind map structure.\n\n"
        f"{detail_instruction}\n\n"
        "Instructions:\n"
        "1. Create a logical hierarchy representing the central topic and its core supporting concepts.\n"
        "2. The central topic is the mind map's title (keep it concise, e.g. 3-8 words).\n"
        "3. Output ONLY a valid JSON object matching the schema below. Do not wrap in markdown tags or add extra conversational text.\n\n"
        "JSON Schema:\n"
        "{\n"
        "  \"title\": \"string (Central topic title)\",\n"
        "  \"branches\": [\n"
        "    {\n"
        "      \"name\": \"string (Branch title, max 5 words)\",\n"
        "      \"points\": [\n"
        "        \"string (Key takeaway/details, max 15 words)\"\n"
        "      ]\n"
        "    }\n"
        "  ]\n"
        "}"
    )

    takeaways_str = "\n".join(f"- {t}" for t in req.key_takeaways)
    user_content = (
        f"Title: {req.title}\n"
        f"Summary: {req.summary}\n"
        f"Key Takeaways:\n{takeaways_str}\n"
        f"Full Transcript:\n{req.plain_text}"
    )

    # Dynamic temperature based on detail level to balance structure vs detail extraction
    temp = 0.3
    if req.detail_level == "detailed":
        temp = 0.75
    elif req.detail_level == "moderate":
        temp = 0.5

    logger.info(f"Generating mindmap with detail_level={req.detail_level}, temp={temp}")

    loop = asyncio.get_event_loop()
    try:
        completion = await loop.run_in_executor(
            None,
            partial(
                groq_client.chat.completions.create,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                model="llama-3.3-70b-versatile",
                temperature=temp,
                response_format={"type": "json_object"},
                max_tokens=1500
            )
        )
        mind_map = json.loads(completion.choices[0].message.content)
        return mind_map
    except Exception as e:
        logger.error(f"Groq mindmap generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
