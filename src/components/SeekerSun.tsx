import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VISUAL_CONFIG } from '@/constants';

interface SeekerSunProps {
  sunType: 'combo' | 'seeker' | 'preorder' | 'default';
  walletSeed?: string;
}

// Hash function to generate deterministic values from wallet address
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Generate procedural uniqueness from wallet seed
function getProceduralParams(seed: string) {
  const hash = hashString(seed);
  return {
    noiseScale: 1.5 + (hash % 100) / 50, // 1.5 - 3.5
    hueShift: (hash % 360) / 360, // 0 - 1
    turbulence: 0.8 + (hash % 40) / 100, // 0.8 - 1.2
    pulseSpeed: 0.3 + (hash % 50) / 100, // 0.3 - 0.8
  };
}

// High-quality plasma vertex shader
const plasmaVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  
  void main() {
    vUv = uv;
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Clean, non-overlapping plasma fragment shader with intense core
const plasmaFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uIntensity;
  uniform float uNoiseScale;
  uniform float uTurbulence;
  uniform float uPulseSpeed;
  
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  
  // Simplex noise functions
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
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    
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
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
  
  void main() {
    vec3 pos = vPosition * uNoiseScale;
    
    // Multi-layered turbulent plasma
    float t = uTime * uPulseSpeed;
    float noise1 = snoise(pos + t * 0.1) * uTurbulence;
    float noise2 = snoise(pos * 2.0 - t * 0.15) * 0.5 * uTurbulence;
    float noise3 = snoise(pos * 4.0 + t * 0.2) * 0.25 * uTurbulence;
    
    float plasma = noise1 + noise2 + noise3;
    plasma = plasma * 0.5 + 0.5;
    
    // Smooth color gradient
    vec3 color = mix(uColor1, uColor2, plasma);
    
    // CRITICAL: Intense bright core to fix black center
    float coreIntensity = pow(1.0 - length(vUv - 0.5) * 1.8, 3.0);
    coreIntensity = max(coreIntensity, 0.0);
    vec3 coreColor = vec3(1.0, 0.98, 0.95); // Warm white
    color = mix(color, coreColor, coreIntensity * 0.7);
    
    // Fresnel rim glow
    float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
    color += uColor1 * fresnel * 0.4;
    
    // Apply intensity
    color *= uIntensity;
    
    // Subtle pulsing
    float pulse = sin(uTime * uPulseSpeed * 2.0) * 0.05 + 1.0;
    color *= pulse;
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

// Main sun core - SINGLE sphere, no overlapping
function SunCore({ 
  color1, 
  color2, 
  intensity = 3,
  noiseScale = 2,
  turbulence = 1,
  pulseSpeed = 0.5,
}: { 
  color1: string; 
  color2: string; 
  intensity?: number;
  noiseScale?: number;
  turbulence?: number;
  pulseSpeed?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color(color1) },
    uColor2: { value: new THREE.Color(color2) },
    uIntensity: { value: intensity },
    uNoiseScale: { value: noiseScale },
    uTurbulence: { value: turbulence },
    uPulseSpeed: { value: pulseSpeed },
  }), [color1, color2, intensity, noiseScale, turbulence, pulseSpeed]);
  
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
    if (meshRef.current) {
      meshRef.current.rotation.y += VISUAL_CONFIG.ANIMATION.SUN_ROTATION;
    }
  });
  
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[VISUAL_CONFIG.SUN.BASE_SIZE, 64, 64]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={plasmaVertexShader}
        fragmentShader={plasmaFragmentShader}
        uniforms={uniforms}
        toneMapped={false}
      />
    </mesh>
  );
}

