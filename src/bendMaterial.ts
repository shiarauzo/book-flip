import * as THREE from "three";

export type BendUniforms = {
  uProgress: { value: number };
  uBend: { value: number };
  uWidth: { value: number };
  uStackZ: { value: number };
};

type Appearance = {
  color?: THREE.ColorRepresentation;
  roughness?: number;
  map?: THREE.Texture;
  side?: THREE.Side;
};

/** Create a fresh sheet with its own deformation uniforms. */
type OwnOptions = Appearance & {
  width: number;
  bend?: number;
  /** Stacking offset toward the camera, applied inside the shader before the flip
   * so the flip inverts the stack order — the opened cover ends up under the page. */
  stackZ?: number;
  uniforms?: undefined;
};

/** Reuse another sheet's uniforms so two meshes (front/back) bend as one. */
type SharedOptions = Appearance & {
  uniforms: BendUniforms;
  width?: never;
  bend?: never;
  stackZ?: never;
};

type Options = OwnOptions | SharedOptions;

/**
 * A MeshStandardMaterial whose vertices are bent in the vertex shader to fake a
 * turning page. Because we patch the standard material (instead of writing a raw
 * ShaderMaterial), the page keeps full PBR lighting, environment reflections and
 * works with the stylized lights/shadows in the scene.
 *
 * The whole deformation is driven by `uProgress` in [0,1]:
 *   0 -> page lies flat, extending +x from the spine (x = 0).
 *   1 -> page has flipped a full PI around the spine, landing on -x.
 * `uBend` controls how much the sheet bows out of plane mid-flip (the paper curl).
 */
export function createBendMaterial(
  opts: Options,
): { material: THREE.MeshStandardMaterial; uniforms: BendUniforms } {
  const { color = "#ffffff", roughness = 0.85, map, side = THREE.DoubleSide } = opts;

  const uniforms: BendUniforms = opts.uniforms ?? {
    uProgress: { value: 0 },
    uBend: { value: opts.bend ?? 0 },
    uWidth: { value: opts.width },
    uStackZ: { value: opts.stackZ ?? 0 },
  };

  const material = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0,
    side,
    ...(map ? { map } : {}),
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uProgress = uniforms.uProgress;
    shader.uniforms.uBend = uniforms.uBend;
    shader.uniforms.uWidth = uniforms.uWidth;
    shader.uniforms.uStackZ = uniforms.uStackZ;

    shader.vertexShader =
      "#define BEND_PI 3.141592653589793\n" +
      "uniform float uProgress;\nuniform float uBend;\nuniform float uWidth;\nuniform float uStackZ;\n" +
      shader.vertexShader;

    // Tilt the normal to match the bow + flip so lighting stays correct. The
    // stackZ offset is a pure translation, so it does not affect the normal.
    shader.vertexShader = shader.vertexShader.replace(
      "#include <beginnormal_vertex>",
      `#include <beginnormal_vertex>
      {
        float nu = position.x / uWidth;
        float nB = sin(uProgress * BEND_PI) * uBend;
        float ndz = cos(nu * BEND_PI) * BEND_PI / uWidth * nB;
        vec3 nN = normalize(vec3(-ndz, 0.0, 1.0));
        float nflip = uProgress * BEND_PI;
        float nc = cos(nflip);
        float ns = sin(nflip);
        objectNormal = vec3(nN.x * nc - nN.z * ns, nN.y, nN.x * ns + nN.z * nc);
      }`,
    );

    // Bow the sheet out of plane, then flip it around the spine (Y axis at x=0).
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      {
        float bu = transformed.x / uWidth;
        float bow = sin(bu * BEND_PI) * sin(uProgress * BEND_PI) * uBend;
        transformed.z += bow + uStackZ;
        float bflip = uProgress * BEND_PI;
        float bc = cos(bflip);
        float bs = sin(bflip);
        float bx = transformed.x * bc - transformed.z * bs;
        float bz = transformed.x * bs + transformed.z * bc;
        transformed.x = bx;
        transformed.z = bz;
      }`,
    );
  };

  return { material, uniforms };
}
