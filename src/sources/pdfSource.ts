import type { PDFDocumentProxy } from "pdfjs-dist";
import * as THREE from "three";
import type { ChapterMark, PageSource } from "./pageSource";

// Match the book's page aspect (PAGE_W:PAGE_H = 2.2:3.0). PDF pages are
// letterboxed onto this fixed canvas so the 3D geometry never changes.
const CW = 1024;
const CH = Math.round((CW * 3.0) / 2.2); // 1396
const PAPER = "#faf6ec";
// Render at the logical page size (matches Alice's texture budget). Going to 2×
// DPR makes each cached page ~22 MB and a window of ~15 exhausts the GPU
// (WebGL context loss), so keep parity with the rest of the book at 1024×1396.
const RENDER_DPR = 1;

function paperTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = CW;
  c.height = CH;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, CW, CH);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Render one PDF page, letterboxed onto a fixed CW×CH canvas at device DPR. */
async function renderPdfFace(doc: PDFDocumentProxy, pageNumber: number): Promise<THREE.CanvasTexture> {
  const page = await doc.getPage(pageNumber);
  const canvas = document.createElement("canvas");
  canvas.width = CW * RENDER_DPR;
  canvas.height = CH * RENDER_DPR;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(CW / base.width, CH / base.height) * RENDER_DPR;
  const vp = page.getViewport({ scale });
  const offX = (canvas.width - vp.width) / 2;
  const offY = (canvas.height - vp.height) / 2;

  await page.render({
    canvas,
    canvasContext: ctx,
    viewport: vp,
    transform: [1, 0, 0, 1, offX, offY],
  }).promise;
  page.cleanup();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

async function destToPageIndex(
  doc: PDFDocumentProxy,
  dest: string | unknown[] | null,
): Promise<number | null> {
  if (!dest) return null;
  const resolved = typeof dest === "string" ? await doc.getDestination(dest) : dest;
  const ref = (resolved as unknown[] | null)?.[0];
  if (!ref) return null;
  try {
    return await doc.getPageIndex(ref as never);
  } catch {
    return null;
  }
}

/** Top-level outline entries → chapter marks (depth-1 flatten). */
async function buildChapters(doc: PDFDocumentProxy): Promise<ChapterMark[]> {
  const outline = await doc.getOutline().catch(() => null);
  if (!outline?.length) return [];
  const out: ChapterMark[] = [];
  let n = 1;
  for (const item of outline) {
    const pageIndex = await destToPageIndex(doc, item.dest as string | unknown[] | null);
    if (pageIndex == null) continue;
    // face index == 0-based page index; spread that reveals it = ceil(face/2).
    out.push({ roman: String(n++), title: item.title || `Section ${n}`, page: Math.ceil(pageIndex / 2) });
  }
  return out;
}

/** Build a PageSource backed by a loaded PDF document. */
export async function createPdfSource(doc: PDFDocumentProxy, label: string): Promise<PageSource> {
  const pages = doc.numPages;
  // Keep faceCount odd so the book ends on a recto (blank pad when pages is even).
  const faceCount = pages % 2 === 0 ? pages + 1 : pages;
  const chapters = await buildChapters(doc);

  return {
    faceCount,
    chapters,
    label,
    renderFace: (i) => {
      if (i < 0 || i >= pages) return paperTexture(); // padding page
      return renderPdfFace(doc, i + 1); // faces are 0-based; PDF pages 1-based
    },
    dispose: () => {
      doc.destroy();
    },
  };
}
