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

const SERIF = "'EB Garamond', Georgia, 'Times New Roman', serif";

// The opening of "Down the Rabbit-Hole" (Lewis Carroll, public domain).
const ALICE_CH1 = [
  "Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, “and what is the use of a book,” thought Alice, “without pictures or conversations?”",
  "So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.",
  "There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to hear the Rabbit say to itself, “Oh dear! Oh dear! I shall be too late!” But when the Rabbit actually took a watch out of its waistcoat-pocket, and looked at it, and then hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen a rabbit with either a waistcoat-pocket, or a watch to take out of it.",
  "Burning with curiosity, she ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole under the hedge. In another moment down went Alice after it, never once considering how in the world she was to get out again.",
  "The rabbit-hole went straight on like a tunnel for some way, and then dipped suddenly down, so suddenly that Alice had not a moment to think about stopping herself before she found herself falling down a very deep well.",
  "Either the well was very deep, or she fell very slowly, for she had plenty of time as she went down to look about her, and to wonder what was going to happen next. She noticed that the sides of the well were filled with cupboards and book-shelves; here and there she saw maps and pictures hung upon pegs.",
  "Down, down, down. Would the fall never come to an end? “I wonder how many miles I’ve fallen by this time?” she said aloud. “I must be getting somewhere near the centre of the earth. Let me see: that would be four thousand miles down, I think—”",
  "“—yes, that’s about the right distance—but then I wonder what Latitude or Longitude I’ve got to?” (Alice had not the slightest idea what Latitude was, or Longitude either, but thought they were nice grand words to say.)",
  "Down, down, down. There was nothing else to do, so Alice soon began talking again. “Dinah’ll miss me very much to-night, I should think!” (Dinah was the cat.) “I hope they’ll remember her saucer of milk at tea-time. Dinah my dear, I wish you were down here with me!”",
  "Suddenly, thump! thump! down she came upon a heap of sticks and dry leaves, and the fall was over. Alice was not a bit hurt, and she jumped up on to her feet in a moment: she looked up, but it was all dark overhead; before her was another long passage, and the White Rabbit was still in sight, hurrying down it.",
  "There was not a moment to be lost: away went Alice like the wind, and was just in time to hear it say, as it turned a corner, “Oh my ears and whiskers, how late it’s getting!” She was close behind it when she turned the corner, but the Rabbit was no longer to be seen.",
  "She found herself in a long, low hall, which was lit up by a row of lamps hanging from the roof. There were doors all round the hall, but they were all locked; and when Alice had been all the way down one side and up the other, trying every door, she walked sadly down the middle, wondering how she was ever to get out again.",
  "Suddenly she came upon a little three-legged table, all made of solid glass; there was nothing on it except a tiny golden key, and Alice’s first thought was that it might belong to one of the doors of the hall; but, alas! either the locks were too large, or the key was too small, but at any rate it would not open any of them.",
  "However, on the second time round, she came upon a low curtain she had not noticed before, and behind it was a little door about fifteen inches high: she tried the little golden key in the lock, and to her great delight it fitted!",
  "Alice opened the door and found that it led into a small passage: she knelt down and looked along it into the loveliest garden you ever saw. How she longed to get out of that dark hall, and wander about among those beds of bright flowers and those cool fountains — but she could not even get her head through the doorway.",
];

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

// A cached 128px noise tile reused as a repeating pattern for paper/cloth grain.
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

/** Cloth-bound cover fill: base colour, a fine linen weave, grain, and vignette. */
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

/** Warm paper fill: base colour, fine grain, and a soft inner vignette. */
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

/** Front cover — the book's title. */
export function coverTexture(): THREE.CanvasTexture {
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

  return toTexture(c);
}

