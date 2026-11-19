"use client";

import { MeshReflectorMaterial, PerformanceMonitor, Sparkles, Stars } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import type { MotionValue } from "framer-motion";
import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { deriveWorld } from "@/lib/templates";
import type { WorldParams } from "@/lib/types";

export type StageState = "LOCKED" | "ACTIVE" | "COMPLETED";

export interface CitySceneProps {
  accent: string;
  accent2: string;
  seed: number;
  stages: StageState[];
  /** in-world hologram text above each stage obelisk */
  labels?: string[];
  /** the city's physical shape; derived from the seed when omitted */
  world?: WorldParams;
  members?: number;
  /** increment to fire a shockwave ring (stage unlock) */
  pulse?: number;
  variant?: "hero" | "room";
  /** 0..1 scroll progress; drives a cinematic camera path in "hero" variant */
  scroll?: MotionValue<number>;
}

function rng(seed: number) {
  let a = seed * 2654435761;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PLAZA = 8.5;
const FOG = "#0b0810";
const smooth = (x: number) => x * x * (3 - 2 * x);

/* ------------------------------ live palette ------------------------------ */
/* One damped palette shared by every object so a theme change morphs smoothly. */

interface Pal {
  a: THREE.Color;
  b: THREE.Color;
  v: number;
}
const PalCtx = createContext<React.MutableRefObject<Pal> | null>(null);
const usePal = () => useContext(PalCtx)!;

function PaletteDriver({ accent, accent2, children }: { accent: string; accent2: string; children: React.ReactNode }) {
  const target = useMemo(() => ({ a: new THREE.Color(accent), b: new THREE.Color(accent2) }), [accent, accent2]);
  const cur = useRef<Pal>({ a: new THREE.Color(accent), b: new THREE.Color(accent2), v: 0 });
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 2.4);
    const p = cur.current;
    p.a.lerp(target.a, k);
    p.b.lerp(target.b, k);
    p.v = p.a.r * 3 + p.a.g * 5 + p.a.b * 7 + p.b.r * 11 + p.b.g * 13 + p.b.b * 17;
  });
  return <PalCtx.Provider value={cur}>{children}</PalCtx.Provider>;
}

