import { Suspense, useCallback, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";
import { Book } from "./Book";

export default function App() {
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [ready, setReady] = useState(false);

  const next = useCallback(() => setPage((p) => (p >= total ? 0 : p + 1)), [total]);
  const prev = useCallback(() => setPage((p) => Math.max(p - 1, 0)), []);
  const turn = useCallback((dir: 1 | -1) => (dir < 0 ? prev() : next()), [prev, next]);

  // Keyboard: arrows / space / page keys / home / end.
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
    page === 0 ? "Click, or press → to open" : page >= total ? "Click to start over" : "Click, or use ← →";

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
          // Reveal once the first frame has actually painted.
          requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
        }}
      >
        {/* Transparent canvas — the warm radial background lives in CSS (one source).
            Stylized lighting: warm key, cool fill, soft ambient. */}
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 5, 4]} intensity={1.5} color="#fff4e2" />
        <directionalLight position={[-4, 2, -2]} intensity={0.45} color="#dfe8ff" />

        <Suspense fallback={null}>
          <Environment preset="apartment" />
          <Book page={page} onTotal={setTotal} onTurn={turn} />
        </Suspense>

        <ContactShadows
          position={[0, -1.55, 0]}
          opacity={0.4}
          scale={10}
          blur={2.6}
          far={4}
          color="#3a3530"
        />
      </Canvas>

      <div className="sr-only" role="status" aria-live="polite">
        {announce}
      </div>

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
        <button type="button" className="nav-btn" onClick={next} aria-label="Next page">
          ›
        </button>
      </div>
    </>
  );
}
