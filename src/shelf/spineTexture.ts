import * as THREE from "three";

const SW = 256;
const SH = 1024;
const SERIF = "'EB Garamond', Georgia, 'Times New Roman', serif";

/** A book-spine texture: vertical title on a coloured cloth ground with gold rules. */
export function spineTexture(
  title: string,
  { bg = "#1f4e46", ink = "#d8b46a" }: { bg?: string; ink?: string } = {},
): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = SW;
  c.height = SH;
  const ctx = c.getContext("2d")!;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SW, SH);

  // subtle vertical sheen
  const g = ctx.createLinearGradient(0, 0, SW, 0);
  g.addColorStop(0, "rgba(0,0,0,0.18)");
  g.addColorStop(0.5, "rgba(255,255,255,0.06)");
  g.addColorStop(1, "rgba(0,0,0,0.2)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SW, SH);

  ctx.strokeStyle = ink;
  ctx.lineWidth = 3;
  ctx.strokeRect(16, 16, SW - 32, SH - 32);

  // vertical title (reads top→bottom)
  ctx.save();
  ctx.translate(SW / 2, SH / 2);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const text = title.toUpperCase();
  let size = 50;
  const maxLen = SH - 120;
  ctx.font = `500 ${size}px ${SERIF}`;
  while (ctx.measureText(text).width > maxLen && size > 22) {
    size -= 2;
    ctx.font = `500 ${size}px ${SERIF}`;
  }
  ctx.fillText(text, 0, 0);
  ctx.restore();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
