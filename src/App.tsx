import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";
import { Book } from "./Book";
import { CameraRig, type CamTarget } from "./CameraRig";
import { Shelf, type ShelfBook } from "./shelf/Shelf";
import { addPdf, getPdfBytes, listPdfs, removePdf } from "./library/db";
import { spineColors } from "./library/spineColors";
import { createAliceSource } from "./sources/aliceSource";
import type { ChapterMark, PageSource } from "./sources/pageSource";
import { ErrorToast } from "./ui/ErrorToast";
import { LoadingOverlay } from "./ui/LoadingOverlay";
import { UploadButton } from "./ui/UploadButton";

export default function App() {
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [ready, setReady] = useState(false);
  const [chapters, setChapters] = useState<ChapterMark[]>([]);
  const [toc, setToc] = useState(false);

  // The active page source. Default: the built-in Alice demo; uploading swaps it.
  const alice = useMemo(() => createAliceSource(), []);
  const [source, setSource] = useState<PageSource>(alice);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Home is the shelf; opening a book pulls it out (transitioning) then reads.
  const [view, setView] = useState<"shelf" | "transitioning" | "reading">("shelf");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentBookId, setCurrentBookId] = useState<string | null>(null);
  const [fading, setFading] = useState(false);
  // Synchronous guards so rapid clicks can't overlap a transition or write to a
  // dead component.
  const transitioning = useRef(false);
  const viewRef = useRef<"shelf" | "transitioning" | "reading">("shelf");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  viewRef.current = view;
  const camTarget = useRef<CamTarget>({
    pos: new THREE.Vector3(0, 0, 6.5),
    look: new THREE.Vector3(0, 0, 0),
  });
  const aliceBook = useMemo<ShelfBook>(
    () => ({
      id: "alice",
      title: "Alice's Adventures in Wonderland",
      spineBg: "#1f4e46",
      spineInk: "#d8b46a",
    }),
    [],
  );
  const [library, setLibrary] = useState<ShelfBook[]>(() => [aliceBook]);
  const sourcesById = useRef(new Map<string, PageSource>());

  // Rebuild the shelf from IndexedDB on load (persisted uploads).
  useEffect(() => {
    listPdfs()
      .then((metas) =>
        setLibrary([
          aliceBook,
          ...metas.map((m) => ({ id: m.id, title: m.name, ...spineColors(m.id) })),
        ]),
      )
      .catch(() => {});
  }, [aliceBook]);

  const resolveSource = useCallback(
    async (book: ShelfBook): Promise<PageSource> => {
      if (book.id === "alice") return alice;
      const cached = sourcesById.current.get(book.id);
      if (cached) return cached;
      const { loadPdfDocument } = await import("./pdf/loadPdf");
      const { createPdfSource } = await import("./sources/pdfSource");
      const bytes = await getPdfBytes(book.id);
      if (!bytes) throw new Error("That book is no longer in your library.");
      const doc = await loadPdfDocument(bytes);
      const src = await createPdfSource(doc, book.title);
      sourcesById.current.set(book.id, src);
      return src;
    },
    [alice],
  );

  const openBook = useCallback(
    (book: ShelfBook) => {
      if (transitioning.current || viewRef.current !== "shelf") return; // no re-entry
      transitioning.current = true;
      // Pull the book out + dissolve while its source loads, then read.
      setOpeningId(book.id);
      setView("transitioning");
      setFading(true);
      setError(null);
      const minWait = new Promise((r) => window.setTimeout(r, 380));
      (async () => {
        try {
          const src = await resolveSource(book);
          await minWait;
          if (!mounted.current) return;
          setSource(src);
          setCurrentBookId(book.id);
          setPage(1); // land on the first open spread
          setView("reading");
        } catch (e) {
          await minWait;
          if (!mounted.current) return;
          setError((e as Error).message ?? "Couldn't open that book.");
          setView("shelf");
        } finally {
          transitioning.current = false;
          if (mounted.current) {
            setOpeningId(null);
            window.setTimeout(() => mounted.current && setFading(false), 60);
          }
        }
      })();
    },
    [resolveSource],
  );

  const removeBook = useCallback(
    (id: string) => {
      if (id === "alice") return;
      removePdf(id).catch(() => {});
      setLibrary((prev) => prev.filter((b) => b.id !== id));
      setSelectedId(null);
      const src = sourcesById.current.get(id);
      sourcesById.current.delete(id);
      // Never destroy the document that's currently being read.
      if (!(viewRef.current === "reading" && currentBookId === id)) src?.dispose();
    },
    [currentBookId],
  );

  const backToShelf = useCallback(() => {
    if (transitioning.current) return;
    transitioning.current = true;
    setFading(true);
    window.setTimeout(() => {
      transitioning.current = false;
      if (!mounted.current) return;
      setView("shelf");
      setPage(0);
      setChapters([]);
      setToc(false);
      setOpeningId(null);
      setCurrentBookId(null);
      window.setTimeout(() => mounted.current && setFading(false), 60);
    }, 280);
  }, []);

  // Upload: validate, persist to IndexedDB, add to the shelf (does not auto-open).
  const uploadPdf = useCallback(
    async (file: File) => {
      setError(null);
      const { validatePdfFile, loadPdfDocument } = await import("./pdf/loadPdf");
      const bad = validatePdfFile(file);
      if (bad) {
        setError(bad.message);
        return;
      }
      setLoadingLabel(file.name.replace(/\.pdf$/i, ""));
      setProgress(0);
      setBusy(true);
      try {
        const { createPdfSource } = await import("./sources/pdfSource");
        const bytes = await file.arrayBuffer();
        const name = file.name.replace(/\.pdf$/i, "");
        // Store a copy first — pdf.js may transfer/detach the buffer to its worker.
        const meta = await addPdf(name, bytes.slice(0));
        const doc = await loadPdfDocument(bytes, setProgress);
        sourcesById.current.set(meta.id, await createPdfSource(doc, name));
        setLibrary((prev) => [...prev, { id: meta.id, title: name, ...spineColors(meta.id) }]);
        // Show the new book on the shelf (dissolve out of reading if needed).
        if (viewRef.current === "reading") backToShelf();
      } catch (e) {
        setError((e as Error).message ?? "Couldn't open that PDF.");
      } finally {
        setBusy(false);
      }
    },
    [backToShelf],
  );

  // Drop a PDF anywhere on the page to open it.
  useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragging(true);
    };
    const onLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) uploadPdf(file);
    };
    const onEnd = () => setDragging(false); // Escape / app-switch cancels a drag
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragend", onEnd);
    return () => {
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragend", onEnd);
    };
  }, [uploadPdf]);

  const next = useCallback(() => setPage((p) => Math.min(p + 1, total)), [total]);
  const prev = useCallback(() => setPage((p) => Math.max(p - 1, 0)), []);
  const turn = useCallback((dir: 1 | -1) => (dir < 0 ? prev() : next()), [prev, next]);
  const jumpTo = useCallback((p: number) => {
    setPage(p);
    setToc(false);
  }, []);

  // Safety net: reveal even if the environment map never resolves.
  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 3000);
    return () => window.clearTimeout(id);
  }, []);

  // Keyboard: arrows / space / page keys / home / end / escape (reading only).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setToc(false);
        if (view === "reading") backToShelf();
        return;
      }
      if (view !== "reading") return;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case " ":
        case "PageDown":
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          e.preventDefault();
          prev();
          break;
        case "Home":
          e.preventDefault();
          setPage(0);
          break;
        case "End":
          e.preventDefault();
          setPage(total);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, total, view, backToShelf]);

  const announce =
    page === 0
      ? "Front cover. Press the right arrow or click to open the book."
      : page >= total
        ? "Back cover — the end."
        : `Reading — spread ${page} of ${total}.`;

  const hint =
    page === 0 ? "Click, or press → to open" : page >= total ? "The end · ‹ to go back" : "Click, or use ← →";

  return (
    <>
      <h1 className="sr-only">
        {view === "shelf" ? "Your bookshelf" : `${source.label} — an interactive 3D book`}
      </h1>

      {/* Keyboard / screen-reader access to the 3D shelf: focusing a book lifts
          its spine; Enter opens it. */}
      {view === "shelf" && (
        <nav className="sr-only" aria-label="Bookshelf">
          {library.map((b) => (
            <span key={b.id}>
              <button
                type="button"
                onClick={() => openBook(b)}
                onFocus={() => setSelectedId(b.id)}
                onBlur={() => setSelectedId(null)}
              >
                Open {b.title}
              </button>
              {b.id !== "alice" && (
                <button type="button" onClick={() => removeBook(b.id)}>
                  Remove {b.title} from the shelf
                </button>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className={`loader${ready ? " loader--hidden" : ""}`} aria-hidden="true" />

      {/* Quick dissolve that masks the shelf↔reading swap. */}
      <div className={`fade${fading ? " fade--on" : ""}`} aria-hidden="true" />

      <Canvas
        shadows={false}
        frameloop="demand"
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
        camera={{ position: [0.5, 0.7, 6.4], fov: 35 }}
        onCreated={({ gl }) => {
          const el = gl.domElement;
          el.setAttribute("role", "application");
          el.setAttribute(
            "aria-label",
            "An interactive 3D book. Click, tap, or press the arrow keys to turn the pages.",
          );
        }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 5, 4]} intensity={1.5} color="#fff4e2" />
        <directionalLight position={[-4, 2, -2]} intensity={0.45} color="#dfe8ff" />

        <Suspense fallback={null}>
          <Environment preset="apartment" />
        </Suspense>

        <CameraRig target={camTarget} />

        {view === "reading" ? (
          <Book
            source={source}
            page={page}
            camTarget={camTarget}
            onTotal={setTotal}
            onTurn={turn}
            onReady={() => setReady(true)}
            onChapters={setChapters}
          />
        ) : (
          <Shelf
            books={library}
            camTarget={camTarget}
            openingId={openingId}
            selectedId={selectedId}
            onOpen={openBook}
            onReady={() => setReady(true)}
          />
        )}

        <ContactShadows
          position={[0, -1.6, 0]}
          opacity={0.55}
          scale={11}
          blur={2.8}
          far={4}
          color="#2a2417"
        />
      </Canvas>

      {view === "reading" && (
        <>
          <div className="sr-only" role="status" aria-live="polite">
            {announce}
          </div>
          <p className="book-label" title={source.label}>
            {source.label}
          </p>
        </>
      )}

      <div className="top-actions">
        {view === "reading" && (
          <button type="button" className="reset-btn" onClick={backToShelf}>
            ← Shelf
          </button>
        )}
        <UploadButton onFile={uploadPdf} busy={busy} />
      </div>

      {busy && <LoadingOverlay label={loadingLabel} progress={progress} />}

      {error && <ErrorToast message={error} onClose={() => setError(null)} />}

      {dragging && (
        <div className="dropzone" aria-hidden="true">
          <div className="dropzone__inner">Drop your PDF to read it</div>
        </div>
      )}

      {/* Phones: the spread is widest in landscape — nudge a rotate (CSS-gated). */}
      {view === "reading" && (
        <div className="rotate-hint" aria-hidden="true">
          <div className="rotate-hint__inner">
            <span className="rotate-hint__icon">↻</span>
            <span>Rotate your phone to read the book</span>
          </div>
        </div>
      )}

      {/* Table of contents — only when this book exposes chapters/bookmarks */}
      {chapters.length > 0 && (
        <button
          type="button"
          className="toc-toggle"
          aria-expanded={toc}
          aria-controls="toc-panel"
          onClick={() => setToc((o) => !o)}
        >
          {toc ? "Close" : "Contents"}
        </button>
      )}

      {toc && chapters.length > 0 && (
        <>
          <div className="toc-scrim" onClick={() => setToc(false)} aria-hidden="true" />
          <nav id="toc-panel" className="toc" aria-label="Table of contents">
            <p className="toc__head">Contents</p>
            <button type="button" className="toc__item" onClick={() => jumpTo(0)}>
              <span className="toc__num">—</span>
              <span className="toc__title">Cover</span>
            </button>
            {chapters.map((c) => (
              <button
                type="button"
                className="toc__item"
                key={c.roman}
                onClick={() => jumpTo(c.page)}
              >
                <span className="toc__num">{c.roman}</span>
                <span className="toc__title">{c.title}</span>
              </button>
            ))}
          </nav>
        </>
      )}

      {view === "reading" && (
        <>
          <div
            className="progress"
            role="progressbar"
            aria-label="Reading progress"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={page}
          >
            <div
              className="progress__fill"
              style={{ transform: `scaleX(${total ? page / total : 0})` }}
            />
          </div>

          <div className="controls">
            <button
              type="button"
              className="nav-btn"
              onClick={prev}
              disabled={page === 0}
              aria-label="Previous page"
            >
              ‹
            </button>
            <p className="hint" style={{ opacity: page === 0 ? 1 : 0.6 }}>
              {hint}
            </p>
            <button
              type="button"
              className="nav-btn"
              onClick={next}
              disabled={page >= total}
              aria-label="Next page"
            >
              ›
            </button>
          </div>
        </>
      )}
    </>
  );
}
