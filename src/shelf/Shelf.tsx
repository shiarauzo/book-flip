import { type MutableRefObject, useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CamTarget } from "../CameraRig";
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

const SHELF_POS = new THREE.Vector3(0, 0, 6.5);
const SHELF_LOOK = new THREE.Vector3(0, 0, 0);

function setCursor(c: string) {
  document.body.style.cursor = c;
}

function SpineBook({ book, x, onOpen }: { book: ShelfBook; x: number; onOpen: () => void }) {
  // Six box materials; the +z face (index 4) carries the spine art.
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

  return (
    <mesh
      position={[x, 0, 0]}
      material={materials}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      onPointerOver={() => setCursor("pointer")}
      onPointerOut={() => setCursor("auto")}
    >
      <boxGeometry args={[BOOK_T, BOOK_H, BOOK_D]} />
    </mesh>
  );
}

type Props = {
  books: ShelfBook[];
  camTarget: MutableRefObject<CamTarget>;
  onOpen: (book: ShelfBook) => void;
  onReady: () => void;
};

export function Shelf({ books, camTarget, onOpen, onReady }: Props) {
  const invalidate = useThree((s) => s.invalidate);

  // Frame the camera on the shelf and reveal once painted.
  useEffect(() => {
    camTarget.current.pos.copy(SHELF_POS);
    camTarget.current.look.copy(SHELF_LOOK);
    invalidate();
    const id = requestAnimationFrame(() => requestAnimationFrame(onReady));
    return () => cancelAnimationFrame(id);
  }, [camTarget, invalidate, onReady]);

  const span = books.length * BOOK_T + (books.length - 1) * GAP;
  const x0 = -span / 2 + BOOK_T / 2;
  const boardW = Math.max(span + 1.0, 2.6);
  const bottom = -BOOK_H / 2;

  return (
    <group>
      {books.map((b, i) => (
        <SpineBook key={b.id} book={b} x={x0 + i * (BOOK_T + GAP)} onOpen={() => onOpen(b)} />
      ))}

      {/* shelf plank */}
      <mesh position={[0, bottom - 0.16, 0]}>
        <boxGeometry args={[boardW, 0.32, BOOK_D + 0.5]} />
        <meshStandardMaterial color={WOOD} roughness={0.85} />
      </mesh>
      {/* back panel */}
      <mesh position={[0, 0, -BOOK_D / 2 - 0.12]}>
        <boxGeometry args={[boardW, BOOK_H + 0.7, 0.16]} />
        <meshStandardMaterial color={WOOD} roughness={0.9} />
      </mesh>
    </group>
  );
}
