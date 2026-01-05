import { 
  Vector3, 
  MathUtils, 
  PerspectiveCamera, 
  EventDispatcher, 
  DoubleSide, 
  AdditiveBlending, 
  Color, 
  FrontSide, 
  NormalBlending, 
  Points, 
  Mesh, 
  Group, 
  LineSegments, 
  CanvasTexture, 
  ClampToEdgeWrapping, 
  ACESFilmicToneMapping,
  Texture,
  Vector2,
  BackSide
} from 'three';
import { useRef, useMemo, Suspense, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration, Vignette, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { VISUAL_CONFIG } from '@/constants';
import { SeekerSun } from './SeekerSun';
import type { PlanetData, MoonData, SolarSystemData, SpaceDustConfig, NebulaConfig } from '@/lib/solarSystemGenerator';
import { generatePlanetTextures, generateCloudTexture, generateMoonTexture, generateSolarSystem } from '@/lib/solarSystemGenerator';
import { useWalletData } from '@/hooks/useWalletData';
import type { WalletTraits } from '@/hooks/useWalletData';

const PLANET_TEXTURE_SIZE = 256;

function createSeededRandom(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Texture generation now centralized in solarSystemGenerator.ts

interface SolarSystemProps {
  traits: WalletTraits | null;
  walletAddress?: string;
  isWarping?: boolean;
}

function CinematicCamera({ isWarping, hasTraits }: { isWarping?: boolean; hasTraits: boolean }) {
  const { camera, size } = useThree();
  const targetPos = useRef(new Vector3(0, 15, 35));
  const targetFov = useRef(60);
  const currentFov = useRef(60);
  const lookAtPos = useRef(new Vector3(0, 0, 0));
  const isMobile = size.width < 768;
  const [isTransitioning, setIsTransitioning] = useState(true);
  const userInteracted = useRef(false);
  const controls = useThree((state) => state.controls);

  useEffect(() => {
    if (isWarping) {
      targetPos.current.set(0, 0, 50);
      targetFov.current = 160;
      lookAtPos.current.set(0, 0, 0);
    } else if (hasTraits) {
      // System in upper screen half with stats card clearance
      if (isMobile) {
        targetPos.current.set(0, 35, 90);
        targetFov.current = 85;
        lookAtPos.current.set(0, 2, 0); 
      } else {
        targetPos.current.set(0, 30, 80);
        targetFov.current = 65;
        lookAtPos.current.set(0, 2, 0);
      }
    } else {
      // Landing/Neutral position
      if (isMobile) {
        targetPos.current.set(0, 28, 60);
        targetFov.current = 85;
        lookAtPos.current.set(0, 2, 0);
      } else {
        targetPos.current.set(0, 22, 55);
        targetFov.current = 60;
        lookAtPos.current.set(0, 2, 0);
      }
    }
    
    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [size, isWarping, hasTraits, isMobile]);

  useEffect(() => {
    if (!controls) return;
    const onStart = () => {
      userInteracted.current = true;
      setIsTransitioning(false);
    };
    (controls as unknown as EventDispatcher).addEventListener('start', onStart);
    return () => (controls as unknown as EventDispatcher).removeEventListener('start', onStart);
  }, [controls]);

  useFrame((state) => {
    if (isWarping) {
      const intensity = 0.8;
      camera.position.x += (Math.random() - 0.5) * intensity;
      camera.position.y += (Math.random() - 0.5) * intensity;
    } else if (isTransitioning && !userInteracted.current) {
      camera.position.lerp(targetPos.current, 0.02);
      currentFov.current = MathUtils.lerp(currentFov.current, targetFov.current, 0.02);
      
      // Fix TS error: Property 'fov' does not exist on type 'Camera'
      if ('fov' in camera) {
        (camera as PerspectiveCamera).fov = currentFov.current;
      }
      
      camera.lookAt(lookAtPos.current);
      camera.updateProjectionMatrix();
    }
  });
  
  return null;
}

function OrbitPath({ radius, color }: { radius: number; color: string }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.02, radius + 0.02, 128]} />
      <meshBasicMaterial color={color} transparent opacity={0.05} side={DoubleSide} blending={AdditiveBlending} />
    </mesh>
  );
}

