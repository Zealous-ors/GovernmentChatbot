import chromadb
from sentence_transformers import SentenceTransformer

CHROMA_DIR = "chroma_db"

model = SentenceTransformer("all-MiniLM-L6-v2")

client = chromadb.PersistentClient(path=CHROMA_DIR)

collection = client.get_or_create_collection(
    name="government_services"
)


def search_documents(query, top_k=5):
    """
    Search the knowledge base for information
    relevant to the user's question.
    """

    query_embedding = model.encode([query]).tolist()

    results = collection.query(
        query_embeddings=query_embedding,
        n_results=top_k
    )

    documents = results.get("documents", [[]])[0]

    return documents


def build_context(documents):
    """
    Combine retrieved document chunks into
    one context string for the AI.
    """

    if not documents:
        return ""

    return "\n\n".join(documents)
