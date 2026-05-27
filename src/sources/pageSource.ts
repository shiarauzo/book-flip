import type * as THREE from "three";

/** A chapter/section the contents index can jump to. `page` is the spread index. */
export type ChapterMark = { roman: string; title: string; page: number };

/**
 * A source of book pages for the 3D renderer. The book is a stack of faces
 * (face 0 = cover/recto when closed, then alternating left/right pages).
 * `faceCount` must be odd so the final spread ends on a right-hand page.
 * `renderFace` is called lazily (only for the visible window) and may be async
 * — the renderer shows a blank page until the texture resolves.
 */
export interface PageSource {
  faceCount: number;
  chapters: ChapterMark[];
  label: string;
  renderFace(i: number): THREE.CanvasTexture | Promise<THREE.CanvasTexture>;
  dispose(): void;
}