/** Re-tint an instanced mesh from the live palette whenever it changes. */
function usePaletteInstances(ref: React.RefObject<THREE.InstancedMesh | null>, picks: number[], boost: number) {
  const pal = usePal();
  const last = useRef(-1);
  const tmp = useMemo(() => new THREE.Color(), []);
  useFrame(() => {
    const m = ref.current;
    if (!m || Math.abs(pal.current.v - last.current) < 1e-4) return;
    last.current = pal.current.v;
    for (let i = 0; i < picks.length; i++) m.setColorAt(i, tmp.copy(picks[i] ? pal.current.a : pal.current.b).multiplyScalar(boost));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
}

/* ------------------------------ buildings ------------------------------ */

const VERT = /* glsl */ `
  varying vec3 vW;
  varying vec3 vN;
  varying float vSeed;
  void main() {
    mat4 m = modelMatrix * instanceMatrix;
    vec4 w = m * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(m) * normal);
    vSeed = fract(sin(dot(m[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const FRAG = /* glsl */ `
  uniform vec3 uBase; uniform vec3 uWarm; uniform vec3 uCool; uniform vec3 uFog;
  uniform float uTime; uniform float uFogD;
  varying vec3 vW; varying vec3 vN; varying float vSeed;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec3 n = normalize(vN);
    float vertical = 1.0 - step(0.5, abs(n.y));
    bool alongX = abs(n.x) > 0.5;
    float u = alongX ? vW.z : vW.x;
    vec2 cell = vec2(floor(u / 0.85), floor(vW.y / 0.72));
    vec2 f = vec2(fract(u / 0.85), fract(vW.y / 0.72));
    float win = step(0.2, f.x) * step(f.x, 0.8) * step(0.22, f.y) * step(f.y, 0.78);
    float r = hash(cell + vSeed * 91.0 + (alongX ? 7.0 : 0.0));
    float lit = step(0.62, r);
    float flick = 0.8 + 0.2 * sin(uTime * (0.4 + r * 1.6) + r * 60.0);
    vec3 tint = mix(uWarm, uCool, step(0.78, fract(r * 9.1)));
    vec3 emissive = tint * win * lit * vertical * flick * 1.5;
    float light = dot(n, normalize(vec3(0.35, 0.8, 0.45))) * 0.5 + 0.5;
    vec3 base = uBase * (0.3 + 0.9 * light);
    float roof = smoothstep(0.35, 0.5, abs(n.y)) * 0.15;
    vec3 c = base + emissive + uCool * roof * 0.4;
    // street-level glow bleeding up the facade
    c += uCool * exp(-vW.y * 0.9) * 0.18 * vertical;
    float d = distance(vW, cameraPosition);
    float fog = 1.0 - exp(-d * d * uFogD * uFogD);
    gl_FragColor = vec4(mix(c, uFog, fog), 1.0);
    #include <colorspace_fragment>
  }
`;

function Skyline({ seed, world }: { seed: number; world: WorldParams }) {
  const pal = usePal();
  const bodies = useRef<THREE.InstancedMesh>(null);
  const signs = useRef<THREE.InstancedMesh>(null);

  const { towers, lights } = useMemo(() => {
    const r = rng(seed);
    const towers: { x: number; z: number; w: number; d: number; h: number }[] = [];
    const lights: { x: number; y: number; z: number; sx: number; sy: number; sz: number; c: number }[] = [];
    for (let gx = -30; gx <= 30; gx += 2.5) {
      for (let gz = -30; gz <= 30; gz += 2.5) {
        const x = gx + (r() - 0.5) * 0.3;
        const z = gz + (r() - 0.5) * 0.3;
        const dist = Math.hypot(x, z);
        if (dist < PLAZA || dist > 29) continue;
        if (r() > world.density) continue;
        const core = Math.max(0, 1 - dist / 26);
        const landmark = r() < world.landmarks;
        const h = (landmark ? 16 + r() * 11 : 2.2 + Math.pow(r(), 2.2) * 13 * (0.55 + core * 0.9)) * world.height;
        const w = 1.0 + r() * 0.7;
        const d = 1.0 + r() * 0.7;
        towers.push({ x, z, w, d, h });
        if (h > 6 && r() > 0.4) {
          const face = r() > 0.5;
          lights.push({
            x: x + (face ? (r() > 0.5 ? 1 : -1) * (w / 2 + 0.03) : 0),
            y: h * (0.35 + r() * 0.5),
            z: z + (!face ? (r() > 0.5 ? 1 : -1) * (d / 2 + 0.03) : 0),
            sx: 0.07,
            sy: 1 + r() * 2.6,
            sz: !face ? 0.07 : d * 0.3,
            c: r() > 0.5 ? 0 : 1,
          });
        }
      }
    }
    return { towers, lights };
  }, [seed, world.density, world.height, world.landmarks]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uBase: { value: new THREE.Color("#1a1824") },
          uWarm: { value: new THREE.Color("#ffb864") },
          uCool: { value: new THREE.Color("#ffc46b") },
          uFog: { value: new THREE.Color(FOG) },
          uTime: { value: 0 },
          uFogD: { value: 0.0145 },
        },
      }),
    [],
  );
  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uCool.value.copy(pal.current.b);
    material.uniforms.uFogD.value = world.fog;
  });
  usePaletteInstances(signs, useMemo(() => lights.map((l) => l.c), [lights]), 2.4);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    towers.forEach((t, i) => {
      m.compose(new THREE.Vector3(t.x, t.h / 2, t.z), q, new THREE.Vector3(t.w, t.h, t.d));
      bodies.current?.setMatrixAt(i, m);
    });
    if (bodies.current) bodies.current.instanceMatrix.needsUpdate = true;
    lights.forEach((l, i) => {
      m.compose(new THREE.Vector3(l.x, l.y, l.z), q, new THREE.Vector3(l.sx, l.sy, l.sz));
      signs.current?.setMatrixAt(i, m);
    });
    if (signs.current) signs.current.instanceMatrix.needsUpdate = true;
  }, [towers, lights]);

  return (
    <group>
      <instancedMesh ref={bodies} args={[undefined, undefined, towers.length]} frustumCulled={false}>
        <boxGeometry />
        <primitive object={material} attach="material" />
      </instancedMesh>
      <instancedMesh ref={signs} args={[undefined, undefined, lights.length]} frustumCulled={false}>
        <boxGeometry />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/* ------------------------------ life: traffic + rain ------------------------------ */

function Traffic({ count, lift, speed, seed, size }: { count: number; lift: [number, number]; speed: [number, number]; seed: number; size: [number, number, number] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const cars = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: count }, () => ({
      axis: r() > 0.5 ? 0 : 1,
      lane: (Math.floor(r() * 23) - 11) * 2.5 + 1.25,
      dir: r() > 0.5 ? 1 : -1,
      speed: speed[0] + r() * (speed[1] - speed[0]),
      off: r() * 64,
      y: lift[0] + r() * (lift[1] - lift[0]),
      red: r() > 0.5,
      len: 0.7 + r() * 0.7,
    }));
  }, [count, lift, speed, seed]);

  useLayoutEffect(() => {
    const warm = new THREE.Color("#ffe6b8").multiplyScalar(2.4);
    const red = new THREE.Color("#ff3030").multiplyScalar(2.2);
    cars.forEach((c, i) => ref.current?.setColorAt(i, c.red ? red : warm));
    if (ref.current?.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [cars]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const m = ref.current;
    if (!m) return;
    cars.forEach((c, i) => {
      const span = 64;
      const pos = ((((c.off + t * c.speed * c.dir) % span) + span) % span) - span / 2;
      dummy.position.set(c.axis === 0 ? pos : c.lane, c.y, c.axis === 0 ? c.lane : pos);
      dummy.rotation.y = c.axis === 0 ? 0 : Math.PI / 2;
      dummy.scale.set(size[0] * c.len, size[1], size[2]);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry />
      <meshBasicMaterial toneMapped={false} fog={false} />
    </instancedMesh>
  );
}

function Rain({ count }: { count: number }) {
  const ref = useRef<THREE.LineSegments>(null);
  const N = count;
  const pos = useMemo(() => {
    const a = new Float32Array(N * 6);
    const r = rng(5);
    for (let i = 0; i < N; i++) {
      const x = (r() - 0.5) * 70;
      const y = r() * 26;
      const z = (r() - 0.5) * 70;
      a.set([x, y, z, x, y + 0.7, z], i * 6);
    }
    return a;
  }, [N]);
  useFrame((_, dt) => {
    const g = ref.current?.geometry.attributes.position as THREE.BufferAttribute | undefined;
    if (!g) return;
    for (let i = 0; i < N; i++) {
      let y = g.getY(i * 2) - dt * 22;
      if (y < 0) y += 26;
      g.setY(i * 2, y);
      g.setY(i * 2 + 1, y + 0.7);
    }
    g.needsUpdate = true;
  });
  return (
    <lineSegments ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#9fb4ff" transparent opacity={0.2} depthWrite={false} />
    </lineSegments>
  );
}

/* ------------------------------ sky ------------------------------ */

function Sky() {
  const pal = usePal();
  const moon = useRef<THREE.MeshBasicMaterial>(null);
  const halo = useRef<THREE.MeshBasicMaterial>(null);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { uTop: { value: new THREE.Color("#06050a") }, uHor: { value: new THREE.Color("#1a0f24") }, uGlow: { value: new THREE.Color("#ff5a1f") } },
        vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `
          uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uGlow; varying vec3 vP;
          void main() {
            float h = clamp(vP.y, 0.0, 1.0);
            vec3 c = mix(uHor, uTop, pow(h, 0.22));
            c += uGlow * 0.22 * exp(-h * 14.0);
            gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  const tmp = useMemo(() => new THREE.Color(), []);
  useFrame(() => {
    mat.uniforms.uGlow.value.copy(pal.current.a);
    mat.uniforms.uHor.value.copy(pal.current.a).multiplyScalar(0.06).add(tmp.set("#0d0814"));
    moon.current?.color.copy(pal.current.b).lerp(tmp.set("#ffffff"), 0.7);
    halo.current?.color.copy(pal.current.b);
  });
  return (
    <>
      <mesh scale={[200, 200, 200]} renderOrder={-10}>
        <sphereGeometry args={[1, 32, 16]} />
        <primitive object={mat} attach="material" />
      </mesh>
      <mesh position={[-34, 30, -70]}>
        <sphereGeometry args={[4.2, 32, 32]} />
        <meshBasicMaterial ref={moon} toneMapped={false} fog={false} />
      </mesh>
      <mesh position={[-34, 30, -71]}>
        <sphereGeometry args={[9, 32, 32]} />
        <meshBasicMaterial ref={halo} transparent opacity={0.07} depthWrite={false} toneMapped={false} fog={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <Stars radius={120} depth={40} count={1400} factor={3} fade speed={0.4} />
    </>
  );
}

function PaletteLights() {
  const pal = usePal();
  const a = useRef<THREE.PointLight>(null);
  const b = useRef<THREE.PointLight>(null);
  useFrame(() => {
    a.current?.color.copy(pal.current.a);
    b.current?.color.copy(pal.current.b);
  });
  return (
    <>
      <pointLight ref={a} position={[0, 9, 0]} intensity={70} distance={34} />
      <pointLight ref={b} position={[12, 5, -10]} intensity={36} distance={34} />
    </>
  );
}

function Searchlight({ which, phase, x, z }: { which: "a" | "b"; phase: number; x: number; z: number }) {
  const pal = usePal();
  const ref = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.35 + phase;
    if (ref.current) {
      ref.current.rotation.z = Math.sin(t) * 0.5;
      ref.current.rotation.x = Math.cos(t * 0.8) * 0.5;
    }
    mat.current?.color.copy(which === "a" ? pal.current.a : pal.current.b);
  });
  return (
    <group position={[x, 0, z]} ref={ref}>
      <mesh position={[0, 20, 0]}>
        <cylinderGeometry args={[0.1, 2.4, 40, 20, 1, true]} />
        <meshBasicMaterial ref={mat} transparent opacity={0.07} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} fog={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ------------------------------ plaza ------------------------------ */

function labelTexture(text: string) {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 160;
  const g = c.getContext("2d")!;
  const t = text.toUpperCase().slice(0, 26);
  let size = 64;
  g.font = `800 ${size}px Impact, "Arial Narrow", sans-serif`;
  while (g.measureText(t).width > 560 && size > 24) {
    size -= 4;
    g.font = `800 ${size}px Impact, "Arial Narrow", sans-serif`;
  }
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.shadowColor = "#fff";
  g.shadowBlur = 18;
  g.fillStyle = "#fff";
  g.fillText(t, 320, 84);
  g.shadowBlur = 0;
  g.fillRect(40, 138, 560, 3);
  g.fillRect(40, 18, 80, 3);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Obelisk({ index, total, state, label }: { index: number; total: number; state: StageState; label?: string }) {
  const pal = usePal();
  const { camera } = useThree();
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const beam = useRef<THREE.Mesh>(null);
  const beamMat = useRef<THREE.MeshBasicMaterial>(null);
  const gem = useRef<THREE.MeshBasicMaterial>(null);
  const ring = useRef<THREE.MeshBasicMaterial>(null);
  const grp = useRef<THREE.Group>(null);
  const holo = useRef<THREE.Mesh>(null);
  const holoMat = useRef<THREE.MeshBasicMaterial>(null);
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  const radius = 4.4;
  const h = 4.2 + index * 1.1;
  const dead = useMemo(() => new THREE.Color("#241f2e"), []);
  const tex = useMemo(() => (label ? labelTexture(label) : null), [label]);
  const tmp = useMemo(() => new THREE.Color(), []);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const col = state === "COMPLETED" ? pal.current.a : state === "ACTIVE" ? pal.current.b : dead;
    const target = state === "COMPLETED" ? 2.6 : state === "ACTIVE" ? 1.2 + Math.sin(t * 2.6) * 0.6 : 0.05;
    if (mat.current) {
      mat.current.emissiveIntensity = THREE.MathUtils.damp(mat.current.emissiveIntensity, target, 4, dt);
      mat.current.emissive.lerp(col, Math.min(1, dt * 5));
    }
    if (beam.current && beamMat.current) {
      beamMat.current.color.copy(pal.current.a);
      beamMat.current.opacity = THREE.MathUtils.damp(beamMat.current.opacity, state === "COMPLETED" ? 0.3 : state === "ACTIVE" ? 0.1 : 0, 3, dt);
      beam.current.visible = beamMat.current.opacity > 0.004;
    }
    gem.current?.color.copy(state === "LOCKED" ? tmp.set("#3a3347") : pal.current.b);
    ring.current?.color.copy(state === "LOCKED" ? tmp.set("#2c2538") : pal.current.b);
    if (grp.current) grp.current.position.y = state === "LOCKED" ? 0 : Math.sin(t * 1.1 + index) * 0.1;
    if (holo.current && holoMat.current) {
      holo.current.quaternion.copy(camera.quaternion);
      holoMat.current.color.copy(state === "LOCKED" ? tmp.set("#5d5470") : state === "ACTIVE" ? pal.current.b : pal.current.a);
      holoMat.current.opacity = state === "LOCKED" ? 0.5 : 0.95;
    }
  });

  return (
    <group position={[Math.cos(angle) * radius, 0, Math.sin(angle) * radius]} ref={grp}>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[0.55, h, 0.55]} />
        <meshStandardMaterial ref={mat} color="#0d0b12" emissive={dead} emissiveIntensity={0.1} metalness={0.7} roughness={0.2} toneMapped={false} />
      </mesh>
      <mesh position={[0, h + 0.4, 0]} rotation={[0, Math.PI / 4, 0]}>
        <octahedronGeometry args={[0.28]} />
        <meshBasicMaterial ref={gem} toneMapped={false} />
      </mesh>
      {tex && (
        <mesh ref={holo} position={[0, h + 1.5, 0]}>
          <planeGeometry args={[3.6, 0.9]} />
          <meshBasicMaterial ref={holoMat} map={tex} transparent depthWrite={false} toneMapped={false} fog={false} />
        </mesh>
      )}
      <mesh ref={beam} position={[0, h + 12, 0]}>
        <cylinderGeometry args={[0.12, 0.45, 24, 14, 1, true]} />
        <meshBasicMaterial ref={beamMat} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} fog={false} />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 0.7, 40]} />
        <meshBasicMaterial ref={ring} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Orbs({ count }: { count: number }) {
  const pal = usePal();
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const n = Math.min(Math.max(count, 0), 16);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    refs.current.forEach((m, i) => {
      if (!m) return;
      const a = t * (0.22 + (i % 5) * 0.04) + i * 2.399;
      const rad = 2 + (i % 4) * 0.8;
      m.position.set(Math.cos(a) * rad, 1.1 + Math.sin(t * 0.9 + i) * 0.5 + (i % 3) * 0.55, Math.sin(a) * rad);
      (m.material as THREE.MeshBasicMaterial).color.copy(i % 2 ? pal.current.a : pal.current.b);
    });
  });
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} ref={(el) => void (refs.current[i] = el)}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshBasicMaterial toneMapped={false} />
        </mesh>
      ))}
    </>
  );
}

