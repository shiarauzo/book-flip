import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";
import { Book } from "./Book";

export default function App() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Canvas
        shadows={false}
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        camera={{ position: [0.5, 0.7, 6.4], fov: 35 }}
      >
        <color attach="background" args={["#ece9e4"]} />
        <fog attach="fog" args={["#ece9e4", 9, 16]} />

        {/* Stylized lighting: soft fill + one shaping key light. */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 4]} intensity={1.4} />
        <directionalLight position={[-4, 2, -2]} intensity={0.4} />
        <Environment preset="apartment" />

        <Book open={open} onToggle={() => setOpen((o) => !o)} />

        <ContactShadows
          position={[0, -1.55, 0]}
          opacity={0.4}
          scale={10}
          blur={2.6}
          far={4}
          color="#3a3530"
        />
      </Canvas>

      <p className="hint" style={{ opacity: open ? 0 : 1 }}>
        Click the book
      </p>
    </>
  );
}
