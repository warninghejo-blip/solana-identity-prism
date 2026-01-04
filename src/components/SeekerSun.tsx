import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VISUAL_CONFIG } from '@/constants';
import type { StellarProfile } from '@/lib/solarSystemGenerator';

interface SeekerSunProps {
  profile: StellarProfile;
  walletSeed?: string;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function getProceduralParams(seed: string) {
  const hash = hashString(seed);
  return {
    noiseScale: 1.5 + (hash % 100) / 50,
    turbulence: 0.8 + (hash % 40) / 100,
    pulseSpeed: 0.3 + (hash % 50) / 100,
    sunspotDensity: 0.5 + (hash % 50) / 100,
  };
}

const plasmaVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  void main() {
    vUv = uv;
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const plasmaFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uIntensity;
  uniform float uNoiseScale;
  uniform float uTurbulence;
  uniform float uPulseSpeed;
  uniform float uSunspotDensity;
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
  
  void main() {
    vec3 pos = vPosition * uNoiseScale;
    float t = uTime * uPulseSpeed;
    float noise = snoise(pos + t * 0.1) * uTurbulence;
    noise += snoise(pos * 2.0 - t * 0.15) * 0.5 * uTurbulence;
    float sunspots = snoise(pos * 3.0 + vec3(t * 0.05)) * uSunspotDensity;
    sunspots = smoothstep(0.3, 0.8, sunspots);
    float plasma = noise * 0.5 + 0.5;
    vec3 color = mix(uColor1, uColor2, plasma);
    color = mix(color, color * 0.3, sunspots * 0.4);
    float core = pow(1.0 - length(vUv - 0.5) * 1.8, 4.0);
    color = mix(color, vec3(1.0), max(core, 0.0) * 0.8);
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 3.0);
    color += uColor1 * fresnel * 0.6;
    gl_FragColor = vec4(color * uIntensity, 1.0);
  }
`;

const sparkCoronaFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    float dist = length(uv);
    float angle = atan(uv.y, uv.x);
    float sparks = 0.0;
    for(int i = 0; i < 16; i++) {
        float speed = 0.3 + hash(vec2(float(i))) * 0.7;
        float spark_angle = uTime * speed + hash(vec2(float(i), 1.0)) * 6.28;
        sparks += smoothstep(0.01, 0.0, abs(sin(angle - spark_angle))) * smoothstep(1.0, 0.6, dist) * smoothstep(0.3, 0.9, dist);
    }
    gl_FragColor = vec4(uColor * sparks * 5.0, sparks);
  }
`;

function GlowLayer({ size, color, opacity = 0.3, scale = 1.2 }: any) {
  return (
    <mesh scale={scale}>
      <sphereGeometry args={[size, 64, 64]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

function SunCore({ color1, color2, size, intensity = 3, neonGlow = false, sparkCorona = false, params }: any) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const coronaMatRef = useRef<THREE.ShaderMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color(color1) },
    uColor2: { value: new THREE.Color(color2) },
    uIntensity: { value: intensity * (neonGlow ? 2.0 : 1.0) },
    uNoiseScale: { value: params.noiseScale || 2 },
    uTurbulence: { value: params.turbulence || 1 },
    uPulseSpeed: { value: params.pulseSpeed || 0.5 },
    uSunspotDensity: { value: params.sunspotDensity || 0.7 },
  }), [color1, color2, intensity, neonGlow, params]);

  useFrame((state) => {
    if (materialRef.current) materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    if (coronaMatRef.current) coronaMatRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    if (meshRef.current) meshRef.current.rotation.y += 0.0002;
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[size, 64, 64]} />
        <shaderMaterial ref={materialRef} vertexShader={plasmaVertexShader} fragmentShader={plasmaFragmentShader} uniforms={uniforms} toneMapped={false} />
      </mesh>
      {sparkCorona && (
        <mesh scale={2.0}>
          <planeGeometry args={[size * 5, size * 5]} />
          <shaderMaterial ref={coronaMatRef} vertexShader={plasmaVertexShader} fragmentShader={sparkCoronaFragmentShader} uniforms={{ uTime: { value: 0 }, uColor: { value: new THREE.Color(color1) } }} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}
      {neonGlow && <GlowLayer size={size} color={color1} opacity={0.5} scale={1.4} />}
      <GlowLayer size={size} color={color1} opacity={0.2} scale={1.1} />
    </group>
  );
}