function Shockwave({ pulse }: { pulse: number }) {
  const pal = usePal();
  const ring = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const start = useRef<number>(-99);
  const last = useRef(pulse);
  useFrame(({ clock }) => {
    if (pulse !== last.current) {
      last.current = pulse;
      start.current = clock.elapsedTime;
    }
    const age = clock.elapsedTime - start.current;
    const m = ring.current;
    if (!m || !mat.current) return;
    if (age < 0 || age > 2.6) {
      m.visible = false;
      return;
    }
    m.visible = true;
    const s = 1 + age * 15;
    m.scale.set(s, s, s);
    mat.current.color.copy(pal.current.b);
    mat.current.opacity = Math.max(0, 0.95 - age / 2.6);
  });
  return (
    <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]} visible={false}>
      <ringGeometry args={[0.93, 1, 80]} />
      <meshBasicMaterial ref={mat} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/* ------------------------------ camera ------------------------------ */

const KF = [
  { p: 0, r: 58, h: 22, look: 4.5, a: 0 },
  { p: 0.22, r: 54, h: 18, look: 5, a: 0.5 },
  { p: 0.5, r: 50, h: 13, look: 9, a: 1.3 },
  { p: 0.75, r: 52, h: 16, look: 7, a: 2.1 },
  { p: 1, r: 58, h: 22, look: 5, a: 2.9 },
];
function path(p: number) {
  for (let i = 0; i < KF.length - 1; i++) {
    const a = KF[i];
    const b = KF[i + 1];
    if (p <= b.p) {
      const t = smooth((p - a.p) / (b.p - a.p));
      return { r: THREE.MathUtils.lerp(a.r, b.r, t), h: THREE.MathUtils.lerp(a.h, b.h, t), look: THREE.MathUtils.lerp(a.look, b.look, t), a: THREE.MathUtils.lerp(a.a, b.a, t) };
    }
  }
  const l = KF[KF.length - 1];
  return { r: l.r, h: l.h, look: l.look, a: l.a };
}

