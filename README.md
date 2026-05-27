# book-flip

A 3D book that opens with a satisfying page-bend motion. Click the cover and it
swings open — the front cover lifts with weight, the first page trails behind it
and curls like real paper. Click again to close. The motion *is* the project.

Built with **React Three Fiber + drei + Vite**. Desktop-first.

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

The choreography ([`src/Book.tsx`](src/Book.tsx)) damps `uProgress` toward its
target with `THREE.MathUtils.damp` for a smooth ease. The cover leads; the page
damps toward the cover's progress so it trails naturally. A subtle idle bob +
sway fades out as the book opens, and the camera does a small push-in / reframe.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

## Tweak the feel

Everything that defines the motion lives in a few constants:

- **Bend strength / page size** — `PAGE_W`, `bend` values in `src/Book.tsx`.
- **Palette** — `COVER`, `CREAM`, … in `src/Book.tsx`.
- **Speed / stagger** — the `damp` lambdas in the `useFrame` of `src/Book.tsx`
  (cover `4`, page `3`).
- **Camera framing** — `CAM_CLOSED` / `CAM_OPEN` / `LOOK_*` in `src/Book.tsx`.

## Roadmap (v2 ideas)

- Drag-to-flip: the same `uProgress`, driven by the pointer instead of a tween.
- Flip through N pages (z-ordered sheet stack + "current page" state).
- Responsive / mobile tuning (lower subdivision + dpr on small screens).

---

🤖 Scaffolded with [Claude Code](https://claude.com/claude-code)
