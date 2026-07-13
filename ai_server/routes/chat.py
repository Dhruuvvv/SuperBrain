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

    logger.info(f"--- RAG Chat Request Initiated ---")
    logger.info(f"Query: '{req.query}'")
    logger.info(f"Received {len(req.context)} candidates from backend.")

    # Log initial candidates
    for i, item in enumerate(req.context):
        logger.info(f"  [{i+1}] Title: '{item.title}' | ID: {item.id} | DB Sim Score: {item.similarity}")

    # Step 1: Filter candidates based on relevance threshold (0.35)
    threshold = 0.35
    top_candidates = []
    for item in req.context:
        sim = item.similarity if item.similarity is not None else 1.0
        if sim >= threshold:
            top_candidates.append(item)

    # Step 2: Sort by similarity descending
    if any(item.similarity is not None for item in top_candidates):
        top_candidates.sort(key=lambda x: x.similarity or 0.0, reverse=True)

    logger.info(f"After threshold filtering (>= {threshold}), {len(top_candidates)} candidates selected.")
    for i, item in enumerate(top_candidates):
        logger.info(f"  Selected [{i+1}] Title: '{item.title}' | ID: {item.id} | Score: {item.similarity}")

    # Step 3: Strict Fallback if no relevant posts match
    if not top_candidates:
        logger.info("No candidates passed threshold. Returning strict fallback response.")
        return {
            "answer": "I couldn't find any relevant saved reels.",
            "selected_ids": []
        }

    # Build RAG context string from selected posts
    context_str = ""
    for idx, item in enumerate(top_candidates):
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
    user_content = (
        f"Here is context from my saved posts that is relevant to your question:\n\n"
        f"{context_str}\n"
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
        selected_ids = [item.id for item in top_candidates if item.id]
        logger.info(f"LLM Answer generated successfully. Selected Source IDs: {selected_ids}")
        return {"answer": answer, "selected_ids": selected_ids}
    except Exception as e:
        logger.error(f"Groq chat completion failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
