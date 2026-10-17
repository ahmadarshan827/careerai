from io import BytesIO

from pypdf import PdfReader

MIN_TEXT_LENGTH = 50


class PDFExtractionError(Exception):
    """Raised when a PDF can't be turned into usable text."""


def extract_text(data: bytes) -> str:
    try:
        reader = PdfReader(BytesIO(data))
        if reader.is_encrypted:
            raise PDFExtractionError("Password-protected PDFs are not supported")
        pages = [page.extract_text() or "" for page in reader.pages]
    except PDFExtractionError:
        raise
    except Exception as exc:
        raise PDFExtractionError("Could not read this PDF file") from exc

    # Postgres text columns reject NUL bytes, which some PDFs produce
    text = "\n".join(pages).replace("\x00", "").strip()

    if len(text) < MIN_TEXT_LENGTH:
        raise PDFExtractionError(
            "No readable text found. Scanned or image-only PDFs are not supported yet."
        )
    return text