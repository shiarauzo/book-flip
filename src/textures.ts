import * as THREE from "three";
import { ALICE_CHAPTERS } from "./aliceText";

// Page aspect must match the geometry (PAGE_W / PAGE_H = 2.2 / 3.0).
const CW = 1024;
const CH = Math.round((CW * 3.0) / 2.2); // 1396

const TEAL = "#1f4e46";
const GOLD = "#d8b46a";
const CREAM_INK = "#f3ead2";
const PAPER = "#faf6ec";
const INK = "#2b2a26";
const INK_SOFT = "#6b6354";

const SERIF = "'EB Garamond', Georgia, 'Times New Roman', serif";

// Text-flow metrics (canvas pixels).
const MARGIN_X = 120;
const COL_W = CW - MARGIN_X * 2;
const LINE_H = 46;
const BODY_FONT = `400 30px ${SERIF}`;
const TOP = 210; // body start on a continuation page
const BODY_TOP = 470; // body start under a chapter heading
const BOTTOM = CH - 168;
const CAP_SIZE = 92;
const CAP_LINES = 2;

function canvas() {
  const c = document.createElement("canvas");
  c.width = CW;
  c.height = CH;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  return { c, ctx };
}

function toTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Cached 128px noise tile reused as a repeating pattern for paper/cloth grain.
let noiseTile: HTMLCanvasElement | null = null;
function noiseCanvas(): HTMLCanvasElement {
  if (noiseTile) return noiseTile;
  const n = document.createElement("canvas");
  n.width = n.height = 128;
  const nc = n.getContext("2d")!;
  const img = nc.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 210 + Math.random() * 45;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = Math.random() * 20;
  }
  nc.putImageData(img, 0, 0);
  noiseTile = n;
  return n;
}

function paperFill(ctx: CanvasRenderingContext2D, base = PAPER) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, CW, CH);
  const pat = ctx.createPattern(noiseCanvas(), "repeat");
  if (pat) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, CW, CH);
    ctx.restore();
  }
  const g = ctx.createRadialGradient(CW / 2, CH / 2, CH * 0.32, CW / 2, CH / 2, CH * 0.78);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(92,72,40,0.07)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CW, CH);
}

function clothFill(ctx: CanvasRenderingContext2D, base: string) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, CW, CH);
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  for (let x = 0; x < CW; x += 4) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CH);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = "#000000";
  for (let yy = 0; yy < CH; yy += 4) {
    ctx.beginPath();
    ctx.moveTo(0, yy);
    ctx.lineTo(CW, yy);
    ctx.stroke();
  }
  ctx.restore();
  const pat = ctx.createPattern(noiseCanvas(), "repeat");
  if (pat) {
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, CW, CH);
    ctx.restore();
  }
  const g = ctx.createRadialGradient(CW / 2, CH / 2, 100, CW / 2, CH / 2, CH);
  g.addColorStop(0, "rgba(255,255,255,0.06)");
  g.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CW, CH);
}

function spacedCaps(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  size: number,
  spacing: number,
  color: string,
  weight = "400",
) {
  ctx.font = `${weight} ${size}px ${SERIF}`;
  ctx.fillStyle = color;
  const chars = text.toUpperCase().split("");
  const widths = chars.map((ch) => ctx.measureText(ch).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0) - spacing;
  let x = cx - total / 2;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], x, y);
    x += widths[i];
  }
}

function divider(ctx: CanvasRenderingContext2D, cx: number, y: number, w: number, color: string) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, y);
  ctx.lineTo(cx - 14, y);
  ctx.moveTo(cx + 14, y);
  ctx.lineTo(cx + w / 2, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, y - 6);
  ctx.lineTo(cx + 6, y);
  ctx.lineTo(cx, y + 6);
  ctx.lineTo(cx - 6, y);
  ctx.closePath();
  ctx.fill();
}

function pocketWatch(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.fillRect(cx - 8, cy - r - 20, 16, 16);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy - r - 26, 13, Math.PI * 0.12, Math.PI * 0.88, false);
  ctx.stroke();
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 14, 0, Math.PI * 2);
  ctx.stroke();
  const nums = ["XII", "I", "II", "III", "IIII", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `400 ${Math.round(r * 0.2)}px ${SERIF}`;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const rr = r - 34;
    ctx.fillText(nums[i], cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(-Math.PI / 2 + 0.5) * r * 0.4, cy + Math.sin(-Math.PI / 2 + 0.5) * r * 0.4);
  ctx.stroke();
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(-Math.PI / 2 - 0.28) * r * 0.62, cy + Math.sin(-Math.PI / 2 - 0.28) * r * 0.62);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function coverCanvas(): HTMLCanvasElement {
  const { c, ctx } = canvas();
  clothFill(ctx, TEAL);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.strokeRect(70, 70, CW - 140, CH - 140);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(86, 86, CW - 172, CH - 172);
  const cx = CW / 2;
  spacedCaps(ctx, "Alice's", cx, 430, 96, 10, CREAM_INK, "400");
  spacedCaps(ctx, "Adventures in", cx, 520, 52, 8, GOLD, "400");
  spacedCaps(ctx, "Wonderland", cx, 660, 104, 6, CREAM_INK, "700");
  divider(ctx, cx, 760, 360, GOLD);
  spacedCaps(ctx, "Lewis Carroll", cx, 880, 46, 12, GOLD, "400");
  spacedCaps(ctx, "Illustrated by John Tenniel", cx, CH - 150, 26, 6, CREAM_INK, "400");
  return c;
}

