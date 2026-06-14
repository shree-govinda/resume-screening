import io

import pdfplumber
import pytesseract
from docx import Document
from PIL import Image

import fitz  # PyMuPDF


def extract_text_from_pdf(file_path: str) -> str:
    text = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text += (page.extract_text() or "")
    except Exception:
        pass

    if len(text.strip()) < 100:
        # Fallback to OCR
        doc = fitz.open(file_path)
        for page in doc:
            pix = page.get_pixmap(dpi=200)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            text += pytesseract.image_to_string(img)
        doc.close()

    return text.strip()


def extract_text_from_docx(file_path: str) -> str:
    doc = Document(file_path)
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


def extract_text(file_path: str) -> str:
    lower = file_path.lower()
    if lower.endswith(".pdf"):
        return extract_text_from_pdf(file_path)
    if lower.endswith((".docx", ".doc")):
        return extract_text_from_docx(file_path)
    raise ValueError(f"Unsupported file type: {file_path}")
