from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from groq import Groq
from pydantic import BaseModel, Field

from config import GROQ_API_KEY
from rag import search_documents, build_context


# =========================
# APPLICATION
# =========================

app = FastAPI(
    title="Tanzania Government Services AI Chatbot"
)

BASE_DIR = Path(__file__).resolve().parent.parent

client = Groq(
    api_key=GROQ_API_KEY
)


# =========================
# REQUEST MODEL
# =========================

class ChatRequest(BaseModel):
    message: str
    history: list[dict] = Field(default_factory=list)


# =========================
# SYSTEM PROMPT
# =========================

SYSTEM_PROMPT = """
You are a friendly Tanzania Government Services information assistant.

Your job is to help users understand Tanzanian government services
using the provided knowledge base and the recent conversation.

SUPPORTED SERVICES:

1. Birth certificates
2. NIDA
3. Passports and travel documents
4. TIN
5. Driving licences
6. Tax clearance certificates
7. Land services


==================================================
GENERAL BEHAVIOUR
==================================================

- Answer naturally like a helpful chatbot.
- Give the direct answer first.
- Keep answers simple and concise.
- Use simple English or Swahili.
- Match the user's language.
- If the user mixes English and Swahili, respond naturally.
- Do not repeat the user's question.
- Do not unnecessarily ask clarification questions.
- Do not invent government information.


==================================================
CONVERSATION MEMORY
==================================================

The conversation history is extremely important.

The current message may be a short follow-up.

Words such as:

- it
- this
- that
- one
- they
- them
- there
- why
- how
- cost
- requirements
- process
- new one
- replacement
- that one
- what if I don't
- why is it
- how much

must be interpreted using the previous conversation.

Examples:

User:
"Tell me about land ownership."

Assistant:
[land answer]

User:
"Why is it complicated?"

Correct meaning:
"Why is land ownership complicated?"

Do not ask:
"Why is what complicated?"

---

User:
"Tell me about getting a driving licence."

Assistant:
[driving licence answer]

User:
"How much does it cost?"

Correct meaning:
"What is the cost of getting a driving licence?"

---

User:
"What are the requirements for a passport?"

Assistant:
[passport answer]

User:
"How long does it take?"

Correct meaning:
"How long does the passport process take?"

---

User:
"How do I get a new driving licence?"

Assistant:
[driving licence answer]

User:
"How do I get the new one?"

Correct meaning:
"How do I get the new driving licence?"

---

User:
"Tell me about NIDA registration."

Assistant:
[NIDA answer]

User:
"What if I don't do that?"

Correct meaning:
"What happens if I don't register for NIDA?"

Do not suddenly switch to passport, driving licence,
or another unrelated service.


==================================================
TOPIC PRIORITY
==================================================

When interpreting a short follow-up question, use this priority:

1. The current conversation topic
2. The immediately previous user message
3. Earlier conversation history
4. Knowledge-base search results

Knowledge-base search results must NOT determine the topic
when the conversation already makes the topic clear.

For example:

Conversation topic:
LAND

User:
"cost?"

Even if the retrieved documents contain information about
passports and driving licences, answer about LAND.

Conversation topic:
DRIVING LICENCE

User:
"new one"

Interpret "one" as the driving licence.

Do not ask the user to choose between unrelated services.


==================================================
CONVERSATION TOPIC
==================================================

If the conversation clearly discusses one supported service,
continue using that service until the user clearly changes topic.

Examples:

LAND → "why?"
LAND → "cost?"
LAND → "requirements?"
LAND → "what if I don't do that?"

All should remain about LAND.

DRIVING LICENCE → "how much?"
DRIVING LICENCE → "new one"
DRIVING LICENCE → "replacement?"

All should remain about DRIVING LICENCE.

Only change the topic when the user clearly introduces another
service.


==================================================
WHEN THE USER IS TOO GENERAL
==================================================

If the user says something such as:

"Hi, I'm new to Tanzania."

Do NOT provide a long list of unrelated government procedures.

Instead, briefly explain that you can help with the supported
government services and ask what service they want.

For example:

"Welcome to Tanzania! I can help you with services such as NIDA,
TIN, passports, driving licences, birth certificates, tax
clearance and land services. Which one would you like to know about?"


==================================================
KNOWLEDGE BASE
==================================================

The knowledge base is the primary source for factual government
information.

Never invent:

- Fees
- Requirements
- Procedures
- Processing times
- Laws
- Government offices
- Contact information
- URLs
- Government policies

If the knowledge base does not contain enough information,
say:

"I couldn't find that information in my current knowledge base."


==================================================
IMPORTANT
==================================================

Use conversation history to understand WHAT the user means.

Use the knowledge base to determine WHAT IS FACTUALLY TRUE.

Do not use retrieved documents to randomly change the
conversation topic.

Accuracy is more important than creativity.
"""


# =========================
# FRONTEND
# =========================

@app.get("/")
def home():
    return FileResponse(BASE_DIR / "frontend" / "index.html")


@app.get("/style.css")
def style():
    return FileResponse(BASE_DIR / "frontend" / "style.css")


@app.get("/app.js")
def javascript():
    return FileResponse(BASE_DIR / "frontend" / "app.js")


# =========================
# HEALTH
# =========================

