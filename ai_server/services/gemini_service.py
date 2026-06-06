import os
import json
import base64
import subprocess
import re
import time
from google.genai import types
from ai_server.config import logger
from ai_server.utils.validation import is_valid_extracted_url
from ai_server.prompts.gemini_prompts import (
    GEMINI_VIDEO_PROMPT,
    GEMINI_SINGLE_IMAGE_PROMPT,
    GEMINI_CAROUSEL_PROMPT
)

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


def run_gemini_analysis(video_path: str, gemini_client) -> dict:
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

        parts.append(types.Part.from_text(text=GEMINI_VIDEO_PROMPT))

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


def run_gemini_single_image(image_path: str, gemini_client) -> dict:
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
            types.Part.from_text(text=GEMINI_SINGLE_IMAGE_PROMPT)
        ]

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


def run_gemini_image_carousel(image_paths: list, gemini_client) -> dict:
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

        parts.append(types.Part.from_text(text=GEMINI_CAROUSEL_PROMPT))

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
