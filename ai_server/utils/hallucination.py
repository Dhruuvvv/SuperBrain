import re
from urllib.parse import urlparse
from difflib import SequenceMatcher

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
