import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CamTarget } from "../CameraRig";
import { useReducedMotion } from "../useReducedMotion";
import { spineTexture } from "./spineTexture";

export type ShelfBook = {
  id: string;
  title: string;
  spineBg?: string;
  spineInk?: string;
};

const BOOK_H = 3.0;
const BOOK_D = 2.0; // page width (depth into shelf)
const BOOK_T = 0.55; // spine thickness
const GAP = 0.16;
const WOOD = "#6b4a32";
const WOOD_DARK = "#5a3d28";

const SHELF_POS = new THREE.Vector3(0, 0, 6.5);
const SHELF_LOOK = new THREE.Vector3(0, 0, 0);
const PRESENT_POS = new THREE.Vector3(0.2, 0.3, 6.0);
const PRESENT_LOOK = new THREE.Vector3(0.1, 0, 0);

function setCursor(c: string) {
  document.body.style.cursor = c;
}

function SpineBook({
  book,
  x,
  opening,
  selected,
  reduced,
  onOpen,
}: {
  book: ShelfBook;
  x: number;
  opening: boolean;
  selected: boolean;
  reduced: boolean;
  onOpen: () => void;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const mesh = useRef<THREE.Mesh>(null);
  const hovered = useRef(false);
  const pull = useRef(0);
  const lift = useRef(0);

  const materials = useMemo(() => {
    const side = new THREE.MeshStandardMaterial({ color: book.spineBg ?? "#1f4e46", roughness: 0.7 });
    const spine = new THREE.MeshStandardMaterial({
      map: spineTexture(book.title, { bg: book.spineBg, ink: book.spineInk }),
      roughness: 0.6,
    });
    return [side, side, side, side, spine, side];
  }, [book.title, book.spineBg, book.spineInk]);

  useEffect(
    () => () => {
      (materials[4].map as THREE.Texture | null)?.dispose();
      materials[0].dispose();
      materials[4].dispose();
    },
    [materials],
  );

  useFrame((_, delta) => {
    const m = mesh.current;
    if (!m) return;
    const dt = Math.min(delta, 1 / 30);
    let busy = false;

    const pullT = opening ? 1 : 0;
    const liftT = !opening && (hovered.current || selected) ? 1 : 0;
    if (reduced) {
      pull.current = pullT;
      lift.current = liftT;
    } else {
      pull.current = THREE.MathUtils.damp(pull.current, pullT, 7, dt);
      if (Math.abs(pull.current - pullT) > 1e-3) busy = true;
      lift.current = THREE.MathUtils.damp(lift.current, liftT, 10, dt);
      if (Math.abs(lift.current - liftT) > 1e-3) busy = true;
    }

    m.position.set(x, pull.current * 0.45 + lift.current * 0.14, pull.current * 1.8 + lift.current * 0.4);
    m.rotation.y = pull.current * -0.5;
    m.scale.setScalar(1 + pull.current * 0.04 + lift.current * 0.02);

    if (busy) invalidate();
  });

  return (
    <mesh
      ref={mesh}
      position={[x, 0, 0]}
      material={materials}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
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
      <boxGeometry args={[BOOK_T, BOOK_H, BOOK_D]} />
    </mesh>
  );
}

type Props = {
  books: ShelfBook[];
  camTarget: MutableRefObject<CamTarget>;
  openingId: string | null;
  selectedId: string | null;
  onOpen: (book: ShelfBook) => void;
  onReady: () => void;
};

export function Shelf({ books, camTarget, openingId, selectedId, onOpen, onReady }: Props) {
  const invalidate = useThree((s) => s.invalidate);
  const reduced = useReducedMotion();

  const span = books.length * BOOK_T + (books.length - 1) * GAP;

  useEffect(() => {
    camTarget.current.pos.copy(SHELF_POS);
    camTarget.current.look.copy(SHELF_LOOK);
    invalidate();
    const id = requestAnimationFrame(() => requestAnimationFrame(onReady));
    return () => cancelAnimationFrame(id);
  }, [camTarget, invalidate, onReady]);

  useFrame((state) => {
    const t = camTarget.current;
    if (openingId) {
      t.pos.copy(PRESENT_POS);
      t.look.copy(PRESENT_LOOK);
    } else {
      // Pull back if the row of spines is wider than the view (many books / narrow).
      const aspect = state.size.width / Math.max(1, state.size.height);
      const fitZ = (span / 2 + 0.6) / (Math.tan((35 * Math.PI) / 180 / 2) * aspect);
      t.pos.set(0, 0, Math.max(SHELF_POS.z, fitZ));
      t.look.copy(SHELF_LOOK);
    }
  });

  const x0 = -span / 2 + BOOK_T / 2;
  const boardW = Math.max(span + 1.1, 2.8);
  const bottom = -BOOK_H / 2;

  return (
    <group>
      {books.map((b, i) => (
        <SpineBook
          key={b.id}
          book={b}
          x={x0 + i * (BOOK_T + GAP)}
          opening={openingId === b.id}
          selected={selectedId === b.id}
          reduced={reduced}
          onOpen={() => onOpen(b)}
        />
      ))}

      {/* plank */}
      <mesh position={[0, bottom - 0.16, 0]}>
        <boxGeometry args={[boardW, 0.32, BOOK_D + 0.5]} />
        <meshStandardMaterial color={WOOD} roughness={0.85} />
      </mesh>
      {/* back panel */}
      <mesh position={[0, 0, -BOOK_D / 2 - 0.12]}>
        <boxGeometry args={[boardW, BOOK_H + 0.7, 0.16]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.9} />
      </mesh>
    </group>
  );
}
