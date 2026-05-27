import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { createBendMaterial } from "./bendMaterial";
import type { ChapterMark, PageSource } from "./sources/pageSource";
import { useReducedMotion } from "./useReducedMotion";

const PAGE_W = 2.2;
const PAGE_H = 3.0;
const COVER = "#1f4e46";
const PAPER = "#e7dfcf";
const SHEET_UNIT = 0.0019; // per-sheet thickness of each pile

// Camera framing: pulled back, centred near the spine, only a gentle shift.
const CAM_CLOSED = new THREE.Vector3(0.35, 0.5, 7.0);
const CAM_OPEN = new THREE.Vector3(0.05, 0.55, 6.85);
const LOOK_CLOSED = new THREE.Vector3(0.5, 0.0, 0.0);
const LOOK_OPEN = new THREE.Vector3(0.05, 0.0, 0.0);

type BookProps = {
  source: PageSource;
  page: number;
  onTotal: (total: number) => void;
  onTurn: (dir: 1 | -1) => void;
  onReady: () => void;
  onChapters: (chapters: ChapterMark[]) => void;
};

function blankTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 8;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#faf6ec";
  ctx.fillRect(0, 0, 8, 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function Book({ source, page, onTotal, onTurn, onReady, onChapters }: BookProps) {
  const { camera } = useThree();
  const invalidate = useThree((s) => s.invalidate);
  const reduced = useReducedMotion();

  // faceCount is odd by construction; the final spread (page = sheets) shows the
  // last page on the left and a recto on the right.
  const sheets = (source.faceCount - 1) / 2;

  useEffect(() => onTotal(sheets), [sheets, onTotal]);
  useEffect(() => onChapters(source.chapters), [source, onChapters]);

  // Geometry: right page (x:0..W), left page (x:-W..0), and a back-face geometry
  // with flipped U so the turning sheet's back reads correctly without mirroring
  // its (shared) texture.
  const built = useMemo(() => {
    const rightGeo = new THREE.PlaneGeometry(PAGE_W, PAGE_H, 48, 2);
    rightGeo.translate(PAGE_W / 2, 0, 0);
    const leftGeo = new THREE.PlaneGeometry(PAGE_W, PAGE_H, 4, 2);
    leftGeo.translate(-PAGE_W / 2, 0, 0);
    const backGeo = rightGeo.clone();
    const uv = backGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
    uv.needsUpdate = true;

    const blank = blankTexture();
    const flatLeft = new THREE.MeshStandardMaterial({ map: blank, roughness: 0.9 });
    const flatRight = new THREE.MeshStandardMaterial({ map: blank, roughness: 0.9 });
    const flipFront = createBendMaterial({ map: blank, bend: 0.34, width: PAGE_W, side: THREE.FrontSide });
    const flipBack = createBendMaterial({ map: blank, side: THREE.BackSide, uniforms: flipFront.uniforms });
    const blockMat = new THREE.MeshStandardMaterial({ color: PAPER, roughness: 0.95 });
    return { rightGeo, leftGeo, backGeo, blank, flatLeft, flatRight, flipFront, flipBack, blockMat };
  }, []);

  // Lazy texture cache keyed by face index, with a sliding window. renderFace may
  // be async (e.g. PDF pages): a `pending` set guards against duplicate renders,
  // and a stale-source guard discards textures that resolve after a source swap.
  const cache = useRef(new Map<number, THREE.CanvasTexture>());
  const pending = useRef(new Set<number>());
  const sourceRef = useRef(source);
  sourceRef.current = source;

  const face = (i: number): THREE.CanvasTexture => cache.current.get(i) ?? built.blank;
  const ensureWindow = (center: number) => {
    const lo = center - 3;
    const hi = center + 4;
    for (let i = lo; i <= hi; i++) {
      if (i < 0 || i >= source.faceCount || cache.current.has(i) || pending.current.has(i)) continue;
      let tex: THREE.CanvasTexture | Promise<THREE.CanvasTexture>;
      try {
        tex = source.renderFace(i);
      } catch {
        continue; // a bad page falls back to the blank texture
      }
      if (tex instanceof Promise) {
        const owner = source;
        pending.current.add(i);
        tex
          .then((t) => {
            pending.current.delete(i);
            if (sourceRef.current === owner) {
              cache.current.set(i, t);
              invalidate();
            } else {
              t.dispose();
            }
          })
          .catch(() => pending.current.delete(i));
      } else {
        cache.current.set(i, tex);
      }
    }
    for (const [k, tex] of cache.current) {
      if (k < center - 6 || k > center + 7) {
        tex.dispose();
        cache.current.delete(k);
      }
    }
  };

  // Refs to the live meshes/blocks.
  const group = useRef<THREE.Group>(null);
  const leftRef = useRef<THREE.Mesh>(null);
  const rightRef = useRef<THREE.Mesh>(null);
  const flipFrontRef = useRef<THREE.Mesh>(null);
  const flipBackRef = useRef<THREE.Mesh>(null);
  const leftBlock = useRef<THREE.Mesh>(null);
  const rightBlock = useRef<THREE.Mesh>(null);

  const displayed = useRef(0);
  const hovered = useRef(false);
  const hoverAmt = useRef(0);
  const lookAt = useRef(LOOK_CLOSED.clone());
  const camPos = useRef(CAM_CLOSED.clone());

  // On source swap, drop the old book's textures and start fresh from the cover.
  useEffect(() => {
    for (const tex of cache.current.values()) tex.dispose();
    cache.current.clear();
    pending.current.clear();
    displayed.current = 0;
    ensureWindow(0);
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  // Prepare textures around the target page; snap (no riffle) on big jumps.
  useEffect(() => {
    ensureWindow(2 * page);
    if (Math.abs(page - displayed.current) > 1.5) displayed.current = page;
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, invalidate]);

  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(onReady);
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [onReady]);

  useEffect(() => {
    const onResize = () => invalidate();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [invalidate]);

  // Dispose every GPU resource on unmount.
  useEffect(() => {
    const b = built;
    const c = cache.current;
    return () => {
      b.rightGeo.dispose();
      b.leftGeo.dispose();
      b.backGeo.dispose();
      b.blank.dispose();
      b.flatLeft.dispose();
      b.flatRight.dispose();
      b.flipFront.material.dispose();
      b.flipBack.material.dispose();
      b.blockMat.dispose();
      for (const t of c.values()) t.dispose();
      c.clear();
    };
  }, [built]);

  const showMap = (mesh: THREE.Mesh | null, mat: THREE.MeshStandardMaterial, idx: number) => {
    if (!mesh) return;
    if (idx < 0 || idx >= source.faceCount) {
      mesh.visible = false;
      return;
    }
    mat.map = face(idx);
    mesh.visible = true;
  };

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const EPS = 1e-3;
    let busy = false;

    // Critically-damped approach to the target page (no overshoot → no twitch).
    const lambda = reduced ? 18 : 9;
    const d0 = displayed.current;
    let d = THREE.MathUtils.damp(d0, page, lambda, dt);
    if (Math.abs(d - page) < EPS) d = page;
    else busy = true;
    displayed.current = d;

    const f = Math.floor(d + 1e-4);
    const frac = THREE.MathUtils.clamp(d - f, 0, 1);
    const flipping = frac > EPS && frac < 1 - EPS;

    showMap(leftRef.current, built.flatLeft, 2 * f - 1);
    showMap(rightRef.current, built.flatRight, flipping ? 2 * f + 2 : 2 * f);

    if (flipping) {
      built.flipFront.material.map = face(2 * f);
      built.flipBack.material.map = face(2 * f + 1);
      built.flipFront.uniforms.uProgress.value = frac;
      if (flipFrontRef.current) flipFrontRef.current.visible = true;
      if (flipBackRef.current) flipBackRef.current.visible = true;
    } else {
      if (flipFrontRef.current) flipFrontRef.current.visible = false;
      if (flipBackRef.current) flipBackRef.current.visible = false;
    }

    // Piles thicken/thin as pages move between them.
    const leftThk = Math.max(d, 0) * SHEET_UNIT;
    const rightThk = Math.max(sheets - d, 0) * SHEET_UNIT;
    if (leftBlock.current) {
      leftBlock.current.visible = leftThk > 0.003;
      leftBlock.current.scale.z = Math.max(leftThk, 0.001);
      leftBlock.current.position.z = -leftThk / 2 - 0.004;
    }
    if (rightBlock.current) {
      rightBlock.current.visible = rightThk > 0.003;
      rightBlock.current.scale.z = Math.max(rightThk, 0.001);
      rightBlock.current.position.z = -rightThk / 2 - 0.004;
    }

    const eased = THREE.MathUtils.smoothstep(Math.min(d, 1), 0, 1);

    // Hover affordance while closed.
    const hoverTarget = hovered.current && d < 0.02 && !reduced ? 1 : 0;
    hoverAmt.current = THREE.MathUtils.damp(hoverAmt.current, hoverTarget, 8, dt);
    if (Math.abs(hoverAmt.current - hoverTarget) > EPS) busy = true;

    if (group.current) {
      const t = state.clock.elapsedTime;
      const idle = reduced ? 0 : 1 - eased;
      if (idle > EPS) busy = true;
      // The closed cover sits at a 3D angle; the open book eases to nearly
      // face-on and centred so both pages read flat and symmetric.
      const baseY = THREE.MathUtils.lerp(-0.32, -0.015, eased);
      const baseX = THREE.MathUtils.lerp(-0.12, -0.05, eased);
      group.current.position.y = Math.sin(t * 0.9) * 0.04 * idle;
      group.current.position.z = hoverAmt.current * 0.08;
      group.current.rotation.y = baseY + Math.sin(t * 0.5) * 0.05 * idle + hoverAmt.current * 0.14;
      group.current.rotation.x = baseX;
    }

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
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (page === 0) return onTurn(1);
    onTurn(e.nativeEvent.clientX < window.innerWidth / 2 ? -1 : 1);
  };

  const spineThk = sheets * SHEET_UNIT;

  return (
    <>
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
        {/* page piles (grow/shrink as you read) */}
        <mesh ref={rightBlock} position={[PAGE_W / 2, 0, 0]} material={built.blockMat}>
          <boxGeometry args={[PAGE_W + 0.02, PAGE_H + 0.02, 1]} />
        </mesh>
        <mesh ref={leftBlock} position={[-PAGE_W / 2, 0, 0]} material={built.blockMat} visible={false}>
          <boxGeometry args={[PAGE_W + 0.02, PAGE_H + 0.02, 1]} />
        </mesh>

        {/* current spread (flat) */}
        <mesh ref={leftRef} geometry={built.leftGeo} material={built.flatLeft} position={[0, 0, 0.006]} visible={false} />
        <mesh ref={rightRef} geometry={built.rightGeo} material={built.flatRight} position={[0, 0, 0.006]} />

        {/* the single turning sheet (kept in front via position.z; bend in shader) */}
        <mesh ref={flipFrontRef} geometry={built.rightGeo} material={built.flipFront.material} position={[0, 0, 0.02]} visible={false} />
        <mesh ref={flipBackRef} geometry={built.backGeo} material={built.flipBack.material} position={[0, 0, 0.02]} visible={false} />

        {/* spine */}
        <mesh position={[0, 0, -spineThk / 2]}>
          <boxGeometry args={[0.06, PAGE_H, spineThk + 0.05]} />
          <meshStandardMaterial color={COVER} roughness={0.8} />
        </mesh>
      </group>
    </>
  );
}
