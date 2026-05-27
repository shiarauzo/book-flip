import { useCallback, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";
import { Book } from "./Book";

export default function App() {
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const next = useCallback(() => setPage((p) => (p >= total ? 0 : p + 1)), [total]);
  const prev = useCallback(() => setPage((p) => Math.max(p - 1, 0)), []);

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

      <Canvas
        shadows={false}
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
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
        <color attach="background" args={["#ece9e4"]} />
        <fog attach="fog" args={["#ece9e4", 9, 16]} />

        {/* Stylized lighting: soft fill + one shaping key light. */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 4]} intensity={1.4} />
        <directionalLight position={[-4, 2, -2]} intensity={0.4} />
        <Environment preset="apartment" />

        <Book page={page} onTotal={setTotal} onAdvance={next} />

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