function Moon({ moon }: { moon: MoonData }) {
  const ref = useRef<Mesh>(null);
  
  const craterTexture = useMemo(() => {
    const seed = parseInt(moon.id.replace(/\D/g, '')) || 12345;
    return generateMoonTexture(seed);
  }, [moon.id]);
  
  useFrame((state) => {
    if (ref.current) {
      const angle = moon.initialAngle + state.clock.elapsedTime * VISUAL_CONFIG.ANIMATION.MOON_ORBIT;
      ref.current.position.x = Math.cos(angle) * moon.orbitRadius;
      ref.current.position.y = Math.sin(angle * 0.5) * (moon.inclination || 0);
      ref.current.position.z = Math.sin(angle) * moon.orbitRadius;
      ref.current.rotation.y += 0.005;
    }
  });
  
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[moon.size, 32, 32]} />
      <meshPhysicalMaterial 
        color="#8b8b8b" 
        map={craterTexture}
        bumpMap={craterTexture}
        bumpScale={0.02}
        roughness={0.95} 
        metalness={0.05}
        clearcoat={0.1}
        clearcoatRoughness={0.9}
      />
    </mesh>
  );
}

interface CloudLayerProps {
  planetSize: number;
  seed: number;
}

function CloudLayer({ planetSize, seed }: CloudLayerProps) {
  const cloudRef = useRef<Mesh>(null);
  
  const cloudTexture = useMemo(() => generateCloudTexture(seed), [seed]);
  
  useFrame((state, delta) => {
    if (cloudRef.current) {
      cloudRef.current.rotation.y += delta * 0.03;
    }
  });
  
  return (
    <mesh ref={cloudRef} scale={1.03}>
      <sphereGeometry args={[planetSize, 64, 64]} />
      <meshStandardMaterial
        map={cloudTexture}
        transparent
        opacity={0.7}
        depthWrite={false}
        side={FrontSide}
        blending={NormalBlending}
      />
    </mesh>
  );
}

function PlanetRing({ planetSize }: { planetSize: number }) {
  const pointsRef = useRef<Points>(null);
  const circleTex = useMemo(() => createCircleTexture(), []);
  const { positions, colors, count } = useMemo(() => {
    const particleCount = 8000;
    const pos = new Float32Array(particleCount * 3);
    const col = new Float32Array(particleCount * 3);
    const color = new Color('#ffffff');
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const angle = Math.random() * Math.PI * 2;
      const dist = planetSize * 1.4 + Math.random() * planetSize * 0.8;
      pos[i3] = Math.cos(angle) * dist;
      pos[i3 + 1] = (Math.random() - 0.5) * 0.02;
      pos[i3 + 2] = Math.sin(angle) * dist;
      
      const brightness = 0.3 + Math.random() * 0.7;
      col[i3] = color.r * brightness;
      col[i3 + 1] = color.g * brightness;
      col[i3 + 2] = color.b * brightness;
    }
    return { positions: pos, colors: col, count: particleCount };
  }, [planetSize]);

  useFrame(() => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.003;
    }
  });

  return (
    <group>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={count} array={colors} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial
          map={circleTex}
          size={0.008}
          vertexColors
          transparent
          opacity={0.5}
          blending={AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </group>
  );
}

