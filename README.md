 # Tanzania Government Services AI Chatbot

 A FastAPI chatbot that answers questions about selected Tanzanian government services using the committed PDF knowledge base, ChromaDB retrieval, and Groq.

 ## Local setup

 ```bash
 python -m venv .venv
 source .venv/bin/activate
 pip install -r requirements.txt
 cp .env.example .env
 # Set GROQ_API_KEY in .env
 python ingest.py
 uvicorn backend.main:app --reload
 ```

 Open `http://127.0.0.1:8000` after the server starts. The `/health` endpoint returns the service status.

 ## Render deployment

 The repository includes `render.yaml`, which configures a free Render web service:

 - Build command: `pip install -r requirements.txt && python ingest.py`
 - Start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
 - Health check: `/health`
 - Required secret: `GROQ_API_KEY`

 Create a Render Blueprint from this repository, then enter the Groq key when Render prompts for the unsynced `GROQ_API_KEY` environment variable. Do not commit the key to GitHub or place it in frontend code.

 The build command regenerates `chroma_db/` from the committed PDFs on every deploy. The ingestion script is idempotent: it replaces the existing collection instead of appending duplicate records. The application and ingestion code use paths relative to the repository, so they work even when the process is started outside the repository root.

 ## Free-tier expectations

 Render's free web service can sleep after inactivity and may take time to wake up. Its filesystem is ephemeral, so the index is intentionally generated during each build rather than relying on runtime changes. This setup is appropriate for demos and light usage; persistent storage and always-on production availability require a paid hosting plan or a separate managed database/storage design.