@app.get("/health")
def health():
    return {
        "status": "ok"
    }


# =========================
# RECENT CONVERSATION
# =========================

def format_history(history, limit=8):

    recent = history[-limit:]

    lines = []

    for item in recent:

        role = item.get("role", "")
        content = item.get("content", "")

        if not content:
            continue

        if role == "bot":
            role = "assistant"

        if role not in ["user", "assistant"]:
            continue

        lines.append(
            f"{role}: {content}"
        )

    return "\n".join(lines)


# =========================
# DETERMINE TOPIC
# =========================

def determine_topic(history, current_message):

    conversation = format_history(
        history,
        limit=8
    )

    prompt = f"""
Determine the current topic of this conversation.

Supported topics:

- birth certificate
- NIDA
- passport
- TIN
- driving licence
- tax clearance certificate
- land services

Recent conversation:

{conversation}

Current user message:

{current_message}

Rules:

1. If the current message is a follow-up such as
   "why?", "cost?", "how?", "what if I don't?",
   "new one", "requirements?", "how long?",
   use the previous conversation to determine the topic.

2. If the previous conversation clearly concerns one service,
   keep that service.

3. Do not select a different service merely because it may
   appear in unrelated documents.

4. If the user clearly changes subject, use the new subject.

5. If there is no supported government-service topic yet,
   return "general".

Return ONLY one of these values:

birth certificate
NIDA
passport
TIN
driving licence
tax clearance certificate
land services
general
"""

    try:

        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {
                    "role": "system",
                    "content": prompt
                }
            ],
            temperature=0
        )

        topic = (
            response
            .choices[0]
            .message
            .content
            .strip()
            .lower()
        )

        allowed_topics = [
            "birth certificate",
            "NIDA",
            "passport",
            "TIN",
            "driving licence",
            "tax clearance certificate",
            "land services",
            "general"
        ]

        # Match case-insensitively
        for allowed in allowed_topics:

            if topic == allowed.lower():
                return allowed

        return "general"

    except Exception as error:

        print("Topic detection error:", error)

        return "general"


# =========================
# BUILD RETRIEVAL QUERY
# =========================

def build_retrieval_query(
    history,
    current_message,
    topic
):

    conversation = format_history(
        history,
        limit=6
    )

    # If topic is known, explicitly put it first.
    # This reduces unrelated RAG retrieval.

    if topic != "general":

        return f"""
Current government service topic:

{topic}

Recent conversation:

{conversation}

Current user question:

{current_message}

Retrieve information ONLY about:

{topic}

Interpret the current question as a continuation
of the conversation when necessary.
"""

    return f"""
Recent conversation:

{conversation}

Current user question:

{current_message}

Retrieve information relevant to the current question.
"""


# =========================
# BUILD AI CONVERSATION
# =========================

def build_conversation(
    history,
    current_message,
    context,
    topic
):

    messages = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT
        }
    ]

    recent_history = history[-10:]

    for item in recent_history:

        role = item.get("role")
        content = item.get("content")

        if not content:
            continue

        if role == "bot":
            role = "assistant"

        if role not in ["user", "assistant"]:
            continue

        messages.append({
            "role": role,
            "content": content
        })


    current_prompt = f"""
Current conversation topic:

{topic}

Knowledge-base context:

{context}

Current user message:

{current_message}


Answer the current user.

IMPORTANT:

- Use the conversation history to understand short follow-up
  questions.
- If the user says "it", "that", "one", "why", "cost",
  "requirements", "new one", etc., resolve the meaning from
  the conversation.
- Do not change the topic because of unrelated information
  in the knowledge-base context.
- Use the knowledge base for factual information.
- Do not mention RAG, embeddings, Groq, retrieval, or
  internal systems.
- Do not say that you detected a topic.
- Keep the answer concise.
"""

    messages.append({
        "role": "user",
        "content": current_prompt
    })

    return messages


# =========================
# CHAT
# =========================

@app.post("/chat")
def chat(request: ChatRequest):

    current_message = request.message.strip()

    if not current_message:

        return {
            "message": "Please enter a question."
        }


    # =========================
    # DETERMINE CURRENT TOPIC
    # =========================

    topic = determine_topic(
        request.history,
        current_message
    )

    print(
        f"Conversation topic: {topic}"
    )


    # =========================
    # RAG SEARCH
    # =========================

    retrieval_query = build_retrieval_query(
        request.history,
        current_message,
        topic
    )

    documents = search_documents(
        retrieval_query,
        top_k=5
    )

    context = build_context(
        documents
    )


    if not context:

        context = (
            "No relevant information was found "
            "in the knowledge base."
        )


    # =========================
    # BUILD CONVERSATION
    # =========================

    messages = build_conversation(
        request.history,
        current_message,
        context,
        topic
    )


    # =========================
    # CALL GROQ
    # =========================

    try:

        response = client.chat.completions.create(

            model="openai/gpt-oss-120b",

            messages=messages,

            temperature=0.3
        )

        answer = (
            response
            .choices[0]
            .message
            .content
        )


        return {
            "message": answer
        }


    except Exception as error:

        print(
            "Chat error:",
            error
        )

        return {
            "message": (
                "I'm temporarily unable to retrieve "
                "the required information. Please try again."
            )
        }
