import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
// Vite ?url import: a stable hashed worker URL, not bundled into the main chunk.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Must run before any getDocument() call, or pdf.js falls back to a main-thread
// "fake worker" that hangs the UI on large files.
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export const MAX_PDF_BYTES = 60 * 1024 * 1024; // 60 MB

export type PdfErrorCode = "too-large" | "not-pdf" | "encrypted" | "corrupt";

export class PdfError extends Error {
  code: PdfErrorCode;
  constructor(code: PdfErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/** Cheap pre-checks before reading the whole file into memory. */
export function validatePdfFile(file: File): PdfError | null {
  if (file.size > MAX_PDF_BYTES) {
    return new PdfError("too-large", "That PDF is over 60 MB — try a smaller file.");
  }
  const looksPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!looksPdf) return new PdfError("not-pdf", "That doesn't look like a PDF.");
  return null;
}

/** Load a PDF document from file bytes, mapping pdf.js failures to PdfError. */
export async function loadPdfDocument(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  try {
    return await pdfjs.getDocument({ data }).promise;
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name ?? "";
    if (name === "PasswordException") {
      throw new PdfError("encrypted", "This PDF is password-protected.");
    }
    throw new PdfError("corrupt", "Couldn't read that PDF — it may be damaged.");
  }
}