/** The White Rabbit's engraved pocket watch — frontispiece motif ("I shall be late!"). */
function pocketWatch(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Crown stem + bow ring at the top.
  ctx.fillRect(cx - 8, cy - r - 20, 16, 16);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy - r - 26, 13, Math.PI * 0.12, Math.PI * 0.88, false);
  ctx.stroke();

  // Case + inner bezel.
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 14, 0, Math.PI * 2);
  ctx.stroke();

  // Roman numerals around the dial.
  const nums = ["XII", "I", "II", "III", "IIII", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `400 ${Math.round(r * 0.2)}px ${SERIF}`;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const rr = r - 34;
    ctx.fillText(nums[i], cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }

  // Hands — a few minutes to noon, ever so late.
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

/** Inner title page, opening on the pocket-watch frontispiece. */
export function titlePageTexture(): THREE.CanvasTexture {
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

  return toTexture(c);
}

/**
 * Flow Chapter I across as many pages as it needs. The first page carries the
 * chapter heading; every page is numbered. Returns one texture per page.
 */
export function chapterPages(): THREE.CanvasTexture[] {
  const marginX = 130;
  const colW = CW - marginX * 2;
  const lineH = 50;
  const bodyTop = 230;
  const bottom = CH - 200;

  const out: HTMLCanvasElement[] = [];
  let ctx!: CanvasRenderingContext2D;
  let y = 0;
  let pageNum = 0;
  const cx = CW / 2;

  const drawPageNum = () => {
    spacedCaps(ctx, String(pageNum), cx, CH - 120, 26, 0, INK_SOFT, "400");
  };

  const startPage = (first: boolean) => {
    if (out.length) drawPageNum();
    const cv = canvas();
    ctx = cv.ctx;
    paperFill(ctx);
    out.push(cv.c);
    pageNum++;
    if (first) {
      spacedCaps(ctx, "Chapter I", cx, 250, 34, 10, INK_SOFT, "400");
      spacedCaps(ctx, "Down the Rabbit-Hole", cx, 320, 40, 5, INK, "700");
      divider(ctx, cx, 380, 280, INK_SOFT);
      y = 500;
    } else {
      y = bodyTop;
    }
    ctx.fillStyle = INK;
    ctx.font = `400 33px ${SERIF}`;
    ctx.textAlign = "left";
  };

  // Greedy word-wrap into lines; the available width can vary per line index
  // (used to wrap the opening lines around the drop-cap).
  const layout = (text: string, widthForLine: (i: number) => number): string[] => {
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
  };

  const drawLine = (txt: string, x: number) => {
    if (y > bottom) startPage(false);
    ctx.fillText(txt, x, y);
    y += lineH;
  };

  startPage(true);

  // First paragraph opens with a raised drop-cap "A".
  const [opening, ...rest] = ALICE_CH1;
  const cap = opening.slice(0, 1);
  const body = opening.slice(1).replace(/^\s+/, "");

  ctx.font = `400 104px ${SERIF}`;
  const capW = ctx.measureText(cap).width;
  ctx.fillStyle = INK;
  ctx.fillText(cap, marginX, y + 66);
  ctx.font = `400 33px ${SERIF}`;

  const capLines = 2; // lines that sit beside the cap
  const capIndent = capW + 18;
  layout(body, (i) => colW - (i < capLines ? capIndent : 0)).forEach((ln, i) =>
    drawLine(ln, marginX + (i < capLines ? capIndent : 0)),
  );
  y += 16;

  // Remaining paragraphs: first line indented, then flush left.
  for (const para of rest) {
    layout(para, (i) => colW - (i === 0 ? 40 : 0)).forEach((ln, i) =>
      drawLine(ln, marginX + (i === 0 ? 40 : 0)),
    );
    y += 16;
  }
  drawPageNum();

  return out.map(toTexture);
}

/** A blank page used to pad the leaf count to an even number / close the excerpt. */
export function endTexture(): THREE.CanvasTexture {
  const { c, ctx } = canvas();
  paperFill(ctx);
  const cx = CW / 2;
  divider(ctx, cx, CH / 2 - 60, 200, INK_SOFT);
  spacedCaps(ctx, "End of excerpt", cx, CH / 2 + 10, 26, 6, INK_SOFT, "400");
  return toTexture(c);
}
