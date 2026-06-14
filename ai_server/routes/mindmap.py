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
          "STRUCTURE RULES - DETAIL LEVEL: CONCISE\n"
          "- Limit the number of branches in 'branches' to EXACTLY 3.\n"
          "- Each branch may have 0 to 1 subBranch.\n"
          "- Each subBranch must have exactly 1 to 2 points. Never more.\n"
          "- Each point: 10 to 15 words. Provide a descriptive, informative statement with specific details."
      )
    elif req.detail_level == "detailed":
      detail_instruction = ( """
        CRITICAL FORMAT RULES — DETAIL LEVEL: DETAILED

        You MUST create a deep, comprehensive, and highly granular mind map.

        STRUCTURE:
        - Extract 5 to 6 distinct major branches from the transcript.
        - Each major branch MUST have 2 to 3 logical subBranches (not 1 — aim for 2 minimum).
        - Each subBranch MUST have 3 to 4 points.

        POINT QUALITY — THIS IS THE MOST IMPORTANT RULE:
        - Every point must be 10 to 15 words long — a descriptive, informative sentence/phrase.
        - Include specific tools, commands, steps, techniques, or examples from the transcript.
        - Bad: "Core Git commands"
        - Good: "Use git add, commit, and push to stage, save, and upload changes to remote repository"
        - Bad: "Design Audit"
        - Good: "Start with a design audit to identify visual inconsistencies before making any changes to the UI"

        CONTENT DEPTH:
        - Dig deep into the transcript — extract every specific detail, tool, workflow step, and concrete example.
        - Do NOT merge ideas — list each distinct concept as its own point.
        - Cover both conceptual understanding AND practical how-to steps.
        - SubBranch names should be descriptive (e.g., "Setup & Installation", "Core Workflow", "Advanced Tips") not generic ("Core Ideas", "Actions").
        """
      )
    else:
      # moderate
      detail_instruction = (
          "STRUCTURE RULES - DETAIL LEVEL: MODERATE\n"
          "- Limit the number of branches in 'branches' to EXACTLY 4.\n"
          "- Each branch may have 1 to 2 subBranches.\n"
          "- Each subBranch must have exactly 2 points. Never more.\n"
          "- Each point: 10 to 15 words. Provide a descriptive, informative statement with specific details."
      )

    system_prompt = (
        "You are an expert concepts extraction and visualization AI.\n"
        "Your task is to analyze the title, summary, key takeaways, and transcript of a video curation, "
        "and organize them into a clean, hierarchical mind map structure that is readable on a single screen.\n\n"
        "CARDINAL RULE: The rendered mind map has a fixed canvas. A map with more than ~30 total leaf points becomes "
        "completely unreadable. You MUST stay within the point budget regardless of detail_level.\n\n"
        f"{detail_instruction}\n\n"
        "--- CONTENT & WRAPPING RULES ---\n"
        "1. Write clear, informative points. Avoid filler phrases like 'this section covers' or 'in this part'.\n"
        "2. Merge similar ideas into one compact point rather than listing them separately if it helps readability.\n"
        "3. Each point MUST be exactly 10 to 15 words long. Do not make them too short or too long.\n"
        "4. Do not include timestamps, anecdotes, or step-by-step walkthroughs.\n"
        "5. Do not repeat the same concept across multiple branches.\n\n"
        "JSON Schema:\n"
        "{\n"
        "  \"title\": \"string (3 to 8 words, central topic)\",\n"
        "  \"branches\": [\n"
        "    {\n"
        "      \"name\": \"string (Branch title, max 4 words)\",\n"
        "      \"subBranches\": [\n"
        "        {\n"
        "          \"name\": \"string (Sub-branch title, e.g. 'Core Concepts', 'Actions')\",\n"
        "          \"points\": [\n"
        "            \"string (Exactly 10 to 15 words)\"\n"
        "          ]\n"
        "        }\n"
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
                max_tokens = 2500 if req.detail_level == "detailed" else 1500
            )
        )
        mind_map = json.loads(completion.choices[0].message.content)
        return mind_map
    except Exception as e:
        logger.error(f"Groq mindmap generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