// Binary star system for combo effect - two distinct cores orbiting
function BinaryStar() {
  const groupRef = useRef<THREE.Group>(null);
  const star1Ref = useRef<THREE.Mesh>(null);
  const star2Ref = useRef<THREE.Mesh>(null);
  const material1Ref = useRef<THREE.ShaderMaterial>(null);
  const material2Ref = useRef<THREE.ShaderMaterial>(null);
  
  const uniforms1 = useMemo(() => ({
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color(VISUAL_CONFIG.SUN.SEEKER_COLOR) },
    uColor2: { value: new THREE.Color('#006688') },
    uIntensity: { value: 4 },
    uNoiseScale: { value: 2.5 },
    uTurbulence: { value: 1.1 },
    uPulseSpeed: { value: 0.4 },
  }), []);
  
  const uniforms2 = useMemo(() => ({
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color(VISUAL_CONFIG.SUN.PREORDER_COLOR) },
    uColor2: { value: new THREE.Color('#ffaa00') },
    uIntensity: { value: 4 },
    uNoiseScale: { value: 2.2 },
    uTurbulence: { value: 0.9 },
    uPulseSpeed: { value: 0.5 },
  }), []);
  
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    if (groupRef.current) {
      groupRef.current.rotation.y += VISUAL_CONFIG.ANIMATION.BINARY_ORBIT * 0.5;
    }
    
    // Orbital motion for binary stars
    const orbitRadius = 2.2;
    const orbitSpeed = VISUAL_CONFIG.ANIMATION.BINARY_ORBIT * 30;
    
    if (star1Ref.current) {
      star1Ref.current.position.x = Math.cos(time * orbitSpeed) * orbitRadius;
      star1Ref.current.position.z = Math.sin(time * orbitSpeed) * orbitRadius;
      star1Ref.current.rotation.y += VISUAL_CONFIG.ANIMATION.SUN_ROTATION;
    }
    
    if (star2Ref.current) {
      star2Ref.current.position.x = Math.cos(time * orbitSpeed + Math.PI) * orbitRadius;
      star2Ref.current.position.z = Math.sin(time * orbitSpeed + Math.PI) * orbitRadius;
      star2Ref.current.rotation.y += VISUAL_CONFIG.ANIMATION.SUN_ROTATION;
    }
    
    if (material1Ref.current) {
      material1Ref.current.uniforms.uTime.value = time;
    }
    if (material2Ref.current) {
      material2Ref.current.uniforms.uTime.value = time;
    }
  });
  
  return (
    <group ref={groupRef}>
      {/* Cyan star (Seeker) */}
      <mesh ref={star1Ref}>
        <sphereGeometry args={[VISUAL_CONFIG.SUN.BASE_SIZE * 0.75, 64, 64]} />
        <shaderMaterial
          ref={material1Ref}
          vertexShader={plasmaVertexShader}
          fragmentShader={plasmaFragmentShader}
          uniforms={uniforms1}
          toneMapped={false}
        />
      </mesh>
      
      {/* Gold star (Preorder) */}
      <mesh ref={star2Ref}>
        <sphereGeometry args={[VISUAL_CONFIG.SUN.BASE_SIZE * 0.65, 64, 64]} />
        <shaderMaterial
          ref={material2Ref}
          vertexShader={plasmaVertexShader}
          fragmentShader={plasmaFragmentShader}
          uniforms={uniforms2}
          toneMapped={false}
        />
      </mesh>
      
      {/* Energy bridge between stars - subtle */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.2, 0.08, 16, 100]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Central lights */}
      <pointLight 
        color={VISUAL_CONFIG.SUN.SEEKER_COLOR} 
        intensity={80} 
        distance={60} 
        decay={2} 
      />
      <pointLight 
        color={VISUAL_CONFIG.SUN.PREORDER_COLOR} 
        intensity={60} 
        distance={60} 
        decay={2} 
      />
    </group>
  );
}

// Pulsar effect for combo - light beams from poles
function PulsarBeams() {
  const beam1Ref = useRef<THREE.Mesh>(null);
  const beam2Ref = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const pulse = Math.sin(time * 0.3) * 0.15 + 1;
    
    if (beam1Ref.current) {
      beam1Ref.current.scale.y = pulse;
      beam1Ref.current.rotation.y = time * 0.1;
    }
    if (beam2Ref.current) {
      beam2Ref.current.scale.y = pulse;
      beam2Ref.current.rotation.y = -time * 0.1;
    }
  });
  
  return (
    <>
      {/* Upper beam */}
      <mesh ref={beam1Ref} position={[0, 8, 0]}>
        <coneGeometry args={[0.8, 16, 32, 1, true]} />
        <meshBasicMaterial
          color="#00ffff"
          transparent
          opacity={0.12}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Lower beam */}
      <mesh ref={beam2Ref} position={[0, -8, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.8, 16, 32, 1, true]} />
        <meshBasicMaterial
          color="#ffd700"
          transparent
          opacity={0.12}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
}

export function SeekerSun({ sunType, walletSeed = 'default' }: SeekerSunProps) {
  const proceduralParams = useMemo(() => getProceduralParams(walletSeed), [walletSeed]);
  
  switch (sunType) {
    case 'combo':
      return (
        <group>
          <BinaryStar />
          <PulsarBeams />
        </group>
      );
      
    case 'seeker':
      return (
        <group>
          <SunCore 
            color1={VISUAL_CONFIG.SUN.SEEKER_COLOR} 
            color2="#004466"
            intensity={4}
            noiseScale={2.5}
            turbulence={1.2}
            pulseSpeed={0.4}
          />
          <pointLight 
            color={VISUAL_CONFIG.SUN.SEEKER_COLOR} 
            intensity={100} 
            distance={60} 
            decay={2} 
          />
        </group>
      );
      
    case 'preorder':
      return (
        <group>
          <SunCore 
            color1={VISUAL_CONFIG.SUN.PREORDER_COLOR} 
            color2="#cc8800"
            intensity={4}
            noiseScale={2.2}
            turbulence={1.0}
            pulseSpeed={0.5}
          />
          <pointLight 
            color={VISUAL_CONFIG.SUN.PREORDER_COLOR} 
            intensity={100} 
            distance={60} 
            decay={2} 
          />
        </group>
      );
      
    default:
      // Procedurally unique sun based on wallet address
      return (
        <group>
          <SunCore 
            color1={VISUAL_CONFIG.SUN.DEFAULT_COLOR} 
            color2="#cc3300"
            intensity={3}
            noiseScale={proceduralParams.noiseScale}
            turbulence={proceduralParams.turbulence}
            pulseSpeed={proceduralParams.pulseSpeed}
          />
          <pointLight 
            color={VISUAL_CONFIG.SUN.DEFAULT_COLOR} 
            intensity={80} 
            distance={50} 
            decay={2} 
          />
        </group>
      );
  }
}