import os
import fitz
import chromadb
from sentence_transformers import SentenceTransformer

DOCUMENTS_DIR = "Documents"
CHROMA_DIR = "chroma_db"

model = SentenceTransformer("all-MiniLM-L6-v2")

client = chromadb.PersistentClient(path=CHROMA_DIR)

collection = client.get_or_create_collection(
    name="government_services"
)


def chunk_text(text, chunk_size=500, overlap=50):
    chunks = []
    start = 0

    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        start += chunk_size - overlap

    return chunks


def ingest_documents():
    documents = []
    ids = []
    metadatas = []

    counter = 0

    for filename in os.listdir(DOCUMENTS_DIR):

        if not filename.lower().endswith(".pdf"):
            continue

        filepath = os.path.join(DOCUMENTS_DIR, filename)

        pdf = fitz.open(filepath)

        for page_number, page in enumerate(pdf):

            text = page.get_text().strip()

            if not text:
                continue

            chunks = chunk_text(text)

            for chunk in chunks:

                documents.append(chunk)

                ids.append(f"doc_{counter}")

                metadatas.append({
                    "source": filename,
                    "page": page_number + 1
                })

                counter += 1

        pdf.close()

    if documents:
        embeddings = model.encode(documents).tolist()

        collection.add(
            documents=documents,
            embeddings=embeddings,
            ids=ids,
            metadatas=metadatas
        )

    print(f"Indexed {len(documents)} chunks.")


if __name__ == "__main__":
    ingest_documents()
