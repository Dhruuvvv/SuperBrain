from fastapi import APIRouter, Request, HTTPException
from functools import partial
import asyncio
import json
from ai_server.models import MindMapRequest
from ai_server.config import logger

router = APIRouter()

@router.post("/mindmap")
async def generate_mind_map(req: MindMapRequest, request: Request):
    """Generate structured mind-map hierarchy using Groq Llama 3.3."""
    groq_client = request.app.state.groq_client
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
            "- Each point MUST grow horizontally by providing a rich, descriptive explanation (15 to 30 words per point) detailing the syntax, command usages, mechanics, or reasons (e.g., instead of 'Use git init command', write 'Initialize a new local Git repository in the current folder using the git init command to start tracking source code changes').\n"
            "- Actively dig deep into the provided text/transcript to extract specific tools, commands, step-by-step procedures, libraries, tips, websites, and concrete examples. Make sure every branch is packed with information."
        )
    else:
        # moderate
        detail_instruction = (
            "CRITICAL FORMAT RULES - DETAIL LEVEL: MODERATE\n"
            "- You MUST create a balanced, standard mind map.\n"
            "- Limit the major branches to EXACTLY 3 or 4.\n"
            "- Limit each branch's points to EXACTLY 2 or 3 points.\n"
            "- Each point should be a moderately descriptive sentence (10 to 18 words) explaining the action and its consequence.\n"
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
        "        \"string (Key takeaway/details and description as instructed above)\"\n"
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
