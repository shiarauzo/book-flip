import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { createBendMaterial, type BendUniforms } from "./bendMaterial";
import { chapterPages, coverTexture, endTexture, titlePageTexture } from "./textures";
import { useReducedMotion } from "./useReducedMotion";

const PAGE_W = 2.2;
const PAGE_H = 3.0;

const COVER = "#1f4e46";
const COVER_BACK = "#173f39";

// Stacking: leaf 0 (cover) sits closest to the camera; each leaf a hair behind.
const STACK_Z0 = 0.05;
const STACK_DZ = 0.01;

// Camera framing: closed (right-weighted) -> open (pushed in, shifted left).
const CAM_CLOSED = new THREE.Vector3(0.5, 0.7, 6.4);
const CAM_OPEN = new THREE.Vector3(-0.2, 0.85, 5.3);
const LOOK_CLOSED = new THREE.Vector3(0.7, 0.0, 0.0);
const LOOK_OPEN = new THREE.Vector3(-0.05, 0.0, 0.0);

function smoothstep(x: number) {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

type Leaf = {
  frontMat: THREE.Material;
  backMat: THREE.Material;
  uniforms: BendUniforms;
};

type BookProps = {
  page: number;
  onTotal: (total: number) => void;
  onAdvance: () => void;
};

export function Book({ page, onTotal, onAdvance }: BookProps) {
  const { camera } = useThree();
  const reduced = useReducedMotion();

  // One subdivided plane reused by every sheet; left edge sits on the spine (x=0).
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(PAGE_W, PAGE_H, 48, 2);
    g.translate(PAGE_W / 2, 0, 0);
    return g;
  }, []);

  // Build the book as a stack of leaves. Reading order of faces:
  //   cover · title page · chapter pages… (padded to an even count).
  // Each leaf is a sheet with a front (even face) and a back (odd face). The back
  // texture is flipped in U so it reads correctly once the sheet has turned.
  const leaves = useMemo<Leaf[]>(() => {
    const faces: THREE.Texture[] = [
      coverTexture(),
      titlePageTexture(),
      ...chapterPages(),
    ];
    if (faces.length % 2 !== 0) faces.push(endTexture());

    const out: Leaf[] = [];
    for (let i = 0; i < faces.length; i += 2) {
      const li = i / 2;
      const isCover = li === 0;
      const bend = isCover ? 0.1 : 0.5;
      const stackZ = STACK_Z0 - li * STACK_DZ;

      const front = createBendMaterial({
        map: faces[i],
        bend,
        width: PAGE_W,
        side: THREE.FrontSide,
        stackZ,
        roughness: isCover ? 0.55 : 0.9,
      });

      const backTex = faces[i + 1];
      backTex.wrapS = THREE.RepeatWrapping;
      backTex.repeat.x = -1;
      backTex.offset.x = 1;
      const back = createBendMaterial({
        map: backTex,
        bend,
        width: PAGE_W,
        side: THREE.BackSide,
        roughness: 0.9,
        uniforms: front.uniforms, // share so both faces bend as one sheet
      });

      out.push({ frontMat: front.material, backMat: back.material, uniforms: front.uniforms });
    }
    return out;
  }, []);

  const backMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: COVER_BACK,
        roughness: 0.85,
        side: THREE.DoubleSide,
      }),
    [],
  );

  // Report leaf count up so the parent can drive page state, bounds and the UI.
  useEffect(() => onTotal(leaves.length), [leaves, onTotal]);

  const group = useRef<THREE.Group>(null);
  const progs = useRef<number[]>(leaves.map(() => 0));
  const openness = useRef(0);
  const lookAt = useRef(LOOK_CLOSED.clone());
  const camPos = useRef(CAM_CLOSED.clone());

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    // Reduced motion: snap turns quickly and drop the ambient idle entirely.
    const turnLambda = reduced ? 16 : 5;

    // Each leaf eases toward turned (1) or not (0); only the one being flipped moves.
    for (let i = 0; i < leaves.length; i++) {
      const target = i < page ? 1 : 0;
      progs.current[i] = THREE.MathUtils.damp(progs.current[i], target, turnLambda, dt);
      leaves[i].uniforms.uProgress.value = progs.current[i];
    }

    openness.current = THREE.MathUtils.damp(openness.current, page > 0 ? 1 : 0, turnLambda, dt);
    const eased = smoothstep(openness.current);

    // Idle: gentle bob + sway that fades out once the book is open (off if reduced).
    if (group.current) {
      const t = state.clock.elapsedTime;
      const idle = reduced ? 0 : 1 - eased;
      group.current.position.y = Math.sin(t * 0.9) * 0.04 * idle;
      group.current.rotation.y = -0.32 + Math.sin(t * 0.5) * 0.05 * idle;
      group.current.rotation.x = -0.12;
    }

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
    <>
      {/* Invisible backdrop so a click anywhere (not just on a page) turns a leaf. */}
      <mesh
        position={[0, 0, -3]}
        onClick={onAdvance}
        onPointerOver={() => setCursor("pointer")}
        onPointerOut={() => setCursor("auto")}
      >
        <planeGeometry args={[80, 50]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <group
        ref={group}
        onClick={(e) => {
          e.stopPropagation();
          onAdvance();
        }}
        onPointerOver={() => setCursor("pointer")}
        onPointerOut={() => setCursor("auto")}
      >
        {/* back cover (static, revealed once every leaf has turned) */}
        <mesh geometry={geometry} material={backMat} position={[0, 0, 0.012]} />

        {/* leaves — front + back share one bend uniforms set; stackZ lives in the
            shader so the flip inverts sheet order, like a real book. */}
        {leaves.map((lf, i) => (
          <group key={i}>
            <mesh geometry={geometry} material={lf.frontMat} />
            <mesh geometry={geometry} material={lf.backMat} />
          </group>
        ))}

        {/* spine */}
        <mesh position={[0, 0, 0.025]}>
          <boxGeometry args={[0.05, PAGE_H, 0.06]} />
          <meshStandardMaterial color={COVER} roughness={0.8} />
        </mesh>
      </group>
    </>
  );
}