function titleCanvas(): HTMLCanvasElement {
  const { c, ctx } = canvas();
  paperFill(ctx);
  const cx = CW / 2;
  pocketWatch(ctx, cx, 320, 140);
  spacedCaps(ctx, "Alice's Adventures", cx, 600, 54, 4, INK, "400");
  spacedCaps(ctx, "in Wonderland", cx, 685, 54, 4, INK, "400");
  divider(ctx, cx, 775, 300, INK_SOFT);
  spacedCaps(ctx, "by", cx, 865, 28, 4, INK_SOFT, "400");
  spacedCaps(ctx, "Lewis Carroll", cx, 930, 42, 8, INK, "400");
  spacedCaps(ctx, "With Forty-Two Illustrations", cx, CH - 300, 24, 4, INK_SOFT, "400");
  spacedCaps(ctx, "by John Tenniel", cx, CH - 262, 24, 4, INK_SOFT, "400");
  spacedCaps(ctx, "VolumeOne Publishing", cx, CH - 150, 22, 5, INK_SOFT, "400");
  return c;
}

// --- Lazy pagination of the whole book -------------------------------------

type Line = { text: string; indent: number };
export type PageDesc =
  | { kind: "cover" }
  | { kind: "title" }
  | { kind: "blank" }
  | { kind: "end" }
  | {
      kind: "content";
      heading?: { roman: string; title: string };
      dropCap?: string;
      lines: Line[];
      pageNo: number;
    };

let measureCtx: CanvasRenderingContext2D | null = null;
function measurer(): CanvasRenderingContext2D {
  if (!measureCtx) measureCtx = canvas().ctx;
  return measureCtx;
}

function wrap(text: string, font: string, widthForLine: (i: number) => number): string[] {
  const ctx = measurer();
  ctx.font = font;
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > widthForLine(lines.length) && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Flow every chapter into page descriptors (CPU only — no textures created here).
 * Returns the full ordered face list: cover, title, all content pages, end, and a
 * padding page if needed so the faces pair into whole sheets.
 */
export function layoutBook(): PageDesc[] {
  const content: Extract<PageDesc, { kind: "content" }>[] = [];
  let pageNo = 0;
  let cur: Extract<PageDesc, { kind: "content" }> | null = null;
  let y = 0;

  const newPage = (heading?: { roman: string; title: string }) => {
    pageNo += 1;
    cur = { kind: "content", lines: [], pageNo, heading };
    content.push(cur);
    y = heading ? BODY_TOP : TOP;
  };
  const addLine = (text: string, indent: number) => {
    if (y > BOTTOM) newPage();
    cur!.lines.push({ text, indent });
    y += LINE_H;
  };

  const mc = measurer();
  mc.font = `400 ${CAP_SIZE}px ${SERIF}`;
  const capIndent = mc.measureText("M").width + 18;

  for (const ch of ALICE_CHAPTERS) {
    newPage({ roman: ch.roman, title: ch.title });
    const [first, ...rest] = ch.paragraphs;
    cur!.dropCap = first.slice(0, 1);
    const body = first.slice(1).replace(/^\s+/, "");
    wrap(body, BODY_FONT, (i) => COL_W - (i < CAP_LINES ? capIndent : 0)).forEach((ln, i) =>
      addLine(ln, i < CAP_LINES ? capIndent : 0),
    );
    y += 12;
    for (const p of rest) {
      wrap(p, BODY_FONT, (i) => COL_W - (i === 0 ? 40 : 0)).forEach((ln, i) =>
        addLine(ln, i === 0 ? 40 : 0),
      );
      y += 12;
    }
  }

  const faces: PageDesc[] = [{ kind: "cover" }, { kind: "title" }, ...content, { kind: "end" }];
  if (faces.length % 2 !== 0) faces.push({ kind: "blank" });
  return faces;
}

/** Render a single page descriptor to a texture (called lazily, on demand). */
export function renderPage(desc: PageDesc): THREE.CanvasTexture {
  if (desc.kind === "cover") return toTexture(coverCanvas());
  if (desc.kind === "title") return toTexture(titleCanvas());

  const { c, ctx } = canvas();
  paperFill(ctx);
  const cx = CW / 2;

  if (desc.kind === "blank") return toTexture(c);

  if (desc.kind === "end") {
    divider(ctx, cx, CH / 2 - 70, 220, INK_SOFT);
    spacedCaps(ctx, "The End", cx, CH / 2, 30, 8, INK, "400");
    spacedCaps(ctx, "Lewis Carroll · 1865", cx, CH / 2 + 64, 20, 5, INK_SOFT, "400");
    return toTexture(c);
  }

  // content
  if (desc.heading) {
    spacedCaps(ctx, `Chapter ${desc.heading.roman}`, cx, 250, 30, 9, INK_SOFT, "400");
    spacedCaps(ctx, desc.heading.title, cx, 320, 34, 4, INK, "700");
    divider(ctx, cx, 380, 260, INK_SOFT);
  }
  if (desc.dropCap) {
    ctx.font = `400 ${CAP_SIZE}px ${SERIF}`;
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(desc.dropCap, MARGIN_X, BODY_TOP + 58);
  }
  ctx.fillStyle = INK;
  ctx.font = BODY_FONT;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  let y = desc.heading ? BODY_TOP : TOP;
  for (const ln of desc.lines) {
    ctx.fillText(ln.text, MARGIN_X + ln.indent, y);
    y += LINE_H;
  }
  spacedCaps(ctx, String(desc.pageNo), cx, CH - 110, 24, 0, INK_SOFT, "400");
  return toTexture(c);
}
