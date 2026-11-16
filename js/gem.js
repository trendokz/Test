// Реалистичный материал бриллианта: трассировка лучей внутри камня по его
// настоящей геометрии (BVH), полное внутреннее отражение, дисперсия
// («игра» радуги), поглощение света в цветных камнях и отражение Френеля.
import * as THREE from 'three';
import { MeshBVH, MeshBVHUniformStruct, BVHShaderGLSL } from 'three-mesh-bvh';

const vertexShader = /* glsl */`
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying mat4 vInst;
  #include <common>
  void main() {
    vInst = mat4(1.0);
    vec4 local = vec4(position, 1.0);
    vec3 n = normal;
    #ifdef USE_INSTANCING
      local = instanceMatrix * local;
      n = mat3(instanceMatrix) * n;
      vInst = instanceMatrix;
    #endif
    vec4 wp = modelMatrix * local;
    vWorldPosition = wp.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * n);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const fragmentShader = /* glsl */`
  #define RAY_OFFSET 0.002
  precision highp isampler2D;
  precision highp usampler2D;
  #include <common>
  ${BVHShaderGLSL.common_functions}
  ${BVHShaderGLSL.bvh_struct_definitions}
  ${BVHShaderGLSL.bvh_ray_functions}

  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying mat4 vInst;

  uniform samplerCube envMap;
  uniform BVH bvh;
  uniform mat4 modelMatrix;
  uniform float bounces;
  uniform float ior;
  uniform float dispersion;
  uniform vec3 absorption;   // коэффициенты поглощения на 1 мм
  uniform vec3 tint;         // общий тон (для чёрных/непрозрачных камней)
  uniform float envIntensity;
  uniform float reflectivity;

  vec3 envSample(vec3 dir) {
    return textureCube(envMap, dir).rgb;
  }

  // Ход луча внутри камня. Возвращает направление выхода (в мире)
  // и длину пути внутри (в мм) — для поглощения.
  vec3 traceInside(vec3 viewDir, vec3 n, float eta, mat4 M, mat4 Minv, out float pathLen) {
    vec3 dir = refract(viewDir, n, 1.0 / eta);
    vec3 org = (Minv * vec4(vWorldPosition + dir * RAY_OFFSET, 1.0)).xyz;
    dir = normalize((Minv * vec4(dir, 0.0)).xyz);
    pathLen = 0.0;
    for (float i = 0.0; i < 8.0; i++) {
      if (i >= bounces) break;
      uvec4 faceIndices = uvec4(0u);
      vec3 faceNormal = vec3(0.0, 0.0, 1.0);
      vec3 bary = vec3(0.0);
      float side = 1.0;
      float dist = 0.0;
      bool hit = bvhIntersectFirstHit(bvh, org, dir, faceIndices, faceNormal, bary, side, dist);
      if (!hit) break;
      pathLen += dist;
      vec3 hitPos = org + dir * dist;
      faceNormal = normalize(faceNormal);
      if (dot(faceNormal, dir) > 0.0) faceNormal = -faceNormal; // нормаль против луча
      vec3 outDir = refract(dir, faceNormal, eta);
      if (dot(outDir, outDir) > 0.0 && i < bounces - 1.0) {
        // частичное выходное отражение Френеля: выбираем более яркий путь
        dir = outDir;
        break;
      }
      dir = reflect(dir, faceNormal);
      org = hitPos + dir * RAY_OFFSET;
    }
    return normalize((M * vec4(dir, 0.0)).xyz);
  }

  void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 viewDir = normalize(vWorldPosition - cameraPosition);
    if (dot(n, viewDir) > 0.0) n = -n;

    mat4 M = modelMatrix * vInst;
    mat4 Minv = inverse(M);
    float lr, lg, lb;
    vec3 dr = traceInside(viewDir, n, ior * (1.0 - dispersion), M, Minv, lr);
    vec3 dg = traceInside(viewDir, n, ior, M, Minv, lg);
    vec3 db = traceInside(viewDir, n, ior * (1.0 + dispersion), M, Minv, lb);

    vec3 refr = vec3(envSample(dr).r, envSample(dg).g, envSample(db).b);
    refr *= exp(-absorption * vec3(lr, lg, lb));
    refr *= tint;

    // отражение от внешней поверхности (Френель, Шлик)
    float f0 = pow((ior - 1.0) / (ior + 1.0), 2.0);
    float cosT = clamp(dot(-viewDir, n), 0.0, 1.0);
    float fresnel = f0 + (1.0 - f0) * pow(1.0 - cosT, 5.0);
    vec3 refl = envSample(reflect(viewDir, n));

    vec3 col = mix(refr, refl, clamp(fresnel * reflectivity, 0.0, 1.0)) * envIntensity;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const bvhCache = new WeakMap();

/** Материал для конкретной геометрии камня (BVH привязан к геометрии). */
export function createGemMaterial(geometry, envCube, opts) {
  let entry = bvhCache.get(geometry);
  if (!entry) {
    const bvh = new MeshBVH(geometry, { maxLeafTris: 1, strategy: 0 });
    const uniform = new MeshBVHUniformStruct();
    uniform.updateFrom(bvh);
    entry = { bvh, uniform };
    bvhCache.set(geometry, entry);
    geometry.addEventListener('dispose', () => uniform.dispose());
  }
  const mat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      envMap: { value: envCube },
      bvh: { value: entry.uniform },
      bounces: { value: opts.bounces ?? 5 },
      ior: { value: opts.ior ?? 2.42 },
      dispersion: { value: opts.dispersion ?? 0.018 },
      absorption: { value: opts.absorption ?? new THREE.Vector3() },
      tint: { value: opts.tint ?? new THREE.Color(1, 1, 1) },
      envIntensity: { value: opts.envIntensity ?? 1 },
      reflectivity: { value: opts.reflectivity ?? 1 },
    },
  });
  mat.userData.ownsUniforms = true;
  return mat;
}

/** Меш камня с реалистичным материалом. */
export function createGemMesh(geometry, material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.disposeMaterial = true;
  return mesh;
}

/** Поглощение (на мм) для цвета камня: чем насыщеннее цвет, тем сильнее. */
export function absorptionFor(hex, strength = 0.22) {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(
    -Math.log(Math.max(c.r, 0.02)) * strength,
    -Math.log(Math.max(c.g, 0.02)) * strength,
    -Math.log(Math.max(c.b, 0.02)) * strength,
  );
}
