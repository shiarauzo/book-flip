import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { createBendMaterial } from "./bendMaterial";

const PAGE_W = 2.2;
const PAGE_H = 3.0;

// Palette — stylized clean: deep teal hardcover on warm cream pages.
const COVER = "#1f4e46";
const COVER_BACK = "#173f39";
const CREAM = "#f7f4ee";
const CREAM_DEEP = "#efe9df";

// Camera framing: closed (right-weighted) -> open (pushed in, shifted left).
const CAM_CLOSED = new THREE.Vector3(0.5, 0.7, 6.4);
const CAM_OPEN = new THREE.Vector3(-0.2, 0.85, 5.3);
const LOOK_CLOSED = new THREE.Vector3(0.7, 0.0, 0.0);
const LOOK_OPEN = new THREE.Vector3(-0.05, 0.0, 0.0);

function smoothstep(x: number) {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

export function Book({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { camera } = useThree();

  // One subdivided plane reused by every sheet; left edge sits on the spine (x=0).
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(PAGE_W, PAGE_H, 48, 2);
    g.translate(PAGE_W / 2, 0, 0);
    return g;
  }, []);

  // The cover is almost rigid (tiny flex); the page bows like real paper.
  const cover = useMemo(
    () => createBendMaterial({ color: COVER, bend: 0.06, width: PAGE_W }),
    [],
  );
  const page = useMemo(
    () => createBendMaterial({ color: CREAM, bend: 0.55, width: PAGE_W }),
    [],
  );

  // Static sheets revealed once the cover swings away.
  const backMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: COVER_BACK,
        roughness: 0.85,
        side: THREE.DoubleSide,
      }),
    [],
  );
  const blockMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: CREAM_DEEP,
        roughness: 0.9,
        side: THREE.DoubleSide,
      }),
    [],
  );

  const group = useRef<THREE.Group>(null);
  const coverProg = useRef(0);
  const pageProg = useRef(0);
  const lookAt = useRef(LOOK_CLOSED.clone());
  const camPos = useRef(CAM_CLOSED.clone());

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const target = open ? 1 : 0;

    // Cover leads; the page trails it for a natural staggered turn.
    coverProg.current = THREE.MathUtils.damp(coverProg.current, target, 4, dt);
    pageProg.current = THREE.MathUtils.damp(
      pageProg.current,
      coverProg.current,
      3,
      dt,
    );
    cover.uniforms.uProgress.value = coverProg.current;
    page.uniforms.uProgress.value = pageProg.current;

    const eased = smoothstep(coverProg.current);

    // Idle: gentle bob + sway that fades out as the book opens.
    if (group.current) {
      const t = state.clock.elapsedTime;
      const idle = 1 - eased;
      group.current.position.y = Math.sin(t * 0.9) * 0.04 * idle;
      group.current.rotation.y = -0.32 + Math.sin(t * 0.5) * 0.05 * idle;
      group.current.rotation.x = -0.12;
    }

    // Camera push-in + reframe, smoothed.
    camPos.current.lerpVectors(CAM_CLOSED, CAM_OPEN, eased);
    lookAt.current.lerpVectors(LOOK_CLOSED, LOOK_OPEN, eased);
    camera.position.x = THREE.MathUtils.damp(camera.position.x, camPos.current.x, 5, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, camPos.current.y, 5, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, camPos.current.z, 5, dt);
    camera.lookAt(lookAt.current);
  });

  const setCursor = (c: string) => {
    document.body.style.cursor = c;
  };

  return (
    <group
      ref={group}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onPointerOver={() => setCursor("pointer")}
      onPointerOut={() => setCursor("auto")}
    >
      {/* back cover (static) */}
      <mesh geometry={geometry} material={backMat} position={[0, 0, 0]} />
      {/* inner page block (static, revealed on open) */}
      <mesh geometry={geometry} material={blockMat} position={[0, 0, 0.012]} />
      <mesh geometry={geometry} material={blockMat} position={[0, 0, 0.024]} />
      {/* first page (bends, trails the cover) */}
      <mesh geometry={geometry} material={page.material} position={[0, 0, 0.04]} />
      {/* front cover (almost rigid, leads) */}
      <mesh geometry={geometry} material={cover.material} position={[0, 0, 0.06]} />
      {/* spine */}
      <mesh position={[0, 0, 0.03]}>
        <boxGeometry args={[0.05, PAGE_H, 0.075]} />
        <meshStandardMaterial color={COVER} roughness={0.8} />
      </mesh>
    </group>
  );
}
