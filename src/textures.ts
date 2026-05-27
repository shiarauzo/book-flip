import * as THREE from "three";

// Page aspect must match the geometry (PAGE_W / PAGE_H = 2.2 / 3.0).
const CW = 1024;
const CH = Math.round((CW * 3.0) / 2.2); // 1396

const TEAL = "#1f4e46";
const GOLD = "#d8b46a";
const CREAM_INK = "#f3ead2";
const PAPER = "#faf6ec";
const INK = "#2b2a26";
const INK_SOFT = "#6b6354";

const SERIF = "Georgia, 'Times New Roman', serif";

function canvas() {
  const c = document.createElement("canvas");
  c.width = CW;
  c.height = CH;
  const ctx = c.getContext("2d")!;
  return { c, ctx };
}

function toTexture(c: HTMLCanvasElement, mirror = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (mirror) {
    // The back face of a plane shows the texture mirrored; flip it back so
    // text reads correctly when this page faces the camera after the flip.
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.x = -1;
    t.offset.x = 1;
  }
  return t;
}

/** Center a line of letter-spaced small caps. */
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

/** A small diamond divider with flanking rules. */
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

/** Wrap a paragraph; returns the y after the last line. */
function paragraph(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
  indent = 0,
): number {
  const words = text.split(" ");
  let line = "";
  let first = true;
  ctx.textAlign = "left";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    const startX = first ? x + indent : x;
    if (ctx.measureText(test).width > maxW - (first ? indent : 0) && line) {
      ctx.fillText(line, startX, y);
      line = word;
      y += lineH;
      first = false;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, first ? x + indent : x, y);
  return y + lineH;
}

/** Front cover — the book's title. */
export function coverTexture(): THREE.CanvasTexture {
  const { c, ctx } = canvas();
  ctx.fillStyle = TEAL;
  ctx.fillRect(0, 0, CW, CH);

  // Subtle cloth vignette.
  const g = ctx.createRadialGradient(CW / 2, CH / 2, 100, CW / 2, CH / 2, CH);
  g.addColorStop(0, "rgba(255,255,255,0.05)");
  g.addColorStop(1, "rgba(0,0,0,0.18)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CW, CH);

  // Gold border frame.
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

  return toTexture(c);
}

/** Inner title page (left page of the open spread). Mirrored for the back face. */
export function titlePageTexture(): THREE.CanvasTexture {
  const { c, ctx } = canvas();
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, CW, CH);

  const cx = CW / 2;
  spacedCaps(ctx, "Alice's Adventures", cx, 470, 58, 4, INK, "400");
  spacedCaps(ctx, "in Wonderland", cx, 560, 58, 4, INK, "400");

  divider(ctx, cx, 660, 300, INK_SOFT);

  spacedCaps(ctx, "by", cx, 760, 30, 4, INK_SOFT, "400");
  spacedCaps(ctx, "Lewis Carroll", cx, 830, 44, 8, INK, "400");

  spacedCaps(ctx, "With Forty-Two Illustrations", cx, CH - 320, 24, 4, INK_SOFT, "400");
  spacedCaps(ctx, "by John Tenniel", cx, CH - 280, 24, 4, INK_SOFT, "400");

  spacedCaps(ctx, "VolumeOne Publishing", cx, CH - 150, 22, 5, INK_SOFT, "400");

  return toTexture(c, true);
}

/** Chapter opening (right page of the open spread). */
export function chapterTexture(): THREE.CanvasTexture {
  const { c, ctx } = canvas();
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, CW, CH);

  const cx = CW / 2;
  const marginX = 130;
  const colW = CW - marginX * 2;

  spacedCaps(ctx, "Chapter I", cx, 230, 34, 10, INK_SOFT, "400");
  spacedCaps(ctx, "Down the Rabbit-Hole", cx, 300, 40, 5, INK, "700");
  divider(ctx, cx, 360, 280, INK_SOFT);

  ctx.fillStyle = INK;
  ctx.font = `400 33px ${SERIF}`;
  const lineH = 50;
  let y = 470;

  const paras = [
    'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, "and what is the use of a book," thought Alice, "without pictures or conversations?"',
    "So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid) whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.",
  ];

  for (const p of paras) {
    y = paragraph(ctx, p, marginX, y, colW, lineH, 40);
    y += 14;
  }

  // Page number.
  spacedCaps(ctx, "1", cx, CH - 110, 26, 0, INK_SOFT, "400");

  return toTexture(c);
}
