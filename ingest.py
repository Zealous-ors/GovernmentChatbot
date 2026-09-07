from pathlib import Path

import chromadb
import fitz
from sentence_transformers import SentenceTransformer

BASE_DIR = Path(__file__).resolve().parent
DOCUMENTS_DIR = BASE_DIR / "Documents"
CHROMA_DIR = BASE_DIR / "chroma_db"
COLLECTION_NAME = "government_services"


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    chunks = []
    start = 0

    while start < len(text):
        chunk = text[start : start + chunk_size].strip()

        if chunk:
            chunks.append(chunk)

        start += chunk_size - overlap

    return chunks


def ingest_documents() -> int:
    """Rebuild the local ChromaDB collection from the committed PDF knowledge base."""
    if not DOCUMENTS_DIR.exists():
        raise FileNotFoundError(f"Knowledge-base directory not found: {DOCUMENTS_DIR}")

    pdf_paths = sorted(DOCUMENTS_DIR.glob("*.pdf"))
    if not pdf_paths:
        raise FileNotFoundError(f"No PDF knowledge-base files found in {DOCUMENTS_DIR}")

    model = SentenceTransformer("all-MiniLM-L6-v2")
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))

    # Rebuild rather than append so repeated Render builds never create duplicate IDs.
    try:
        client.delete_collection(name=COLLECTION_NAME)
    except Exception:
        pass
    collection = client.get_or_create_collection(name=COLLECTION_NAME)

    documents = []
    ids = []
    metadatas = []

    counter = 0

    for filepath in pdf_paths:
        with fitz.open(filepath) as pdf:
            for page_number, page in enumerate(pdf, start=1):
                text = page.get_text().strip()
                for chunk in chunk_text(text):
                    documents.append(chunk)
                    ids.append(f"doc_{counter}")
                    metadatas.append({"source": filepath.name, "page": page_number})
                    counter += 1

    if not documents:
        raise ValueError("The knowledge-base PDFs contained no extractable text")

    embeddings = model.encode(documents, show_progress_bar=False).tolist()
    collection.add(
        documents=documents,
        embeddings=embeddings,
        ids=ids,
        metadatas=metadatas,
    )
    print(f"Indexed {len(documents)} chunks from {len(pdf_paths)} PDFs into {CHROMA_DIR}")
    return len(documents)


if __name__ == "__main__":
    ingest_documents()
