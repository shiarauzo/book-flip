import { layoutBook, renderPage, type PageDesc } from "../textures";
import type { ChapterMark, PageSource } from "./pageSource";

/** The built-in demo: the full text of Alice's Adventures in Wonderland. */
export function createAliceSource(): PageSource {
  const faces: PageDesc[] = layoutBook();

  const chapters: ChapterMark[] = [];
  faces.forEach((f, i) => {
    if (f.kind === "content" && f.heading) {
      chapters.push({ roman: f.heading.roman, title: f.heading.title, page: Math.ceil(i / 2) });
    }
  });

  return {
    faceCount: faces.length,
    chapters,
    label: "Alice's Adventures in Wonderland",
    renderFace: (i) => renderPage(faces[i]),
    dispose: () => {},
  };
}
