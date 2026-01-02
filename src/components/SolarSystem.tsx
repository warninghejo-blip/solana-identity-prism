import { useRef, useMemo, Suspense, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration, Vignette, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { SeekerSun } from './SeekerSun';
import { generateSolarSystem, type PlanetData, type MoonData } from '@/lib/solarSystemGenerator';
import { VISUAL_CONFIG } from '@/constants';
import type { WalletTraits } from '@/hooks/useWalletData';

interface SolarSystemProps {
  traits: WalletTraits;
  walletAddress?: string;
}

// Responsive camera controller
function ResponsiveCamera() {
  const { camera, size } = useThree();
  
  useEffect(() => {
    const aspect = size.width / size.height;
    const isMobile = aspect < 1;
    
    if (isMobile) {
      // Mobile: zoom out more, tilt camera higher
      camera.position.set(0, 35, 45);
      (camera as THREE.PerspectiveCamera).fov = 75;
    } else {
      // Desktop: standard view
      camera.position.set(0, 15, 30);
      (camera as THREE.PerspectiveCamera).fov = 60;
    }
    
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  }, [camera, size]);
  
  return null;
}

// Faint orbital path - very thin and transparent
function OrbitPath({ radius }: { radius: number }) {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const angle = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius
      ));
    }
    return pts;
  }, [radius]);

  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, [points]);

  const lineMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: '#4488ff',
      transparent: true,
      opacity: 0.03, // Even more transparent
      blending: THREE.AdditiveBlending,
    });
  }, []);

  return (
    <primitive object={new THREE.Line(lineGeometry, lineMaterial)} />
  );
}

// Moon component
function Moon({ moon, planetPosition }: { moon: MoonData; planetPosition: THREE.Vector3 }) {
  const ref = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (ref.current) {
      const time = state.clock.elapsedTime;
      const angle = moon.initialAngle + time * moon.orbitSpeed;
      
      ref.current.position.x = planetPosition.x + Math.cos(angle) * moon.orbitRadius;
      ref.current.position.y = planetPosition.y + Math.sin(angle * 0.5) * 0.1;
      ref.current.position.z = planetPosition.z + Math.sin(angle) * moon.orbitRadius;
    }
  });
  
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[moon.size, 24, 24]} />
      <meshStandardMaterial
        color={moon.color}
        roughness={0.8}
        metalness={0.1}
      />
    </mesh>
  );
}

// Saturn-like ring for blue chip planets
function PlanetRing({ planetSize }: { planetSize: number }) {
  const ringRef = useRef<THREE.Mesh>(null);
  
  useFrame(() => {
    if (ringRef.current) {
      ringRef.current.rotation.z += 0.0001;
    }
  });
  
  return (
    <mesh ref={ringRef} rotation={[Math.PI / 2.5, 0, 0]}>
      <ringGeometry args={[planetSize * 1.5, planetSize * 2.5, 64]} />
      <meshStandardMaterial
        color="#daa520"
        emissive="#ffd700"
        emissiveIntensity={0.3}
        side={THREE.DoubleSide}
        transparent
        opacity={0.6}
        roughness={0.3}
        metalness={0.7}
      />
    </mesh>
  );
}

// Planet component with PBR materials
function Planet({ planet }: { planet: PlanetData }) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const positionRef = useRef(new THREE.Vector3());
  
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    if (groupRef.current) {
      const angle = planet.initialAngle + time * planet.orbitSpeed;
      groupRef.current.position.x = Math.cos(angle) * planet.orbitRadius;
      groupRef.current.position.z = Math.sin(angle) * planet.orbitRadius;
      positionRef.current.copy(groupRef.current.position);
    }
    
    if (meshRef.current) {
      meshRef.current.rotation.y += planet.rotationSpeed;
    }
  });
  
  return (
    <>
      <OrbitPath radius={planet.orbitRadius} />
      <group ref={groupRef}>
        <mesh ref={meshRef}>
          <sphereGeometry args={[planet.size, 48, 48]} />
          <meshStandardMaterial
            color={planet.type.color}
            roughness={planet.type.roughness}
            metalness={planet.type.metalness}
          />
        </mesh>
        
        {planet.hasRing && <PlanetRing planetSize={planet.size} />}
        
        {planet.moons.map((moon) => (
          <Moon key={moon.id} moon={moon} planetPosition={positionRef.current} />
        ))}
      </group>
    </>
  );
}

// Create circular particle texture for soft dust
function createCircleTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  
  // Radial gradient for soft circular particle
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
  gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.2)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Space dust/debris particles - CIRCULAR soft points (fixes square bug)
