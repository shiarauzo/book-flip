import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
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

type Leaf = {
  frontMat: THREE.Material;
  backMat: THREE.Material;
  uniforms: BendUniforms;
};

type Built = {
  geometry: THREE.PlaneGeometry;
  leaves: Leaf[];
  backMat: THREE.MeshStandardMaterial;
};

// Build the whole book (geometry + leaves + back cover) outside React so it can be
// created once and disposed deterministically. Reading order of faces:
//   cover · title page · chapter pages… (padded to an even count). Each leaf is a
// sheet with a front (even face) and back (odd face); the back texture is flipped
// in U so it reads correctly once the sheet has turned.
function buildBook(): Built {
  const geometry = new THREE.PlaneGeometry(PAGE_W, PAGE_H, 48, 2);
  geometry.translate(PAGE_W / 2, 0, 0);

  const faces: THREE.Texture[] = [coverTexture(), titlePageTexture(), ...chapterPages()];
  if (faces.length % 2 !== 0) faces.push(endTexture());

  const leaves: Leaf[] = [];
  for (let i = 0; i < faces.length; i += 2) {
    const li = i / 2;
    const isCover = li === 0;
    const front = createBendMaterial({
      map: faces[i],
      bend: isCover ? 0.1 : 0.5,
      width: PAGE_W,
      side: THREE.FrontSide,
      stackZ: STACK_Z0 - li * STACK_DZ,
      roughness: isCover ? 0.55 : 0.9,
    });

    const backTex = faces[i + 1];
    backTex.wrapS = THREE.RepeatWrapping;
    backTex.repeat.x = -1;
    backTex.offset.x = 1;
    const back = createBendMaterial({
      map: backTex,
      side: THREE.BackSide,
      roughness: 0.9,
      uniforms: front.uniforms, // share so both faces bend as one sheet
    });

    leaves.push({ frontMat: front.material, backMat: back.material, uniforms: front.uniforms });
  }

  const backMat = new THREE.MeshStandardMaterial({
    color: COVER_BACK,
    roughness: 0.85,
    side: THREE.FrontSide,
  });

  return { geometry, leaves, backMat };
}

function disposeBook(b: Built) {
  b.geometry.dispose();
  b.backMat.dispose();
  for (const lf of b.leaves) {
    (lf.frontMat as THREE.MeshStandardMaterial).map?.dispose();
    (lf.backMat as THREE.MeshStandardMaterial).map?.dispose();
    lf.frontMat.dispose();
    lf.backMat.dispose();
  }
}

type BookProps = {
  page: number;
  onTotal: (total: number) => void;
  onTurn: (dir: 1 | -1) => void;
  onReady: () => void;
};

