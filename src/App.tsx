import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";
import { Book } from "./Book";
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

  const loadPdf = useCallback(
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
        const buf = await file.arrayBuffer();
        const doc = await loadPdfDocument(buf, setProgress);
        const next = await createPdfSource(doc, file.name.replace(/\.pdf$/i, ""));
        setSource((prev) => {
          if (prev !== alice) prev.dispose();
          return next;
        });
        setPage(0);
      } catch (e) {
        setError((e as Error).message ?? "Couldn't open that PDF.");
      } finally {
        setBusy(false);
      }
    },
    [alice],
  );

  const resetToAlice = useCallback(() => {
    setSource((prev) => {
      if (prev !== alice) prev.dispose();
      return alice;
    });
    setPage(0);
    setError(null);
  }, [alice]);

  const isPdf = source !== alice;

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
      if (file) loadPdf(file);
    };
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [loadPdf]);

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

  // Keyboard: arrows / space / page keys / home / end / escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
        case "Escape":
          setToc(false);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, total]);

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
        Alice's Adventures in Wonderland — an interactive 3D book
      </h1>

      <div className={`loader${ready ? " loader--hidden" : ""}`} aria-hidden="true" />

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
            "A 3D edition of Alice's Adventures in Wonderland. Click, tap, or press the arrow keys to turn the pages.",
          );
        }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 5, 4]} intensity={1.5} color="#fff4e2" />
        <directionalLight position={[-4, 2, -2]} intensity={0.45} color="#dfe8ff" />

        <Suspense fallback={null}>
          <Environment preset="apartment" />
          <Book
            source={source}
            page={page}
            onTotal={setTotal}
            onTurn={turn}
            onReady={() => setReady(true)}
            onChapters={setChapters}
          />
        </Suspense>

        <ContactShadows
          position={[0, -1.6, 0]}
          opacity={0.55}
          scale={11}
          blur={2.8}
          far={4}
          color="#2a2417"
        />
      </Canvas>

      <div className="sr-only" role="status" aria-live="polite">
        {announce}
      </div>

      <p className="book-label" title={source.label}>
        {source.label}
      </p>

      <UploadButton onFile={loadPdf} busy={busy} />
      {isPdf && (
        <button type="button" className="reset-btn" onClick={resetToAlice}>
          ↺ Alice
        </button>
      )}

      {busy && <LoadingOverlay label={loadingLabel} progress={progress} />}

      {error && <ErrorToast message={error} onClose={() => setError(null)} />}

      {dragging && (
        <div className="dropzone" aria-hidden="true">
          <div className="dropzone__inner">Drop your PDF to read it</div>
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
  );
}
