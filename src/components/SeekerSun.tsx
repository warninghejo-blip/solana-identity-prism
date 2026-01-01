import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VISUAL_CONFIG } from '@/constants';

interface SeekerSunProps {
  sunType: 'combo' | 'seeker' | 'preorder' | 'default';
}

// Plasma shader for the sun surface
const plasmaVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  
  void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const plasmaFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uIntensity;
  
  varying vec2 vUv;
  varying vec3 vPosition;
  
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
    vec3 pos = vPosition * 2.0;
    
    // Multi-layered plasma effect
    float noise1 = snoise(pos + uTime * 0.1);
    float noise2 = snoise(pos * 2.0 - uTime * 0.15) * 0.5;
    float noise3 = snoise(pos * 4.0 + uTime * 0.2) * 0.25;
    
    float plasma = noise1 + noise2 + noise3;
    plasma = plasma * 0.5 + 0.5; // Normalize to 0-1
    
    // Color mixing with smooth gradient
    vec3 color = mix(uColor1, uColor2, plasma);
    
    // Add bright core (fixes black center bug)
    float centerGlow = 1.0 - length(vUv - 0.5) * 1.5;
    centerGlow = clamp(centerGlow, 0.0, 1.0);
    color += vec3(1.0, 0.95, 0.9) * centerGlow * 0.5;
    
    // Intensity boost
    color *= uIntensity;
    
    // HDR bloom-friendly output
    gl_FragColor = vec4(color, 1.0);
  }
`;

// Corona/glow shader
const coronaFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uIntensity;
  
  varying vec2 vUv;
  
  void main() {
    vec2 center = vec2(0.5, 0.5);
    float dist = length(vUv - center);
    
    // Soft glow falloff
    float glow = 1.0 - smoothstep(0.0, 0.5, dist);
    glow = pow(glow, 2.0);
    
    // Pulsing effect
    float pulse = sin(uTime * 0.5) * 0.1 + 0.9;
    
    vec3 color = uColor * glow * uIntensity * pulse;
    float alpha = glow * 0.6;
    
    gl_FragColor = vec4(color, alpha);
  }
`;

function SunCore({ color1, color2, intensity = 3 }: { 
  color1: string; 
  color2: string; 
  intensity?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color(color1) },
    uColor2: { value: new THREE.Color(color2) },
    uIntensity: { value: intensity },
  }), [color1, color2, intensity]);
  
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

