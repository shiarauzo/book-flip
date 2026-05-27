# book-flip

A 3D edition of *Alice's Adventures in Wonderland* you read by clicking. The
cover swings open, then **each click turns one leaf** — the sheet lifts with
weight and curls like real paper — flowing through the title page and Chapter I,
"Down the Rabbit-Hole". After the last page it loops back to the cover.

Built with **React Three Fiber + drei + Vite**. Desktop-first.

The page content (cover, title page, chapter text) is drawn to `<canvas>` and
mapped onto the sheets as textures — see [`src/textures.ts`](src/textures.ts).
The chapter text auto-paginates across as many pages as it needs; it's the
opening of "Down the Rabbit-Hole" from Lewis Carroll's public-domain original.

## How the motion works

The page curl is the heart of it. Instead of rotating pages rigidly around the
spine (which looks like a board game), each sheet is a subdivided plane whose
vertices are bent in a **vertex shader**, driven by a single uniform
`uProgress` in `[0,1]`:

- `0` → the sheet lies flat, extending +x from the spine at `x = 0`.
- `1` → the sheet has flipped a full `π` around the spine, landing on −x.
- `uBend` bows the sheet out of plane mid-flip — the paper curve.

The shader is patched into a `MeshStandardMaterial` via `onBeforeCompile`
(see [`src/bendMaterial.ts`](src/bendMaterial.ts)), so the bent page keeps full
PBR lighting, environment reflections and the scene's stylized lights/shadows —
we only override vertex positions and normals.

The book is a stack of **leaves** ([`src/Book.tsx`](src/Book.tsx)), each a
front/back plane pair sharing one bend-uniforms set (the back texture is flipped
in U so it reads right-way-round once turned). A `page` counter tracks how many
leaves are turned; every leaf damps its own `uProgress` toward turned (1) or not
(0), so only the leaf you flip animates. The stacking offset lives in the shader
(`uStackZ`, before the flip) so turning inverts sheet order — the turned leaf
lands on top of the left pile, like a real book. A subtle idle bob + sway fades
out once open, and the camera does a small push-in / reframe.

Clicks are caught by both the book and an invisible backdrop plane, because the
GPU-side vertex bend is invisible to the CPU raycaster. Direction comes from the
pointer's screen half — left turns back, right turns forward — so hit-testing the
curled geometry is never needed.

## Craft & accessibility

- **Keyboard**: arrows / space / page-up·down / home / end turn pages; an
  `aria-live` region announces each spread and a `progressbar` tracks position.
- **`prefers-reduced-motion`**: drops the idle sway and snaps page turns.
- **On-demand rendering**: `frameloop="demand"` — the loop invalidates only while
  something is moving and snaps to rest, so the GPU sleeps while you read.
- **Resource hygiene**: every texture, material and geometry is disposed on unmount.
- **Typography**: pages are set in EB Garamond (preloaded before the canvas paints)
  with a raised drop-cap opening Chapter I.
- **Material detail**: linen-weave hardcover, paper grain + inner vignette on the
  leaves, a real page-block fore-edge, and an engraved pocket-watch frontispiece.
- **Responsive**: the camera reframes by aspect ratio for portrait / mobile, with
  a gentle load fade-in and safe-area-aware controls.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

## Tweak the feel

Everything that defines the motion lives in a few constants:

- **Content** — paragraphs of `ALICE_CH1` in `src/textures.ts` (add more; it
  auto-paginates into more leaves).
- **Bend strength / page size** — `PAGE_W`, the `bend` values in `src/Book.tsx`.
- **Palette** — `COVER`, `TEAL`, `PAPER`, … in `src/textures.ts`.
- **Speed** — the `damp` lambda in the `useFrame` of `src/Book.tsx`.
- **Camera framing** — `CAM_CLOSED` / `CAM_OPEN` / `LOOK_*` in `src/Book.tsx`.

## Roadmap (v2 ideas)

- Drag-to-flip: the same `uProgress`, driven by the pointer instead of a tween.
- A gentle page-turn sound (after the first user gesture).
- More chapters and Tenniel plates; lazy-generate page textures as you approach them.