export function Book({ page, onTotal, onTurn, onReady }: BookProps) {
  const { camera } = useThree();
  const invalidate = useThree((s) => s.invalidate);
  const reduced = useReducedMotion();

  // Build once. The ref lets us dispose the set discarded by React StrictMode's
  // double-invoked render (dev only), so no GPU resource ever leaks.
  const builtRef = useRef<Built | null>(null);
  const { geometry, leaves, backMat } = useMemo(() => {
    if (builtRef.current) disposeBook(builtRef.current);
    builtRef.current = buildBook();
    return builtRef.current;
  }, []);

  // Report leaf count up so the parent can drive page state, bounds and the UI.
  useEffect(() => onTotal(leaves.length), [leaves, onTotal]);

  // Book only mounts once the Suspense boundary (environment map) has resolved, so
  // signalling ready here — after a frame paints — avoids the blank-flash on load.
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(onReady));
    return () => cancelAnimationFrame(id);
  }, [onReady]);

  // Release every GPU resource on unmount.
  useEffect(() => {
    return () => {
      if (builtRef.current) disposeBook(builtRef.current);
    };
  }, []);

  const group = useRef<THREE.Group>(null);
  const progs = useRef<number[]>(leaves.map(() => 0));
  const vels = useRef<number[]>(leaves.map(() => 0));
  const openness = useRef(0);
  const hovered = useRef(false);
  const hoverAmt = useRef(0);
  const lookAt = useRef(LOOK_CLOSED.clone());
  const camPos = useRef(CAM_CLOSED.clone());

  // Wake the on-demand render loop whenever the target page changes (and on mount,
  // again shortly after, to cover the async environment map resolving).
  useEffect(() => {
    invalidate();
    const id = window.setTimeout(invalidate, 250);
    return () => window.clearTimeout(id);
  }, [page, invalidate]);

  // Re-render on resize so the aspect-based reframing takes effect.
  useEffect(() => {
    const onResize = () => invalidate();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [invalidate]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    // Reduced motion: snap turns quickly and drop the ambient idle entirely.
    const turnLambda = reduced ? 16 : 5;
    const EPS = 1e-3;
    let busy = false;

    // Each leaf eases toward turned (1) or not (0); only the one being flipped moves.
    // A lightly under-damped spring gives the page a real flick-and-settle with a
    // touch of overshoot past flat. Reduced motion falls back to a quick snap.
    for (let i = 0; i < leaves.length; i++) {
      const target = i < page ? 1 : 0;
      let x = progs.current[i];
      if (reduced) {
        x = THREE.MathUtils.damp(x, target, turnLambda, dt);
        vels.current[i] = 0;
        if (Math.abs(x - target) > EPS) busy = true;
        else x = target;
      } else {
        const accel = (target - x) * 150 - vels.current[i] * 17;
        vels.current[i] += accel * dt;
        x = THREE.MathUtils.clamp(x + vels.current[i] * dt, -0.06, 1.06);
        if (Math.abs(x - target) > EPS || Math.abs(vels.current[i]) > EPS) busy = true;
        else {
          x = target;
          vels.current[i] = 0;
        }
      }
      progs.current[i] = x;
      leaves[i].uniforms.uProgress.value = x;
    }

    const oTarget = page > 0 ? 1 : 0;
    const ov = THREE.MathUtils.damp(openness.current, oTarget, turnLambda, dt);
    openness.current = Math.abs(ov - oTarget) < EPS ? oTarget : ((busy = true), ov);
    const eased = THREE.MathUtils.smoothstep(openness.current, 0, 1);

    // Hover affordance: while closed, the cover leans toward you, inviting a click.
    const hoverTarget = hovered.current && page === 0 && !reduced ? 1 : 0;
    hoverAmt.current = THREE.MathUtils.damp(hoverAmt.current, hoverTarget, 8, dt);
    if (Math.abs(hoverAmt.current - hoverTarget) > EPS) busy = true;

    // Idle: gentle bob + sway that fades out once the book is open (off if reduced).
    if (group.current) {
      const t = state.clock.elapsedTime;
      const idle = reduced ? 0 : 1 - eased;
      if (idle > EPS) busy = true; // keep the loop alive while the sway breathes
      group.current.position.y = Math.sin(t * 0.9) * 0.04 * idle;
      group.current.position.z = hoverAmt.current * 0.08;
      group.current.rotation.y =
        -0.32 + Math.sin(t * 0.5) * 0.05 * idle + hoverAmt.current * 0.14;
      group.current.rotation.x = -0.12;
    }

    // Pull the camera back on narrow / portrait viewports so the book always fits.
    const aspect = state.size.width / Math.max(1, state.size.height);
    const fit = 1 + Math.max(0, 1.3 - aspect) * 1.15;
    camPos.current.lerpVectors(CAM_CLOSED, CAM_OPEN, eased);
    camPos.current.z *= fit;
    lookAt.current.lerpVectors(LOOK_CLOSED, LOOK_OPEN, eased);
    camera.position.x = THREE.MathUtils.damp(camera.position.x, camPos.current.x, 5, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, camPos.current.y, 5, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, camPos.current.z, 5, dt);
    if (camera.position.distanceTo(camPos.current) > EPS) busy = true;
    camera.lookAt(lookAt.current);

    if (busy) invalidate();
  });

  const setCursor = (c: string) => {
    document.body.style.cursor = c;
  };

  // From the cover, any click opens. Once reading, the left half goes back and
  // the right half goes forward — like turning a real book.
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (page === 0) return onTurn(1);
    onTurn(e.nativeEvent.clientX < window.innerWidth / 2 ? -1 : 1);
  };

  return (
    <>
      {/* Invisible backdrop so a click anywhere (not just on a page) turns a leaf. */}
      <mesh
        position={[0, 0, -3]}
        onClick={handleClick}
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
          handleClick(e);
        }}
        onPointerOver={() => {
          setCursor("pointer");
          hovered.current = true;
          invalidate();
        }}
        onPointerOut={() => {
          setCursor("auto");
          hovered.current = false;
          invalidate();
        }}
      >
        {/* page block — the physical bulk of paper, giving the book real
            thickness and a cream fore-edge. The hardcover overhangs it slightly. */}
        <mesh position={[PAGE_W / 2, 0, -0.074]}>
          <boxGeometry args={[PAGE_W * 0.97, PAGE_H * 0.98, 0.172]} />
          <meshStandardMaterial color="#e7dfcf" roughness={0.95} />
        </mesh>

        {/* back cover (static, behind the block; revealed once every leaf turns) */}
        <mesh geometry={geometry} material={backMat} position={[0, 0, -0.165]} />

        {/* leaves — front + back share one bend uniforms set; stackZ lives in the
            shader so the flip inverts sheet order, like a real book. */}
        {leaves.map((lf, i) => (
          <group key={i}>
            <mesh geometry={geometry} material={lf.frontMat} />
            <mesh geometry={geometry} material={lf.backMat} />
          </group>
        ))}

        {/* spine — wraps the bound edge across the full thickness */}
        <mesh position={[0, 0, -0.056]}>
          <boxGeometry args={[0.06, PAGE_H, 0.24]} />
          <meshStandardMaterial color={COVER} roughness={0.8} />
        </mesh>
      </group>
    </>
  );
}