function SpaceDust({ particleCount, spreadRadius }: { particleCount: number; spreadRadius: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  
  const { positions, colors, sizes, circleTexture } = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const col = new Float32Array(particleCount * 3);
    const siz = new Float32Array(particleCount);
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      
      // Distribute in a sphere, avoiding the center
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 10 + Math.random() * spreadRadius;
      
      pos[i3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i3 + 1] = (Math.random() - 0.5) * spreadRadius * 0.3;
      pos[i3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      
      // Varied colors - warm white to cool white
      const warmth = Math.random();
      col[i3] = 0.9 + warmth * 0.1; // R
      col[i3 + 1] = 0.9 + warmth * 0.05; // G
      col[i3 + 2] = 0.85 + (1 - warmth) * 0.15; // B
      
      // Varied sizes
      siz[i] = 0.5 + Math.random() * 1.5;
    }
    
    return { 
      positions: pos, 
      colors: col, 
      sizes: siz,
      circleTexture: createCircleTexture()
    };
  }, [particleCount, spreadRadius]);
  
  useFrame(() => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.00003;
    }
  });
  
  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={particleCount}
          array={colors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={particleCount}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        map={circleTexture}
        size={0.15}
        vertexColors
        transparent
        opacity={0.4}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// High-fidelity starfield - crisp white points
function Starfield() {
  return (
    <Stars
      radius={VISUAL_CONFIG.STARS.RADIUS}
      depth={VISUAL_CONFIG.STARS.DEPTH}
      count={VISUAL_CONFIG.STARS.COUNT}
      factor={VISUAL_CONFIG.STARS.FACTOR}
      saturation={VISUAL_CONFIG.STARS.SATURATION}
      fade={VISUAL_CONFIG.STARS.FADE}
      speed={0.2}
    />
  );
}

// Empty starfield scene for disconnected wallets
function EmptyScene() {
  return (
    <>
      <ambientLight intensity={0.01} />
      <Starfield />
      <SpaceDust particleCount={100} spreadRadius={60} />
      
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={20}
        maxDistance={100}
        dampingFactor={0.03}
        enableDamping
        autoRotate
        autoRotateSpeed={0.03}
      />
    </>
  );
}

// Main scene content
function SolarSystemScene({ traits, walletAddress }: SolarSystemProps) {
  const systemData = useMemo(() => generateSolarSystem(traits, walletAddress), [traits, walletAddress]);
  
  return (
    <>
      {/* Responsive camera adjustment */}
      <ResponsiveCamera />
      
      {/* Ambient light for subtle fill */}
      <ambientLight intensity={0.03} />
      
      {/* High-fidelity starfield - crisp white points */}
      <Starfield />
      
      {/* The Sun - single core with procedural uniqueness */}
      <SeekerSun 
        sunType={systemData.sunType} 
        walletSeed={walletAddress || 'default'}
      />
      
      {/* Planets */}
      {systemData.planets.map((planet) => (
        <Planet key={planet.id} planet={planet} />
      ))}
      
      {/* Space dust - circular particles */}
      <SpaceDust 
        particleCount={systemData.spaceDust.particleCount} 
        spreadRadius={systemData.spaceDust.spreadRadius} 
      />
      
      {/* Camera controls with smooth damping */}
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={8}
        maxDistance={100}
        dampingFactor={0.03}
        enableDamping
        autoRotate
        autoRotateSpeed={0.06}
      />
      
      {/* Cinematic post-processing - optimized for mobile */}
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={VISUAL_CONFIG.POST_PROCESSING.BLOOM_INTENSITY}
          luminanceThreshold={VISUAL_CONFIG.POST_PROCESSING.BLOOM_LUMINANCE_THRESHOLD}
          luminanceSmoothing={VISUAL_CONFIG.POST_PROCESSING.BLOOM_LUMINANCE_SMOOTHING}
          mipmapBlur
        />
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={new THREE.Vector2(
            VISUAL_CONFIG.POST_PROCESSING.CHROMATIC_ABERRATION,
            VISUAL_CONFIG.POST_PROCESSING.CHROMATIC_ABERRATION
          )}
          radialModulation={true}
          modulationOffset={0.9}
        />
        <Vignette
          darkness={VISUAL_CONFIG.POST_PROCESSING.VIGNETTE_DARKNESS}
          offset={0.25}
        />
        <Noise
          opacity={VISUAL_CONFIG.POST_PROCESSING.NOISE_OPACITY}
          blendFunction={BlendFunction.SOFT_LIGHT}
        />
      </EffectComposer>
    </>
  );
}

// Loading fallback
function LoadingFallback() {
  return (
    <mesh>
      <sphereGeometry args={[1, 16, 16]} />
      <meshBasicMaterial color="#222" wireframe />
    </mesh>
  );
}

export function SolarSystem({ traits, walletAddress }: SolarSystemProps) {
  // Check if wallet is connected
  const isConnected = walletAddress && walletAddress !== '0xDemo...Wallet';
  
  return (
    <div className="w-full h-full absolute inset-0 bg-black">
      <Canvas
        camera={{ position: [0, 15, 30], fov: 60 }}
        gl={{ 
          antialias: true, 
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
          powerPreference: 'high-performance',
        }}
        dpr={[1, 1.5]} // Optimized for mobile
      >
        <Suspense fallback={<LoadingFallback />}>
          {isConnected || traits ? (
            <SolarSystemScene traits={traits} walletAddress={walletAddress} />
          ) : (
            <EmptyScene />
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}
