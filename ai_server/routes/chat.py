from fastapi import APIRouter, Request, HTTPException
from functools import partial
import asyncio
from ai_server.models import ChatRequest
from ai_server.config import logger

router = APIRouter()

@router.post("/chat")
async def chat_with_context(req: ChatRequest, request: Request):
    """Answer user query using retrieved RAG context via Groq LLM."""
    groq_client = request.app.state.groq_client
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