function Planet({ planet, orbitColor }: { planet: PlanetData; orbitColor: string }) {
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<Mesh>(null);
  const atmosphereRef = useRef<Mesh>(null);
  const textures = useMemo(() => generatePlanetTextures(planet.surface, planet.materialSeed), [planet.id, planet.materialSeed]);
  
  useFrame((state, delta) => {
    if (groupRef.current) {
      const angle = planet.initialAngle + state.clock.elapsedTime * VISUAL_CONFIG.ANIMATION.PLANET_ORBIT;
      groupRef.current.position.set(
        Math.cos(angle) * planet.orbitRadius, 
        0, 
        Math.sin(angle) * planet.orbitRadius
      );
    }
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.075;
    }
    if (atmosphereRef.current) {
      atmosphereRef.current.rotation.y += delta * 0.1;
    }
  });
  
  return (
    <>
      <OrbitPath radius={planet.orbitRadius} color={orbitColor} />
      <group ref={groupRef}>
        {/* Main Planet Body - MeshPhysicalMaterial for photorealistic rendering */}
        <mesh ref={meshRef}>
          <sphereGeometry args={[planet.size, 128, 128]} />
          <meshPhysicalMaterial
            color={planet.type.baseColor}
            map={textures.map}
            bumpMap={textures.bumpMap}
            bumpScale={textures.bumpScale}
            roughness={planet.type.name === 'ice' ? 0.3 : 0.85}
            metalness={planet.type.name === 'ice' ? 0.1 : 0.15}
            clearcoat={planet.type.name === 'ice' ? 0.8 : 0.2}
            clearcoatRoughness={planet.type.name === 'ice' ? 0.2 : 0.6}
            ior={planet.type.name === 'ice' ? 1.31 : 1.45}
            sheen={planet.type.name === 'terrestrial' ? 0.5 : 0}
            sheenRoughness={0.8}
            sheenColor={new Color(planet.type.accent)}
            emissive={new Color(planet.type.baseColor)}
            emissiveIntensity={planet.type.name === 'volcanic' ? 0.4 : 0.15}
            transparent={false}
            depthWrite={true}
            depthTest={true}
            toneMapped={true}
          />
        </mesh>
        
        {/* Atmosphere Layer (Scale 1.03) - Cinematic Fresnel/Rim Light */}
        <mesh ref={atmosphereRef} scale={1.03}>
          <sphereGeometry args={[planet.size, 64, 64]} />
          <meshStandardMaterial
            color={planet.type.name === 'terrestrial' ? '#ffffff' : planet.type.accent}
            transparent={true}
            opacity={0.2}
            side={BackSide}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>

        {planet.type.name === 'terrestrial' && <CloudLayer planetSize={planet.size} seed={planet.materialSeed} />}
        {planet.hasRing && <PlanetRing planetSize={planet.size} />}
        {planet.moons.map((m: MoonData) => (
          <Moon key={m.id} moon={m} />
        ))}
      </group>
    </>
  );
}

function createCircleTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
  const tex = new CanvasTexture(canvas); tex.needsUpdate = true; return tex;
}

