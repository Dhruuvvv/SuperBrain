import os
import json
import re
import urllib.request
import urllib.parse
from functools import partial
import asyncio
from ai_server.config import logger

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


async def generate_reel_metadata(
    groq_client,
    transcript: str,
    visual_desc: str,
    caption: str,
    caption_urls: list,
    gemini_urls: list,
    repositories_found: list,
    visible_products_or_websites: list,
    resolved_brand_urls: list,
    incidental_mentions: list,
    content_mode: str,
    slide_count: int
) -> tuple[dict, str | None]:
    """
    Synthesize transcript, vision description, and links into structured metadata JSON using Llama 3.3.
    """
    _takeaway_instruction = (
        "Generate between 4 to 8 of the MOST important and useful key takeaways from the entire carousel. Prioritize quality over quantity."
        if slide_count > 1
        else "Write EXACTLY 3 to 4 takeaways — no more, no less."
    )

    prompt = f"""
    You are analyzing an Instagram Reel/Post to extract structured, high-value information for a knowledge management app.

    You have the following sources of information:

    AUDIO TRANSCRIPT (what was spoken or text extracted from images):
    {transcript if transcript and len(transcript.strip()) > 10 else "No speech detected — background music or silence only"}

    VISUAL ANALYSIS (what was seen in the video):
    {visual_desc}

    INSTAGRAM CAPTION (posted by creator):
    {caption if caption else "No caption available"}

    POTENTIAL URLS, REPOSITORIES AND BRANDS DETECTED:
    - Caption URLs: {caption_urls}
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

    loop = asyncio.get_event_loop()
    try:
        chat_completion = await loop.run_in_executor(
            None,
            partial(
                groq_client.chat.completions.create,
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.3-70b-versatile",
                temperature=0.0,
                response_format={"type": "json_object"},
                timeout=25.0,
            ),
        )

        metadata = json.loads(chat_completion.choices[0].message.content)
        return metadata, None

    except Exception as e:
        logger.error(f"Groq Metadata failed: {str(e)}")
        fallback = {
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
        return fallback, f"Groq metadata failed: {str(e)}"


async def generate_how_to_guide(
    groq_client,
    title: str,
    summary: str,
    key_takeaways: list,
    transcript: str,
    visual_desc: str
) -> dict | None:
    """
    Generate step-by-step actionable guide if the content is tutorial/educational.
    """
    howto_prompt = f"""
    Based on this Instagram Reel content, create a practical step-by-step guide.

    Title: {title}
    Summary: {summary}
    Key Takeaways: {key_takeaways}
    Audio Transcript: {transcript[:500] if transcript else "No speech"}
    Visual Content: {visual_desc[:300]}

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
    loop = asyncio.get_event_loop()
    try:
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
        return json.loads(howto_completion.choices[0].message.content)
    except Exception as e:
        logger.warning(f"How-to guide generation failed (non-critical): {str(e)}")
        return None