function SunCorona({ color, scale = 1.3, intensity = 1.5 }: { 
  color: string; 
  scale?: number;
  intensity?: number;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(color) },
    uIntensity: { value: intensity },
  }), [color, intensity]);
  
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });
  
  return (
    <mesh scale={scale}>
      <sphereGeometry args={[VISUAL_CONFIG.SUN.BASE_SIZE, 32, 32]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={plasmaVertexShader}
        fragmentShader={coronaFragmentShader}
        uniforms={uniforms}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

// Binary star system for combo effect
function BinaryStar() {
  const groupRef = useRef<THREE.Group>(null);
  const star1Ref = useRef<THREE.Group>(null);
  const star2Ref = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    if (groupRef.current) {
      groupRef.current.rotation.y += VISUAL_CONFIG.ANIMATION.BINARY_ORBIT;
    }
    
    // Orbital motion for binary stars
    const orbitRadius = 1.8;
    const orbitSpeed = VISUAL_CONFIG.ANIMATION.BINARY_ORBIT * 50;
    
    if (star1Ref.current) {
      star1Ref.current.position.x = Math.cos(time * orbitSpeed) * orbitRadius;
      star1Ref.current.position.z = Math.sin(time * orbitSpeed) * orbitRadius;
    }
    
    if (star2Ref.current) {
      star2Ref.current.position.x = Math.cos(time * orbitSpeed + Math.PI) * orbitRadius;
      star2Ref.current.position.z = Math.sin(time * orbitSpeed + Math.PI) * orbitRadius;
    }
  });
  
  return (
    <group ref={groupRef}>
      {/* Cyan star (Seeker) */}
      <group ref={star1Ref}>
        <mesh>
          <sphereGeometry args={[VISUAL_CONFIG.SUN.BASE_SIZE * 0.7, 64, 64]} />
          <meshStandardMaterial
            color={VISUAL_CONFIG.SUN.SEEKER_COLOR}
            emissive={VISUAL_CONFIG.SUN.SEEKER_COLOR}
            emissiveIntensity={VISUAL_CONFIG.SUN.EMISSIVE_INTENSITY}
            toneMapped={false}
          />
        </mesh>
        <SunCorona color={VISUAL_CONFIG.SUN.SEEKER_COLOR} scale={1.4} intensity={2} />
      </group>
      
      {/* Gold star (Preorder) */}
      <group ref={star2Ref}>
        <mesh>
          <sphereGeometry args={[VISUAL_CONFIG.SUN.BASE_SIZE * 0.6, 64, 64]} />
          <meshStandardMaterial
            color={VISUAL_CONFIG.SUN.PREORDER_COLOR}
            emissive={VISUAL_CONFIG.SUN.PREORDER_COLOR}
            emissiveIntensity={VISUAL_CONFIG.SUN.EMISSIVE_INTENSITY}
            toneMapped={false}
          />
        </mesh>
        <SunCorona color={VISUAL_CONFIG.SUN.PREORDER_COLOR} scale={1.4} intensity={2} />
      </group>
      
      {/* Central aurora bridge between stars */}
      <mesh>
        <torusGeometry args={[1.8, 0.15, 16, 100]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#88ffff"
          emissiveIntensity={1}
          transparent
          opacity={0.3}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// Dual-layered aurora corona for combo effect
function DualAuroraCorona() {
  const corona1Ref = useRef<THREE.Mesh>(null);
  const corona2Ref = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    if (corona1Ref.current) {
      corona1Ref.current.rotation.x = time * 0.002;
      corona1Ref.current.rotation.z = time * 0.001;
    }
    
    if (corona2Ref.current) {
      corona2Ref.current.rotation.x = -time * 0.0015;
      corona2Ref.current.rotation.y = time * 0.002;
    }
  });
  
  return (
    <>
      {/* Cyan aurora layer */}
      <mesh ref={corona1Ref} scale={2.8}>
        <torusGeometry args={[1.2, 0.08, 16, 100]} />
        <meshStandardMaterial
          color={VISUAL_CONFIG.SUN.COMBO_PRIMARY}
          emissive={VISUAL_CONFIG.SUN.COMBO_PRIMARY}
          emissiveIntensity={2}
          transparent
          opacity={0.5}
          toneMapped={false}
        />
      </mesh>
      
      {/* Gold aurora layer */}
      <mesh ref={corona2Ref} scale={3.2} rotation={[Math.PI / 3, 0, Math.PI / 4]}>
        <torusGeometry args={[1.1, 0.06, 16, 100]} />
        <meshStandardMaterial
          color={VISUAL_CONFIG.SUN.COMBO_SECONDARY}
          emissive={VISUAL_CONFIG.SUN.COMBO_SECONDARY}
          emissiveIntensity={2}
          transparent
          opacity={0.4}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}

export function SeekerSun({ sunType }: SeekerSunProps) {
  switch (sunType) {
    case 'combo':
      return (
        <group>
          <BinaryStar />
          <DualAuroraCorona />
          {/* Central glow */}
          <pointLight 
            color="#00ffff" 
            intensity={100} 
            distance={50} 
            decay={2} 
          />
          <pointLight 
            color="#ffd700" 
            intensity={80} 
            distance={50} 
            decay={2} 
          />
        </group>
      );
      
    case 'seeker':
      return (
        <group>
          <SunCore 
            color1={VISUAL_CONFIG.SUN.SEEKER_COLOR} 
            color2="#006688"
            intensity={3.5}
          />
          <SunCorona color={VISUAL_CONFIG.SUN.SEEKER_COLOR} scale={1.5} intensity={2} />
          <SunCorona color={VISUAL_CONFIG.SUN.SEEKER_COLOR} scale={1.8} intensity={1} />
          <pointLight 
            color={VISUAL_CONFIG.SUN.SEEKER_COLOR} 
            intensity={120} 
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
            color2="#ffaa00"
            intensity={3.5}
          />
          <SunCorona color={VISUAL_CONFIG.SUN.PREORDER_COLOR} scale={1.5} intensity={2} />
          <SunCorona color="#ffffff" scale={1.8} intensity={0.8} />
          <pointLight 
            color={VISUAL_CONFIG.SUN.PREORDER_COLOR} 
            intensity={120} 
            distance={60} 
            decay={2} 
          />
        </group>
      );
      
    default:
      return (
        <group>
          <SunCore 
            color1={VISUAL_CONFIG.SUN.DEFAULT_COLOR} 
            color2="#ff3300"
            intensity={3}
          />
          <SunCorona color={VISUAL_CONFIG.SUN.DEFAULT_COLOR} scale={1.4} intensity={1.5} />
          <pointLight 
            color={VISUAL_CONFIG.SUN.DEFAULT_COLOR} 
            intensity={100} 
            distance={50} 
            decay={2} 
          />
        </group>
      );
  }
}