function SpaceDust({ config }: { config: SpaceDustConfig }) {
  const pointsRef = useRef<Points>(null);
  const circleTex = useMemo(() => createCircleTexture(), []);
  const { positions, colors, count } = useMemo(() => {
    const targetCount = Math.min(config.particleCount, 2500);
    const pos = new Float32Array(targetCount * 3);
    const col = new Float32Array(targetCount * 3);
    const palette = ['#ffffff', '#e0f2ff', '#bde3ff'];
    for (let i = 0; i < targetCount; i++) {
      const i3 = i * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 5 + Math.random() * config.spreadRadius * 1.5;
      pos[i3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i3 + 1] = 0; // Strictly flat disk for maximum clarity
      pos[i3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      const swatch = new Color(palette[Math.floor(Math.random() * palette.length)]);
      col[i3] = swatch.r; col[i3 + 1] = swatch.g; col[i3 + 2] = swatch.b;
    }
    return { positions: pos, colors: col, count: targetCount };
  }, [config]);

  useFrame(() => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.00002;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={count} array={colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        map={circleTex}
        size={0.03}
        vertexColors
        transparent
        opacity={0.15}
        blending={AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

function HyperjumpLines() {
  const lineRef = useRef<LineSegments>(null);
  const count = 1200;
  const { positions } = useMemo(() => {
    const pos = new Float32Array(count * 6);
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 200;
      const y = (Math.random() - 0.5) * 200;
      const z = (Math.random() - 0.5) * 600;
      pos[i * 6] = x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z;
      pos[i * 6 + 3] = x; pos[i * 6 + 4] = y; pos[i * 6 + 5] = z - 50;
    }
    return { positions: pos };
  }, []);

  useFrame(() => {
    if (lineRef.current) {
      const arr = lineRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        arr[i * 6 + 2] += 45; arr[i * 6 + 5] += 45;
        arr[i * 6 + 5] = arr[i * 6 + 2] - 120; 
        if (arr[i * 6 + 2] > 300) {
          const x = (Math.random() - 0.5) * 200; const y = (Math.random() - 0.5) * 200;
          arr[i * 6] = x; arr[i * 6 + 3] = x;
          arr[i * 6 + 1] = y; arr[i * 6 + 4] = y;
          arr[i * 6 + 2] = -300; arr[i * 6 + 5] = -420;
        }
      }
      lineRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <lineSegments ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count * 2} array={positions} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial color="#ffffff" transparent opacity={1.0} blending={AdditiveBlending} />
    </lineSegments>
  );
}

function Starfield() {
  return (
    <Stars 
      radius={300} 
      depth={60} 
      count={5000} 
      factor={8} 
      saturation={0} 
      fade 
    />
  );
}

function Nebula({ config }: { config?: NebulaConfig }) {
  const nebulaRef = useRef<Points>(null);
  const circleTex = useMemo(() => createCircleTexture(), []);
  const { positions, colors, count } = useMemo(() => {
    if (!config) return { positions: new Float32Array(0), colors: new Float32Array(0), count: 0 };
    const pointCount = 4000;
    const pos = new Float32Array(pointCount * 3);
    const col = new Float32Array(pointCount * 3);
    
    // Replace nebula colors with white/pale blue "star dust" as requested
    const palette = ['#ffffff', '#f0faff', '#d9f2ff'];
    
    for (let i = 0; i < pointCount; i++) {
      const i3 = i * 3;
      const radius = config.radius * (0.3 + Math.random() * 0.7);
      const angle = Math.random() * Math.PI * 2;
      const height = 0; // Strictly flat disk
      pos[i3] = Math.cos(angle) * radius;
      pos[i3 + 1] = height;
      pos[i3 + 2] = Math.sin(angle) * radius;

      const swatch = new Color(palette[Math.floor(Math.random() * palette.length)]);
      col[i3] = swatch.r;
      col[i3 + 1] = swatch.g;
      col[i3 + 2] = swatch.b;
    }
    return { positions: pos, colors: col, count: pointCount };
  }, [config]);

  useFrame(() => {
    if (nebulaRef.current) {
      nebulaRef.current.rotation.y += 0.0001;
    }
  });

  if (!config || count === 0) return null;

  return (
    <points ref={nebulaRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={count} array={colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        map={circleTex}
        size={0.04}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.2}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

function SolarSystemScene({ traits, walletAddress, isWarping }: SolarSystemProps) {
  const systemData = useMemo(() => traits ? generateSolarSystem(traits, walletAddress) : null, [traits, walletAddress]);
  const [bloomFlash, setBloomFlash] = useState(0);
  const hasTraits = !!traits;

  useEffect(() => {
    if (isWarping) {
      const timer = setTimeout(() => setBloomFlash(1), 1850);
      return () => { clearTimeout(timer); setBloomFlash(0); };
    }
  }, [isWarping]);

  return (
    <>
      <CinematicCamera isWarping={isWarping} hasTraits={hasTraits} />
      <ambientLight intensity={0.05} />
      <Starfield isWarping={isWarping} />
      
      {isWarping ? <HyperjumpLines /> : systemData && (
        <>
          <Nebula config={systemData.nebula} />
          <SeekerSun profile={systemData.stellarProfile} walletSeed={walletAddress} />
          {systemData.planets.map((p: PlanetData) => <Planet key={p.id} planet={p} orbitColor={systemData.orbitColor} />)}
          <SpaceDust config={systemData.spaceDust} />
          <OrbitControls makeDefault enablePan={false} enableZoom={true} minDistance={8} maxDistance={120} dampingFactor={0.05} enableDamping />
        </>
      )}

      <EffectComposer multisampling={0}>
        <Bloom 
          intensity={2.0} 
          radius={0.5}
          luminanceThreshold={0.85} 
          luminanceSmoothing={0.9} 
          mipmapBlur 
        />
        <ChromaticAberration 
          offset={new Vector2(0.0005, 0.0005)} 
          radialModulation 
          modulationOffset={0.9} 
        />
        <Vignette darkness={0.6} offset={0.25} />
        <Noise opacity={0.018} blendFunction={BlendFunction.SOFT_LIGHT} />
      </EffectComposer>
    </>
  );
}

export function SolarSystem({ traits, walletAddress, isWarping }: SolarSystemProps) {
  const isConnected = walletAddress && walletAddress !== '0xDemo...Wallet';
  return (
    <div className="w-full h-full absolute inset-0 bg-black">
      <Canvas camera={{ position: [0, 0, 150], fov: 60, far: 2000 }} gl={{ antialias: true, toneMapping: ACESFilmicToneMapping }}>
        <Suspense fallback={null}>
          <SolarSystemScene traits={traits} walletAddress={walletAddress} isWarping={isWarping} />
          {!isConnected && !traits && !isWarping && (
            <>
              <ambientLight intensity={0.01} />
              <Starfield />
              <OrbitControls />
            </>
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}
