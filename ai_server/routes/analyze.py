import os
import time
import asyncio
from urllib.parse import urlparse
from fastapi import APIRouter, Request, HTTPException

from ai_server.config import logger, GENERIC_TECH_TERMS
from ai_server.models import AnalyzeRequest
from ai_server.utils.validation import is_valid_extracted_url
from ai_server.utils.cache import get_cached_response, save_cached_response
from ai_server.utils.hallucination import (
    find_evidence_in_whisper_chunks,
    check_resource_hallucination,
    calculate_confidence
)
from ai_server.services.whisper_service import run_whisper, convert_to_srt
from ai_server.services.embedding_service import generate_embedding
from ai_server.services.gemini_service import (
    run_gemini_analysis,
    run_gemini_single_image,
    run_gemini_image_carousel
)
from ai_server.services.groq_service import (
    serper_search,
    generate_reel_metadata,
    generate_how_to_guide
)

router = APIRouter()

@router.post("/analyze_reel")
async def analyze_reel(req: AnalyzeRequest, request: Request):
    """
    Complete analysis pipeline:
    1. ASR (Whisper-Hinglish)
    2. Vision OCR & Product extraction (Gemini Flash)
    3. Serper Search for Official Brand Sites
    4. Synthesis / Metadata Extraction (Groq Llama 3.3)
    5. How-To Guide Generation (groq)
    6. Embedding Generation (SentenceTransformer)
    7. Confidence Scoring & Hallucination checks (resources)
    """
    pipeline_start = time.time()
    logger.info(f"[{req.reel_id}] Pipeline initiated. Mode: {req.content_mode}. Bypass Cache: {req.bypass_cache}")

    # Check cache first (unless bypassed)
    if not req.bypass_cache:
        cached = get_cached_response(req.reel_id)
        if cached:
            return cached

    # Retrieve models/clients from app state
    pipe = request.app.state.pipe
    embedder = request.app.state.embedder
    groq_client = request.app.state.groq_client
    gemini_client = request.app.state.gemini_client

    if not groq_client or not gemini_client:
        raise HTTPException(status_code=500, detail="Required AI clients not initialized")

    loop = asyncio.get_event_loop()

    # Step variables
    plain_text = ""
    srt = ""
    visual_desc_clean = ""
    gemini_urls = []
    repositories_found = []
    visible_products_or_websites = []
    incidental_mentions = []
    gemini_text_content = ""
    whisper_result = {"text": "", "chunks": []}
    groq_error = None

    # Step 1 & 2: Parallel execution based on content mode
    if req.content_mode == "single_image":
        logger.info(f"[{req.reel_id}] Single image mode — running Gemini Analysis")
        if not req.image_paths:
            raise HTTPException(status_code=400, detail="image_paths is required for single_image mode")
        
        gemini_res = await loop.run_in_executor(
            None, run_gemini_single_image, req.image_paths[0], gemini_client
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
        logger.info(f"[{req.reel_id}] Image carousel mode — running Gemini Analysis")
        if not req.image_paths:
            raise HTTPException(status_code=400, detail="image_paths is required for image_carousel mode")
            
        gemini_res = await loop.run_in_executor(
            None, run_gemini_image_carousel, req.image_paths, gemini_client
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
            whisper_future = loop.run_in_executor(None, run_whisper, req.audio_path, groq_client, pipe)
        else:
            logger.info(f"[{req.reel_id}] No valid audio path provided. Assuming silent video.")

        gemini_future = loop.run_in_executor(None, run_gemini_analysis, req.video_path, gemini_client)

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

    # Filter brand names and resolve using Serper API in parallel
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

    # Set up context text for Groq synthesis
    groq_context_text = plain_text
    if req.content_mode in ["single_image", "image_carousel"] and gemini_text_content:
        groq_context_text = gemini_text_content
        plain_text = ""

    _slide_count = len(req.image_paths) if req.content_mode == "image_carousel" else 0

    # Check for empty content fallback
    _check_text = groq_context_text if req.content_mode in ["single_image", "image_carousel"] else plain_text
    is_transcript_empty = len(_check_text.strip()) < 10
    is_visual_unavailable = (
        "unavailable" in visual_desc_clean.lower()
        or "not available" in visual_desc_clean.lower()
        or "failed" in visual_desc_clean.lower()
        or len(visual_desc_clean) < 10
    )

    if is_transcript_empty and is_visual_unavailable:
        logger.warning(f"[{req.reel_id}] Both transcript and visuals are missing. Returning fallback.")
        fallback_data = {
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
        return fallback_data

    # Step 3: Run synthesis and metadata extraction via Groq Llama 3.3
    metadata, groq_error = await generate_reel_metadata(
        groq_client=groq_client,
        transcript=groq_context_text,
        visual_desc=visual_desc_clean,
        caption=req.caption,
        caption_urls=req.caption_urls,
        gemini_urls=gemini_urls,
        repositories_found=repositories_found,
        visible_products_or_websites=visible_products_or_websites,
        resolved_brand_urls=resolved_brand_urls,
        incidental_mentions=incidental_mentions,
        content_mode=req.content_mode,
        slide_count=_slide_count
    )

    if req.content_mode in ["single_image", "image_carousel"]:
        if metadata.get("title") == "Analysis Timeout":
            plain_text = ""
        else:
            plain_text = metadata.get("summary", "")

    # Post-processing URLs, brand names, and telegram bots
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

        mentioned_tools = metadata.get("mentioned_tools_or_websites", [])
        if not isinstance(mentioned_tools, list):
            mentioned_tools = []

        for tool in list(mentioned_tools):
            tool_lower = tool.lower().strip()
            for platform, url in KNOWN_PLATFORMS.items():
                if platform in tool_lower and url not in extracted_urls:
                    extracted_urls.append(url)

        # Process Telegram Bots
        bots_mentioned = metadata.get("telegram_bots_mentioned", [])
        if isinstance(bots_mentioned, list) and bots_mentioned:
            for bot in bots_mentioned:
                bot_clean = bot.strip()
                if bot_clean:
                    bot_username = bot_clean.replace(" ", "").replace("@", "")
                    search_instruction = f"Search '@{bot_username}' on Telegram"
                    if search_instruction not in mentioned_tools:
                        mentioned_tools.append(search_instruction)
                    
                    t_me_link = f"https://t.me/{bot_username}"
                    if t_me_link not in extracted_urls:
                        extracted_urls.append(t_me_link)

        # Clean and validate URLs
        cleaned_urls = []
        for url in extracted_urls:
            url = url.strip()
            if not url:
                continue
            if not url.startswith("http"):
                url = "https://" + url
                
            url_lower = url.lower()
            if "instagram.com" in url_lower and any(x in url_lower for x in ["/reel/", "/p/", "/tv/", "/stories/"]):
                continue
                
            is_useless_social = False
            social_domains = ["instagram.com/", "twitter.com/", "x.com/", "facebook.com/", "threads.net/", "tiktok.com/"]
            for dom in social_domains:
                if dom in url_lower:
                    path = url_lower.split(dom)[1].strip("/")
                    if "/" not in path or len(path.split("/")) == 1:
                        is_useless_social = True
                        break
                        
            if is_useless_social:
                logger.info(f"Filtering out social profile link: {url}")
                continue
                
            if url not in cleaned_urls:
                cleaned_urls.append(url)

        metadata["extracted_urls"] = cleaned_urls
        metadata["mentioned_tools_or_websites"] = mentioned_tools
        logger.info(f"[{req.reel_id}] Smart post-processing completed. Extracted URLs: {cleaned_urls}")

    except Exception as process_err:
        logger.warning(f"[{req.reel_id}] Smart post-processing failed (non-critical): {str(process_err)}")

    # Step 4: Generate How-To Guide (only for actionable content)
    how_to_guide = None
    actionable_types = ["tutorial", "recipe", "tech", "finance", "fitness", "education"]
    content_type_lower = metadata.get("content_type", "").lower()
    is_actionable = any(t in content_type_lower for t in actionable_types)

    if is_actionable:
        logger.info(f"[{req.reel_id}] Generating how-to guide...")
        how_to_guide = await generate_how_to_guide(
            groq_client=groq_client,
            title=metadata.get("title", ""),
            summary=metadata.get("summary", ""),
            key_takeaways=metadata.get("key_takeaways", []),
            transcript=plain_text,
            visual_desc=visual_desc_clean
        )

    # Step 5: Generate Vector Embeddings (offloaded)
    try:
        logger.info(f"[{req.reel_id}] Generating embeddings...")
        text_for_embedding = f"{metadata.get('title', '')} {metadata.get('summary', '')} {visual_desc_clean} {plain_text}"
        embedding = await loop.run_in_executor(
            None, generate_embedding, embedder, text_for_embedding
        )
    except Exception as e:
        logger.error(f"[{req.reel_id}] Embedding failed: {str(e)}")
        embedding = [0.0] * 384

    # Step 6: Global Resource Extraction Framework Processing
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
            "description": "Deterministically extracted resource.",
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
