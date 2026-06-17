from fastapi import APIRouter, Request, HTTPException
from functools import partial
import asyncio
from ai_server.models import ChatRequest
from ai_server.config import logger

router = APIRouter()

@router.post("/chat")
async def chat_with_context(req: ChatRequest, request: Request):
    """Answer user query using retrieved RAG context via Groq LLM with conversation memory."""
    groq_client = request.app.state.groq_client
    if not groq_client:
        raise HTTPException(status_code=500, detail="Groq client not initialized")

    # Build RAG context string from retrieved posts
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
            context_str += f"Transcript Snippet: {item.plain_text[:1000]}...\n"
        context_str += "\n"

    system_prompt = (
        "You are SuperBrain, a personal knowledge assistant. "
        "You have access to the user's saved Instagram reels, posts, and carousels. "
        "Your job is to answer questions about their saved content in a helpful, conversational way.\n\n"
        "Rules:\n"
        "1. ONLY use facts from the provided context. If not in context, say so clearly.\n"
        "2. Respond in the SAME language the user is writing in (English, Hindi, Gujarati, Hinglish, etc.).\n"
        "3. Format responses with clean Markdown — use headers, bullet points, and bold text for readability.\n"
        "4. When referencing a saved post, mention the Title clearly.\n"
        "5. Be conversational and remember the conversation history — never repeat yourself.\n"
        "6. Keep responses concise but complete. Do not pad with unnecessary text.\n"
        "7. Use a friendly, smart assistant tone — not robotic."
    )

    # Build messages list: system + conversation history + new context + user query
    messages = [{"role": "system", "content": system_prompt}]

    # Add prior conversation turns (gives the AI memory of earlier messages)
    for turn in req.history[:-1]:  # exclude the last user message, we'll add it with context
        messages.append({"role": turn.role, "content": turn.content})

    # The final user message includes the fresh RAG context
    if context_str:
        user_content = (
            f"Here is context from my saved posts that is relevant to your question:\n\n"
            f"{context_str}\n"
            f"My question: {req.query}"
        )
    else:
        user_content = (
            f"(No saved posts match this query.)\n\n"
            f"My question: {req.query}"
        )

    messages.append({"role": "user", "content": user_content})

    loop = asyncio.get_event_loop()
    try:
        completion = await loop.run_in_executor(
            None,
            partial(
                groq_client.chat.completions.create,
                messages=messages,
                model="llama-3.3-70b-versatile",
                temperature=0.3,
                max_tokens=1200
            )
        )
        answer = completion.choices[0].message.content
        return {"answer": answer}
    except Exception as e:
        logger.error(f"Groq chat completion failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