function BinaryStarSystem({ palette, mode, intensity, params }: any) {
  const primaryRef = useRef<THREE.Group>(null);
  const secondaryRef = useRef<THREE.Group>(null);
  const primaryLightRef = useRef<THREE.PointLight>(null);
  const secondaryLightRef = useRef<THREE.PointLight>(null);

  const orbitRadius = mode === 'binaryPulsar' ? 6.5 : 4.8;
  const orbitSpeed = mode === 'binaryPulsar' ? 0.12 : 0.08;

  useFrame((state) => {
    const angle = state.clock.elapsedTime * orbitSpeed;
    const verticalWobble = Math.sin(angle * 0.5) * (mode === 'binaryPulsar' ? 0.4 : 0.2);

    if (primaryRef.current) {
      primaryRef.current.position.set(
        Math.cos(angle) * orbitRadius,
        verticalWobble,
        Math.sin(angle) * orbitRadius
      );
      primaryRef.current.rotation.y += 0.001;
    }
    if (secondaryRef.current) {
      secondaryRef.current.position.set(
        Math.cos(angle + Math.PI) * orbitRadius,
        -verticalWobble,
        Math.sin(angle + Math.PI) * orbitRadius
      );
      secondaryRef.current.rotation.y += 0.001;
    }
    if (primaryLightRef.current) {
      primaryLightRef.current.position.copy(primaryRef.current?.position || new THREE.Vector3());
    }
    if (secondaryLightRef.current) {
      secondaryLightRef.current.position.copy(secondaryRef.current?.position || new THREE.Vector3());
    }
  });

  return (
    <group>
      <group ref={primaryRef}>
        <SunCore
          color1={palette.primary}
          color2={palette.secondary}
          size={VISUAL_CONFIG.SUN.BASE_SIZE * 0.8}
          intensity={intensity}
          neonGlow={mode !== 'binaryPulsar'}
          params={params}
        />
      </group>
      <group ref={secondaryRef}>
        <SunCore
          color1={palette.secondary}
          color2={palette.primary}
          size={VISUAL_CONFIG.SUN.BASE_SIZE * (mode === 'binaryPulsar' ? 0.85 : 0.7)}
          intensity={intensity * 0.9}
          sparkCorona={mode !== 'binaryPulsar'}
          params={params}
        />
      </group>
      <pointLight ref={primaryLightRef} color={palette.primary} intensity={intensity * 35} distance={400} decay={2} />
      <pointLight ref={secondaryLightRef} color={palette.secondary} intensity={intensity * 30} distance={400} decay={2} />
    </group>
  );
}

export function SeekerSun({ profile, walletSeed = 'default' }: SeekerSunProps) {
  const params = useMemo(() => getProceduralParams(walletSeed), [walletSeed]);
  const { palette, mode, sunType, intensity } = profile;

  if (mode === 'single') {
    return (
      <group>
        <SunCore color1={palette.primary} color2={palette.secondary} size={VISUAL_CONFIG.SUN.BASE_SIZE} intensity={intensity} neonGlow={sunType === 'seeker'} sparkCorona={sunType === 'preorder'} params={params} />
        <pointLight color={palette.primary} intensity={intensity * 40} distance={120} decay={2} />
      </group>
    );
  }

  return <BinaryStarSystem palette={palette} mode={mode} intensity={intensity} params={params} />;
}
