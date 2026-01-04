import { useRef, useMemo, Suspense, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration, Vignette, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { SeekerSun } from './SeekerSun';
import {
  generateSolarSystem,
  type PlanetData,
  type MoonData,
  type SpaceDustConfig,
  type NebulaConfig,
} from '@/lib/solarSystemGenerator';
import { VISUAL_CONFIG } from '@/constants';
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

function createCanvasTexture(seed: number, draw: (ctx: CanvasRenderingContext2D, rand: () => number) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = PLANET_TEXTURE_SIZE;
  canvas.height = PLANET_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  const rand = createSeededRandom(seed);
  draw(ctx, rand);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function generatePlanetTextures(planet: PlanetData) {
  const { type, surface, materialSeed } = planet;
  const baseColor = type.baseColor;
  const accent = type.accent;

  const basicTexture = () =>
    createCanvasTexture(materialSeed, (ctx) => {
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = accent;
      for (let i = 0; i < 80; i++) {
        const radius = 10 + Math.random() * 25;
        ctx.beginPath();
        ctx.arc(Math.random() * ctx.canvas.width, Math.random() * ctx.canvas.height, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });

  const oceanicTexture = () =>
    createCanvasTexture(materialSeed, (ctx, rand) => {
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = accent;
      for (let i = 0; i < 30; i++) {
        const x = rand() * ctx.canvas.width;
        const y = rand() * ctx.canvas.height;
        const w = 80 + rand() * 120;
        const h = 30 + rand() * 60;
        ctx.beginPath();
        ctx.ellipse(x, y, w, h, rand() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });

  const crateredTexture = () =>
    createCanvasTexture(materialSeed, (ctx, rand) => {
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      for (let i = 0; i < 120; i++) {
        const radius = 5 + rand() * 25;
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        const darker = new THREE.Color(baseColor).multiplyScalar(0.5).getStyle();
        gradient.addColorStop(0, accent);
        gradient.addColorStop(1, darker);
        ctx.save();
        ctx.translate(rand() * ctx.canvas.width, rand() * ctx.canvas.height);
        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });

  const gasTexture = () =>
    createCanvasTexture(materialSeed, (ctx, rand) => {
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      const stripeCount = 12;
      for (let i = 0; i < stripeCount; i++) {
        const y = (i / stripeCount) * ctx.canvas.height;
        const gradient = ctx.createLinearGradient(0, y, ctx.canvas.width, y + rand() * 30);
        gradient.addColorStop(0, accent);
        gradient.addColorStop(1, baseColor);
        ctx.fillStyle = gradient;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(0, y, ctx.canvas.width, ctx.canvas.height / stripeCount + rand() * 10);
      }
      ctx.globalAlpha = 1;
    });

  switch (surface) {
    case 'oceanic':
      return { map: oceanicTexture(), bumpScale: 0.02 };
    case 'cratered': {
      const texture = crateredTexture();
      return { map: texture, bumpMap: texture, bumpScale: 0.06 };
    }
    case 'gas':
      return { map: gasTexture(), bumpScale: 0 };
    default:
      return { map: basicTexture(), bumpScale: 0.02 };
  }
}

interface SolarSystemProps {
  traits: WalletTraits | null;
  walletAddress?: string;
  isWarping?: boolean;
}

function CinematicCamera({ isWarping }: { isWarping?: boolean }) {
  const { camera, size, controls } = useThree();
  const targetPos = useRef(new THREE.Vector3(0, 15, 30));
  const targetFov = useRef(60);
  const shakeRef = useRef(new THREE.Vector3());
  const [isTransitioning, setIsTransitioning] = useState(false);
  const userInteracted = useRef(false);
  
  useEffect(() => {
    const isMobile = size.width / size.height < 1;
    setIsTransitioning(true);
    userInteracted.current = false;
    
    if (isWarping) {
      camera.position.set(0, 0, 250);
      targetPos.current.set(0, 0, 40);
      targetFov.current = 160;
    } else if (isMobile) {
      targetPos.current.set(0, 35, 45);
      targetFov.current = 85;
    } else {
      targetPos.current.set(0, 15, 30);
      targetFov.current = 60;
    }
    
    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [size, isWarping, camera]);

  // Listen for user interaction on controls
  useEffect(() => {
    if (!controls) return;
    const onStart = () => {
      userInteracted.current = true;
      setIsTransitioning(false);
    };
    (controls as any).addEventListener('start', onStart);
    return () => (controls as any).removeEventListener('start', onStart);
  }, [controls]);

  useFrame(() => {
    if (isWarping) {
      const intensity = 0.8;
      shakeRef.current.set(
        (Math.random() - 0.5) * intensity,
        (Math.random() - 0.5) * intensity,
        0
      );
    } else {
      shakeRef.current.lerp(new THREE.Vector3(), 0.1);
    }

    // Only force camera position during transition and if user hasn't interacted
    if ((isWarping || isTransitioning) && !userInteracted.current) {
      camera.position.lerp(targetPos.current, isWarping ? 0.06 : 0.05);
      camera.position.add(shakeRef.current);
      
      const pCam = camera as THREE.PerspectiveCamera;
      pCam.fov = THREE.MathUtils.lerp(pCam.fov, targetFov.current, 0.05);
      pCam.updateProjectionMatrix();
    }
  });
  
  return null;
}

function OrbitPath({ radius, color }: { radius: number; color: string }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.02, radius + 0.02, 128]} />
      <meshBasicMaterial color={color} transparent opacity={0.05} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function Moon({ moon, planetPosition }: { moon: MoonData; planetPosition: THREE.Vector3 }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) {
      const angle = moon.initialAngle + state.clock.elapsedTime * moon.orbitSpeed;
      ref.current.position.x = planetPosition.x + Math.cos(angle) * moon.orbitRadius;
      ref.current.position.y = planetPosition.y + Math.sin(angle * 0.5) * 0.1;
      ref.current.position.z = planetPosition.z + Math.sin(angle) * moon.orbitRadius;
    }
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[moon.size, 24, 24]} />
      <meshStandardMaterial color={moon.color} roughness={0.8} metalness={0.1} />
    </mesh>
  );
}

function PlanetRing({ planetSize }: { planetSize: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const { positions, colors, count } = useMemo(() => {
    const particleCount = 4000;
    const pos = new Float32Array(particleCount * 3);
    const col = new Float32Array(particleCount * 3);
    const innerRadius = planetSize * 1.6;
    const outerRadius = planetSize * 2.4;

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const angle = Math.random() * Math.PI * 2;
      const radius = innerRadius + Math.random() * (outerRadius - innerRadius);
      const height = (Math.random() - 0.5) * planetSize * 0.02;

      pos[i3] = Math.cos(angle) * radius;
      pos[i3 + 1] = height;
      pos[i3 + 2] = Math.sin(angle) * radius;

      const tint = 0.8 + Math.random() * 0.2;
      col[i3] = 0.85 * tint;
      col[i3 + 1] = 0.95 * tint;
      col[i3 + 2] = 1.0;
    }

    return { positions: pos, colors: col, count: particleCount };
  }, [planetSize]);

  useFrame(() => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.00008;
    }
  });

  return (
    <group rotation={[Math.PI / 2.3, 0, 0]}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={count} array={colors} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial
          size={0.012}
          vertexColors
          transparent
          opacity={0.45}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  );
}

function Planet({ planet, orbitColor }: { planet: PlanetData; orbitColor: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const positionRef = useRef(new THREE.Vector3());
  const textures = useMemo(() => generatePlanetTextures(planet), [planet]);
  
  useFrame((state) => {
    if (groupRef.current) {
      const angle = planet.initialAngle + state.clock.elapsedTime * planet.orbitSpeed;
      groupRef.current.position.set(Math.cos(angle) * planet.orbitRadius, 0, Math.sin(angle) * planet.orbitRadius);
      positionRef.current.copy(groupRef.current.position);
    }
    if (meshRef.current) meshRef.current.rotation.y += planet.rotationSpeed;
  });
  
  return (
    <>
      <OrbitPath radius={planet.orbitRadius} color={orbitColor} />
      <group ref={groupRef}>
        <mesh ref={meshRef}>
          <sphereGeometry args={[planet.size, 64, 64]} />
          <meshStandardMaterial
            color={planet.type.baseColor}
            roughness={planet.type.roughness}
            metalness={planet.type.metalness}
            map={textures.map}
            bumpMap={textures.bumpMap}
            bumpScale={textures.bumpScale}
          />
        </mesh>
        {planet.hasRing && <PlanetRing planetSize={planet.size} />}
        {planet.moons.map((m: any) => <Moon key={m.id} moon={m} planetPosition={positionRef.current} />)}
      </group>
    </>
  );
}

function createCircleTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas); tex.needsUpdate = true; return tex;
}

function SpaceDust({ config }: { config: SpaceDustConfig }) {
  const pointsRef = useRef<THREE.Points>(null);
  const circleTex = useMemo(() => createCircleTexture(), []);
  const { positions, colors, count } = useMemo(() => {
    const targetCount = Math.min(config.particleCount, 1800);
    const pos = new Float32Array(targetCount * 3);
    const col = new Float32Array(targetCount * 3);
    const palette = ['#f8fbff', '#c9e7ff', '#a5d2ff', '#ffffff'];
    for (let i = 0; i < targetCount; i++) {
      const i3 = i * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 8 + Math.random() * config.spreadRadius;
      pos[i3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i3 + 1] = (Math.random() - 0.5) * config.spreadRadius * 0.2;
      pos[i3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      const swatch = new THREE.Color(palette[Math.floor(Math.random() * palette.length)]);
      col[i3] = swatch.r; col[i3 + 1] = swatch.g; col[i3 + 2] = swatch.b;
    }
    return { positions: pos, colors: col, count: targetCount };
  }, [config]);

  useFrame(() => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.00005;
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
        size={0.07}
        vertexColors
        transparent
        opacity={0.25}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

function HyperjumpLines() {
  const lineRef = useRef<THREE.LineSegments>(null);
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
      <lineBasicMaterial color="#ffffff" transparent opacity={1.0} blending={THREE.AdditiveBlending} />
    </lineSegments>
  );
}

function Starfield({ isWarping }: { isWarping?: boolean }) {
  return (
    <Stars
      radius={isWarping ? 50 : 350} depth={isWarping ? 5 : 80} count={isWarping ? 6000 : 15000}
      factor={isWarping ? 0.1 : 6} saturation={0} fade={!isWarping} speed={isWarping ? 50 : 0.2}
    />
  );
}

function Nebula({ config }: { config?: NebulaConfig }) {
  const nebulaRef = useRef<THREE.Points>(null);
  const { positions, colors, count } = useMemo(() => {
    if (!config) return { positions: new Float32Array(0), colors: new Float32Array(0), count: 0 };
    const pointCount = 4000;
    const pos = new Float32Array(pointCount * 3);
    const col = new Float32Array(pointCount * 3);
    for (let i = 0; i < pointCount; i++) {
      const i3 = i * 3;
      const radius = config.radius * (0.3 + Math.random() * 0.7);
      const angle = Math.random() * Math.PI * 2;
      const height = (Math.random() - 0.5) * config.radius * 0.3;
      pos[i3] = Math.cos(angle) * radius;
      pos[i3 + 1] = height;
      pos[i3 + 2] = Math.sin(angle) * radius;

      const color = new THREE.Color(config.colors[i % config.colors.length]);
      col[i3] = color.r;
      col[i3 + 1] = color.g;
      col[i3 + 2] = color.b;
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
        size={0.4}
        sizeAttenuation
        vertexColors
        transparent
        opacity={config.intensity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function SolarSystemScene({ traits, walletAddress, isWarping }: SolarSystemProps) {
  const systemData = useMemo(() => traits ? generateSolarSystem(traits, walletAddress) : null, [traits, walletAddress]);
  const [bloomFlash, setBloomFlash] = useState(0);

  useEffect(() => {
    if (isWarping) {
      const timer = setTimeout(() => setBloomFlash(1), 1850);
      return () => { clearTimeout(timer); setBloomFlash(0); };
    }
  }, [isWarping]);

  return (
    <>
      <CinematicCamera isWarping={isWarping} />
      <ambientLight intensity={0.05} />
      <Starfield isWarping={isWarping} />
      
      {isWarping ? <HyperjumpLines /> : systemData && (
        <>
          <Nebula config={systemData.nebula} />
          <SeekerSun profile={systemData.stellarProfile} walletSeed={walletAddress} />
          {systemData.planets.map((p: any) => <Planet key={p.id} planet={p} orbitColor={systemData.orbitColor} />)}
          <SpaceDust config={systemData.spaceDust} />
          <OrbitControls makeDefault enablePan={false} enableZoom={true} minDistance={8} maxDistance={120} dampingFactor={0.05} enableDamping />
        </>
      )}

      <EffectComposer multisampling={0}>
        <Bloom intensity={(isWarping ? 2.0 : 0.35) + bloomFlash * 3} luminanceThreshold={0.92} luminanceSmoothing={0.97} mipmapBlur />
        <ChromaticAberration offset={new THREE.Vector2(0.0005, 0.0005)} radialModulation modulationOffset={0.9} />
        <Vignette darkness={0.5} offset={0.3} />
        <Noise opacity={0.015} blendFunction={BlendFunction.SOFT_LIGHT} />
      </EffectComposer>
    </>
  );
}

export function SolarSystem({ traits, walletAddress, isWarping }: SolarSystemProps) {
  const isConnected = walletAddress && walletAddress !== '0xDemo...Wallet';
  return (
    <div className="w-full h-full absolute inset-0 bg-black">
      <Canvas camera={{ position: [0, 0, 150], fov: 60, far: 2000 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
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