function CameraRig({ variant, reduced, scroll }: { variant: "hero" | "room"; reduced: boolean; scroll?: MotionValue<number> }) {
  const { camera, pointer } = useThree();
  useFrame(({ clock }, dt) => {
    const spin = reduced ? 0 : clock.elapsedTime * (variant === "hero" ? 0.04 : 0.03);
    let r = 50;
    let h = 19;
    let look = 4.2;
    let a = 0;
    if (variant === "hero") {
      const k = path(scroll ? THREE.MathUtils.clamp(scroll.get(), 0, 1) : 0);
      r = k.r;
      h = k.h;
      look = k.look;
      a = k.a;
    }
    const t = spin + a;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, Math.cos(t) * r + pointer.x * 1.6, 3, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, Math.sin(t) * r, 3, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, h + pointer.y * 1, 3, dt);
    camera.lookAt(0, look, 0);
  });
  return null;
}

/* ------------------------------ root ------------------------------ */

/** Phones and low-core / low-memory machines start in the light profile. */
function startsLow() {
  if (typeof window === "undefined") return false;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  return window.innerWidth < 768 || (navigator.hardwareConcurrency ?? 8) <= 4 || (mem !== undefined && mem <= 4);
}

export default function CityScene({ accent, accent2, seed, stages, labels, world: worldProp, members = 0, pulse = 0, variant = "hero", scroll }: CitySceneProps) {
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // Adaptive quality: start light on weak devices, and drop to light if the frame rate sags.
  const [low, setLow] = useState(startsLow);
  const world = worldProp ?? deriveWorld(seed);
  return (
    <Canvas dpr={low ? [1, 1] : [1, 1.6]} camera={{ position: [56, 21, 0], fov: 38, near: 0.1, far: 400 }} gl={{ antialias: false, powerPreference: "high-performance" }} style={{ position: "absolute", inset: 0 }} onCreated={({ camera }) => camera.lookAt(0, 4.5, 0)}>
      <PerformanceMonitor onDecline={() => setLow(true)} flipflops={1} />
      <PaletteDriver accent={accent} accent2={accent2}>
        <fogExp2 attach="fog" args={[FOG, world.fog]} />
        <Sky />
        <ambientLight intensity={0.3} />
        <PaletteLights />
        <Skyline seed={seed} world={world} />
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[160, 160]} />
          {low ? (
            <meshStandardMaterial color="#0b0910" metalness={0.6} roughness={0.45} />
          ) : (
            <MeshReflectorMaterial blur={[260, 90]} resolution={512} mixBlur={1} mixStrength={22} mirror={0.6} roughness={0.9} depthScale={0.6} minDepthThreshold={0.4} maxDepthThreshold={1.3} color="#0b0910" metalness={0.6} />
          )}
        </mesh>
        <gridHelper args={[70, 28, accent, "#1c1626"]} position={[0, 0.01, 0]} />
        {stages.map((s, i) => (
          <Obelisk key={i} index={i} total={Math.max(stages.length, 1)} state={s} label={labels?.[i]} />
        ))}
        <Orbs count={members} />
        <Traffic count={low ? 60 : 150} lift={[0.14, 0.2]} speed={[3, 8]} seed={321} size={[0.55, 0.08, 0.14]} />
        <Traffic count={low ? 10 : 26} lift={[5, 15]} speed={[1.2, 3]} seed={77} size={[1.1, 0.14, 0.3]} />
        <Rain count={Math.max(40, Math.round((low ? 400 : 1100) * world.rain))} />
        <Searchlight which="b" phase={0} x={-16} z={-20} />
        <Searchlight which="a" phase={2.4} x={18} z={-14} />
        {!low && <Sparkles count={90} scale={[44, 14, 44]} size={2.2} speed={0.25} opacity={0.5} color={accent2} position={[0, 7, 0]} />}
        <Shockwave pulse={pulse} />
        <CameraRig variant={variant} reduced={Boolean(reduced)} scroll={scroll} />
        {low ? (
          <EffectComposer multisampling={0}>
            <Bloom intensity={0.9} luminanceThreshold={0.5} />
          </EffectComposer>
        ) : (
          <EffectComposer multisampling={0}>
            <Bloom intensity={1} luminanceThreshold={0.42} luminanceSmoothing={0.25} mipmapBlur />
            <Noise opacity={0.05} />
            <Vignette eskil={false} offset={0.15} darkness={0.9} />
          </EffectComposer>
        )}
      </PaletteDriver>
    </Canvas>
  );
}
