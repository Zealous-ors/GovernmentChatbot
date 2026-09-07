import chromadb
from sentence_transformers import SentenceTransformer


# =========================
# CONFIGURATION
# =========================

CHROMA_DIR = "chroma_db"

COLLECTION_NAME = "government_services"


# =========================
# EMBEDDING MODEL
# =========================

model = SentenceTransformer(
    "all-MiniLM-L6-v2"
)


# =========================
# CHROMA DATABASE
# =========================

client = chromadb.PersistentClient(
    path=CHROMA_DIR
)

collection = client.get_or_create_collection(
    name=COLLECTION_NAME
)


# =========================
# SEARCH DOCUMENTS
# =========================

def search_documents(query, top_k=5):
    """
    Search the existing government-services
    knowledge base.

    Returns the most relevant document chunks.
    """

    if not query or not query.strip():
        return []


    # Convert query into an embedding

    query_embedding = model.encode(
        [query]
    ).tolist()


    # Search ChromaDB

    results = collection.query(
        query_embeddings=query_embedding,
        n_results=top_k,
        include=[
            "documents",
            "metadatas",
            "distances"
        ]
    )


    documents = results.get(
        "documents",
        [[]]
    )[0]


    metadatas = results.get(
        "metadatas",
        [[]]
    )[0]


    distances = results.get(
        "distances",
        [[]]
    )[0]


    # =========================
    # BUILD RESULTS
    # =========================

    retrieved = []


    for i, document in enumerate(documents):

        if not document:
            continue


        metadata = {}

        if i < len(metadatas):
            metadata = metadatas[i] or {}


        distance = None

        if i < len(distances):
            distance = distances[i]


        retrieved.append({
            "text": document,
            "source": metadata.get(
                "source",
                "Unknown"
            ),
            "page": metadata.get(
                "page",
                None
            ),
            "distance": distance
        })


    return retrieved


# =========================
# BUILD CONTEXT
# =========================

def build_context(results):
    """
    Convert retrieved results into context
    for the AI.

    Source information is included internally
    so the model knows where each piece of
    information came from.

    Sources are NOT displayed to the user.
    """

    if not results:
        return ""


    context_parts = []


    for result in results:

        text = result.get(
            "text",
            ""
        )

        source = result.get(
            "source",
            "Unknown"
        )

        page = result.get(
            "page"
        )


        if not text:
            continue


        # Internal source metadata

        if page:
            source_info = (
                f"Source document: {source}, "
                f"page {page}"
            )

        else:
            source_info = (
                f"Source document: {source}"
            )


        context_parts.append(
            f"{source_info}\n{text}"
        )


    return "\n\n---\n\n".join(
        context_parts
    )