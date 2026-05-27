import type { MutableRefObject } from "react";
import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export type CamTarget = { pos: THREE.Vector3; look: THREE.Vector3 };

/**
 * The single owner of the camera. Book/Shelf never touch `camera` directly — they
 * write their desired pose into the shared `target` ref, and the rig damps the
 * real camera toward it. This avoids two components fighting over the camera and
 * makes the shelf↔reading transition a simple lerp between targets.
 */
export function CameraRig({ target }: { target: MutableRefObject<CamTarget> }) {
  const { camera } = useThree();
  const invalidate = useThree((s) => s.invalidate);
  const look = useRef(target.current.look.clone());

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const t = target.current;
    const L = 5;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, t.pos.x, L, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, t.pos.y, L, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, t.pos.z, L, dt);
    look.current.x = THREE.MathUtils.damp(look.current.x, t.look.x, L, dt);
    look.current.y = THREE.MathUtils.damp(look.current.y, t.look.y, L, dt);
    look.current.z = THREE.MathUtils.damp(look.current.z, t.look.z, L, dt);
    camera.lookAt(look.current);

    if (camera.position.distanceTo(t.pos) > 1e-3 || look.current.distanceTo(t.look) > 1e-3) {
      invalidate();
    }
  });

  return null;
}
