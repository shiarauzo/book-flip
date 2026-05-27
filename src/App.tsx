import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";
import { Book } from "./Book";

export default function App() {
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

        <Book />

        <ContactShadows
          position={[0, -1.55, 0]}
          opacity={0.4}
          scale={10}
          blur={2.6}
          far={4}
          color="#3a3530"
        />
      </Canvas>

      <p className="hint">Click to turn the page</p>
    </>
  );
}
