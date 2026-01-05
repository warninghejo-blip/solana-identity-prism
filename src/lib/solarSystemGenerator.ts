import { 
  Texture, 
  CanvasTexture, 
  ClampToEdgeWrapping 
} from 'three';
import { VISUAL_CONFIG, PLANET_TYPES } from '@/constants';
import type { WalletTraits, RarityTier } from '@/hooks/useWalletData';
import { calculateScore } from '@/hooks/useWalletData';

type PlanetSurface = 'terrestrial' | 'volcanic' | 'gas' | 'ice';

export interface PlanetData {
  id: string;
  size: number;
  orbitRadius: number;
  orbitSpeed: number;
  rotationSpeed: number;
  type: typeof PLANET_TYPES[number];
  initialAngle: number;
  moons: MoonData[];
  hasRing: boolean;
  geometry: 'sphere' | 'oblate' | 'crystalline';
  materialSeed: number;
  surface: PlanetSurface;
}

export interface MoonData {
  id: string;
  size: number;
  orbitRadius: number;
  orbitSpeed: number;
  initialAngle: number;
  color: string;
  inclination: number;
}

export interface SpaceDustConfig {
  particleCount: number;
  spreadRadius: number;
  colors: string[];
}

export interface StellarProfile {
  mode: 'single' | 'binary' | 'binaryPulsar';
  sunType: 'basic' | 'seeker' | 'preorder' | 'combo' | 'mythic';
  palette: {
    primary: string;
    secondary: string;
  };
  intensity: number;
  plasmaBridge: boolean;
  novaBridge: boolean;
}

export interface NebulaConfig {
  colors: string[];
  intensity: number;
  radius: number;
}

export interface SolarSystemData {
  planets: PlanetData[];
  spaceDust: SpaceDustConfig;
  starfieldDensity: number;
  stellarProfile: StellarProfile;
  orbitColor: string;
  nebula?: NebulaConfig;
  rarityTier: RarityTier;
}

function hashWalletAddress(address: string): number {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    const char = address.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

interface RarityVisualConfig {
  planetRange: [number, number];
  starMode: StellarProfile['mode'];
  palette: { primary: string; secondary: string };
  ensureRings: boolean;
  ensureMoons: boolean;
  orbitColor: string;
  plasmaBridge?: boolean;
  nebula?: boolean;
}

const RARITY_VISUALS: Record<RarityTier, RarityVisualConfig> = {
  common: {
    planetRange: [1, 3],
    starMode: 'single',
    palette: { primary: VISUAL_CONFIG.SUN.DEFAULT_COLOR, secondary: '#FF9D57' },
    ensureRings: false,
    ensureMoons: false,
    orbitColor: VISUAL_CONFIG.ORBITS.DEFAULT,
  },
  rare: {
    planetRange: [4, 5],
    starMode: 'single',
    palette: { primary: VISUAL_CONFIG.SUN.RARE_COLOR, secondary: VISUAL_CONFIG.SUN.RARE_ACCENT },
    ensureRings: true,
    ensureMoons: false,
    orbitColor: VISUAL_CONFIG.ORBITS.DEFAULT,
  },
  epic: {
    planetRange: [5, 6],
    starMode: 'single',
    palette: { primary: VISUAL_CONFIG.SUN.EPIC_COLOR, secondary: VISUAL_CONFIG.SUN.EPIC_ACCENT },
    ensureRings: true,
    ensureMoons: true,
    orbitColor: VISUAL_CONFIG.ORBITS.DEFAULT,
  },
  legendary: {
    planetRange: [6, 8],
    starMode: 'binary',
    palette: { primary: VISUAL_CONFIG.SUN.LEGENDARY_COLOR, secondary: VISUAL_CONFIG.SUN.RARE_COLOR },
    ensureRings: true,
    ensureMoons: true,
    orbitColor: VISUAL_CONFIG.ORBITS.GOLDEN,
    plasmaBridge: false,
  },
  mythic: {
    planetRange: [8, 10],
    starMode: 'binaryPulsar',
    palette: { primary: VISUAL_CONFIG.SUN.MYTHIC_PRIMARY, secondary: VISUAL_CONFIG.SUN.MYTHIC_SECONDARY },
    ensureRings: true,
    ensureMoons: true,
    orbitColor: VISUAL_CONFIG.ORBITS.GOLDEN,
    plasmaBridge: true,
    nebula: true,
  },
};

const DUST_MULTIPLIER: Record<RarityTier, number> = {
  common: 1,
  rare: 1.2,
  epic: 1.35,
  legendary: 1.5,
  mythic: 1.8,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// ============================================================================
// PROCEDURAL TEXTURE GENERATION - Simplex Noise & FBM
// ============================================================================

function simplexNoise(x: number, y: number, seed: number): number {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const hash = ((X * 374761393 + Y * 668265263 + seed) ^ (seed >> 13)) & 0xFFFFFFFF;
  return ((hash * (hash * hash * 15731 + 789221) + 1376312589) & 0x7FFFFFFF) / 0x7FFFFFFF * 2 - 1;
}

function fbm(x: number, y: number, seed: number, octaves: number): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;
  for (let i = 0; i < octaves; i++) {
    value += simplexNoise(x * frequency, y * frequency, seed + i) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / maxValue;
}

function createCanvasTexture(seed: number, drawFn: (ctx: CanvasRenderingContext2D, rand: () => number) => void): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const random = seededRandom(seed);
  drawFn(ctx, random);
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
  return texture;
}

// Generate terrestrial planet texture: oceans, continents, polar ice caps
export function generateTerrestrialTexture(seed: number): { map: Texture; bumpMap: Texture; bumpScale: number } {
  const texture = createCanvasTexture(seed, (ctx) => {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const nx = x / width;
        const ny = y / height;
        
        const elevation = fbm(nx * 4, ny * 4, seed, 6) * 0.5 + 0.5;
        const detail = fbm(nx * 16, ny * 16, seed + 100, 4) * 0.5 + 0.5;
        const microDetail = fbm(nx * 32, ny * 32, seed + 200, 3) * 0.5 + 0.5;
        
        const landMask = elevation * 0.6 + detail * 0.3 + microDetail * 0.1;
        
        if (landMask > 0.5) {
          const landType = detail;
          if (landType > 0.6) {
            // Forest
            data[idx] = 45 + microDetail * 30;
            data[idx + 1] = 90 + microDetail * 40;
            data[idx + 2] = 39 + microDetail * 20;
          } else if (landType > 0.4) {
            // Plains
            data[idx] = 90 + microDetail * 50;
            data[idx + 1] = 110 + microDetail * 40;
            data[idx + 2] = 60 + microDetail * 30;
          } else {
            // Desert/Mountains
            data[idx] = 139 + microDetail * 40;
            data[idx + 1] = 119 + microDetail * 30;
            data[idx + 2] = 101 + microDetail * 20;
          }
        } else {
          // Ocean
          const depth = (0.5 - landMask) * 2;
          data[idx] = 5 + depth * 20;
          data[idx + 1] = 44 + depth * 40;
          data[idx + 2] = 84 + depth * 60 + microDetail * 20;
        }
        
        // Polar ice caps
        if (ny < 0.1 || ny > 0.9) {
          const iceFactor = ny < 0.1 ? (0.1 - ny) * 10 : (ny - 0.9) * 10;
          data[idx] = data[idx] * (1 - iceFactor) + 255 * iceFactor;
          data[idx + 1] = data[idx + 1] * (1 - iceFactor) + 255 * iceFactor;
          data[idx + 2] = data[idx + 2] * (1 - iceFactor) + 255 * iceFactor;
        }
        
        data[idx + 3] = 255;
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  });
  
  return { map: texture, bumpMap: texture, bumpScale: 0.05 };
}

// Generate volcanic/dead world texture: craters, lava flows, rocky surface
export function generateVolcanicTexture(seed: number): { map: Texture; bumpMap: Texture; bumpScale: number } {
  const texture = createCanvasTexture(seed, (ctx) => {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const nx = x / width;
        const ny = y / height;
        
        const craters = fbm(nx * 8, ny * 8, seed, 5) * 0.5 + 0.5;
        const roughness = fbm(nx * 24, ny * 24, seed + 50, 4) * 0.5 + 0.5;
        const lavaFlow = fbm(nx * 6, ny * 6, seed + 150, 3) * 0.5 + 0.5;
        
        let r = 45, g = 10, b = 0;
        
        if (craters < 0.3) {
          const craterDepth = (0.3 - craters) * 3;
          r *= (1 - craterDepth * 0.5);
          g *= (1 - craterDepth * 0.5);
          b *= (1 - craterDepth * 0.5);
        }
        
        if (roughness > 0.6) {
          const dustAmount = (roughness - 0.6) * 2.5;
          r += dustAmount * 80;
          g += dustAmount * 35;
          b += dustAmount * 15;
        }
        
        if (lavaFlow > 0.75) {
          const lavaIntensity = (lavaFlow - 0.75) * 4;
          r = Math.min(255, r + lavaIntensity * 200);
          g = Math.min(255, g + lavaIntensity * 100);
          b = Math.min(255, b + lavaIntensity * 50);
        }
        
        data[idx] = Math.min(255, r + roughness * 20);
        data[idx + 1] = Math.min(255, g + roughness * 10);
        data[idx + 2] = Math.min(255, b + roughness * 5);
        data[idx + 3] = 255;
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  });
  
  return { map: texture, bumpMap: texture, bumpScale: 0.1 };
}

// Generate ice world texture: glacial crevasses, frost, crystalline structure
export function generateIceTexture(seed: number): { map: Texture; bumpMap: Texture; bumpScale: number } {
  const texture = createCanvasTexture(seed, (ctx) => {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const nx = x / width;
        const ny = y / height;
        
        const iceNoise = fbm(nx * 12, ny * 12, seed, 5) * 0.5 + 0.5;
        const cracks = fbm(nx * 20, ny * 20, seed + 100, 4) * 0.5 + 0.5;
        const frost = fbm(nx * 32, ny * 32, seed + 200, 3) * 0.5 + 0.5;
        
        let r = 186, g = 230, b = 253;
        
        if (cracks < 0.35) {
          const crackDepth = (0.35 - cracks) * 2.85;
          r = Math.max(100, r - crackDepth * 100);
          g = Math.max(150, g - crackDepth * 100);
          b = Math.max(200, b - crackDepth * 80);
        }
        
        if (frost > 0.65) {
          const snowAmount = (frost - 0.65) * 2.85;
          r = r + (255 - r) * snowAmount;
          g = g + (255 - g) * snowAmount;
          b = b + (255 - b) * snowAmount;
        }
        
        const crystalVariation = iceNoise * 30;
        data[idx] = Math.min(255, r + crystalVariation);
        data[idx + 1] = Math.min(255, g + crystalVariation);
        data[idx + 2] = Math.min(255, b + crystalVariation);
        data[idx + 3] = 255;
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  });
  
  return { map: texture, bumpMap: texture, bumpScale: 0.06 };
}

// Generate gas giant texture: horizontal atmospheric bands with turbulence
export function generateGasGiantTexture(seed: number): { map: Texture; bumpScale: number } {
  const texture = createCanvasTexture(seed, (ctx) => {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const nx = x / width;
        const ny = y / height;
        
        const bandNoise = fbm(nx * 2, ny * 12, seed, 4);
        const turbulence = fbm(nx * 8, ny * 8, seed + 100, 3) * 0.1;
        const distortedY = ny + turbulence;
        
        const bandValue = Math.sin(distortedY * 20 + bandNoise * 2) * 0.5 + 0.5;
        const microTurbulence = fbm(nx * 16, ny * 16, seed + 200, 2) * 0.5 + 0.5;
        
        let r, g, b;
        if (bandValue > 0.5) {
          r = 245 * (0.8 + microTurbulence * 0.2);
          g = 158 * (0.8 + microTurbulence * 0.2);
          b = 11 * (0.8 + microTurbulence * 0.2);
        } else {
          r = 124 * (0.7 + microTurbulence * 0.3);
          g = 45 * (0.7 + microTurbulence * 0.3);
          b = 18 * (0.7 + microTurbulence * 0.3);
        }
        
        const stormNoise = fbm(nx * 4, ny * 4, seed + 300, 3);
        if (stormNoise > 0.7) {
          const stormIntensity = (stormNoise - 0.7) * 3.3;
          r = Math.min(255, r + stormIntensity * 100);
          g = Math.min(255, g + stormIntensity * 80);
          b = Math.min(255, b + stormIntensity * 60);
        }
        
        data[idx] = Math.min(255, r);
        data[idx + 1] = Math.min(255, g);
        data[idx + 2] = Math.min(255, b);
        data[idx + 3] = 255;
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  });
  
  return { map: texture, bumpScale: 0.02 };
}

// Generate cloud layer texture for terrestrial planets
export function generateCloudTexture(seed: number): Texture {
  const texture = createCanvasTexture(seed, (ctx) => {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const nx = x / width;
        const ny = y / height;
        
        const clouds = fbm(nx * 6, ny * 6, seed, 5) * 0.5 + 0.5;
        const wispy = fbm(nx * 12, ny * 12, seed + 100, 4) * 0.5 + 0.5;
        
        const cloudDensity = (clouds * 0.7 + wispy * 0.3);
        const alpha = cloudDensity > 0.4 ? (cloudDensity - 0.4) * 1.67 : 0;
        
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
        data[idx + 3] = Math.min(255, alpha * 200);
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  });
  
  return texture;
}

// Generate crater texture for moons
export function generateMoonTexture(seed: number): Texture {
  const texture = createCanvasTexture(seed, (ctx) => {
    const width = 128;
    const height = 128;
    ctx.canvas.width = width;
    ctx.canvas.height = height;
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const nx = x / width;
        const ny = y / height;
        
        const craters = fbm(nx * 10, ny * 10, seed, 5) * 0.5 + 0.5;
        const detail = fbm(nx * 20, ny * 20, seed + 50, 4) * 0.5 + 0.5;
        
        let gray = 100 + detail * 50;
        
        if (craters < 0.35) {
          const depth = (0.35 - craters) * 2.5;
          gray = Math.max(40, gray - depth * 80);
        }
        
        data[idx] = gray;
        data[idx + 1] = gray;
        data[idx + 2] = gray;
        data[idx + 3] = 255;
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  });
  
  return texture;
}

// Main texture generator based on planet surface type
export function generatePlanetTextures(surface: PlanetSurface, materialSeed: number): { map: Texture; bumpMap?: Texture; bumpScale: number } {
  switch (surface) {
    case 'terrestrial':
      return generateTerrestrialTexture(materialSeed);
    case 'volcanic':
      return generateVolcanicTexture(materialSeed);
    case 'ice':
      return generateIceTexture(materialSeed);
    case 'gas':
      return generateGasGiantTexture(materialSeed);
    default:
      return generateTerrestrialTexture(materialSeed);
  }
}

export function generateSolarSystem(traits: WalletTraits, walletAddress?: string): SolarSystemData {
  const rarityConfig = RARITY_VISUALS[traits.rarityTier];
  const addressSeed = walletAddress ? hashWalletAddress(walletAddress) : 0;
  const random = seededRandom(addressSeed + traits.uniqueTokenCount + traits.nftCount);
  
  // Calculate current score for binary activation
  const currentScore = calculateScore(traits);

  // 1. Determine Sun Visuals from Traits
  let starMode = rarityConfig.starMode;
  let palette = { ...rarityConfig.palette };
  let plasmaBridge = Boolean(rarityConfig.plasmaBridge);
  let sunType: StellarProfile['sunType'] = 'basic';

  if (traits.hasCombo) {
    sunType = 'combo';
    palette = { primary: VISUAL_CONFIG.SUN.SEEKER_COLOR, secondary: VISUAL_CONFIG.SUN.PREORDER_COLOR };
    plasmaBridge = true;
    if (starMode === 'single') starMode = 'binary';
  } else if (traits.hasSeeker) {
    sunType = 'seeker';
    palette = { primary: VISUAL_CONFIG.SUN.SEEKER_COLOR, secondary: '#007C99' };
  } else if (traits.hasPreorder) {
    sunType = 'preorder';
    palette = { primary: VISUAL_CONFIG.SUN.PREORDER_COLOR, secondary: '#FFB347' };
  }
  
  // CRITICAL: Binary System activation at score > 650
  if (currentScore > 650 && starMode === 'single') {
    starMode = 'binary';
    plasmaBridge = true;
    console.log(`%c[Binary Star Activated] Score: ${currentScore} > 650`, "color: #a855f7; font-weight: bold;");
  }

  // Mythic tier transforms the system into a Pulsar regardless of specific holder traits,
  // but keeps combo colors if applicable
  if (traits.rarityTier === 'mythic') {
    starMode = 'binaryPulsar';
    if (sunType !== 'combo') {
      palette = rarityConfig.palette;
    }
    sunType = 'mythic';
    plasmaBridge = true;
  }

  const stellarProfile: StellarProfile = {
    mode: starMode,
    sunType,
    palette,
    intensity: traits.rarityTier === 'mythic' ? 5 : 4,
    plasmaBridge,
    novaBridge: sunType === 'combo' || traits.rarityTier === 'mythic',
  };

  // 2. Planet Generation
  const planetCount = clamp(
    Math.max(rarityConfig.planetRange[0], Math.floor(traits.uniqueTokenCount / 10)),
    rarityConfig.planetRange[0],
    10
  );

  const minOrbitRadius = stellarProfile.mode === 'single' ? 6 : 10;
  const planets: PlanetData[] = [];
  let largestPlanetIndex = 0;
  let largestSize = 0;

  for (let i = 0; i < planetCount; i++) {
    const isMemePlanet = traits.isMemeLord && random() > 0.4;
    const isDeFiPlanet = traits.isDeFiKing && random() > 0.4;
    const isHighActivity = traits.txCount > 500 || currentScore > 600;

    let type;
    if (isHighActivity && random() > 0.4) {
      type = PLANET_TYPES.find(p => p.name === 'terrestrial') || PLANET_TYPES[0];
    } else if (isMemePlanet) {
      type = PLANET_TYPES.find(p => p.name === 'volcanic') || PLANET_TYPES[1];
    } else if (isDeFiPlanet) {
      type = PLANET_TYPES.find(p => p.name === 'ice') || PLANET_TYPES[3];
    } else {
      // Non-active/lower score wallets get Gas Giants or Volcanic worlds more often
      type = random() > 0.5 ? PLANET_TYPES[2] : PLANET_TYPES[1]; 
    }

    const size = 0.3 + random() * 0.5;
    if (size > largestSize) { largestSize = size; largestPlanetIndex = i; }

    const orbitRadius = minOrbitRadius + i * 2.5 + random() * 0.7;
    const orbitSpeed = (0.0004 / (1 + i * 0.25)) / 2.5;

    // Moon logic: only the first two planets get moons, and their starting angles must be offset by 180 degrees.
    const moons: MoonData[] = [];
    if (i < 2 && traits.nftCount >= 50) {
      const moonCount = Math.min(Math.floor(traits.nftCount / 50), 2);
      const baseAngle = random() * Math.PI * 2;
      for (let j = 0; j < moonCount; j++) {
        moons.push({
          id: `moon-${i}-${j}`,
          size: 0.05 + random() * 0.1,
          orbitRadius: 0.8 + j * 0.4 + random() * 0.2,
          orbitSpeed: (0.0008 * (0.8 + random() * 0.4)) / 2,
          initialAngle: j === 0 ? baseAngle : (baseAngle + Math.PI), // Perfectly opposite
          color: `hsl(${random() * 360}, 20%, 60%)`,
          inclination: (random() - 0.5) * 0.4, // Different orbital planes
        });
      }
    }

    planets.push({
      id: `planet-${i}`,
      size,
      orbitRadius,
      orbitSpeed,
      rotationSpeed: 0.0006 * (0.5 + random()),
      type,
      initialAngle: random() * Math.PI * 2,
      moons,
      hasRing: false,
      geometry: random() > 0.8 ? 'oblate' : 'sphere',
      materialSeed: Math.floor(random() * 10000),
      surface: type.surface as PlanetSurface,
    });
  }

  // Spec: Blue Chip NFT -> rings
  if ((traits.isBlueChip || rarityConfig.ensureRings) && planets.length > 0) {
    planets[largestPlanetIndex].hasRing = true;
  }

  const dustParticleCount = Math.min(
    Math.floor((150 + Math.floor(traits.txCount / 100) * 8) * DUST_MULTIPLIER[traits.rarityTier]),
    3000
  );

  const spreadRadius = 50 + planetCount * 6 + (stellarProfile.mode !== 'single' ? 10 : 0);

  return {
    planets,
    spaceDust: {
      particleCount: dustParticleCount,
      spreadRadius,
      colors: [palette.primary, palette.secondary, '#ffffff'],
    },
    starfieldDensity: 0.1 + (DUST_MULTIPLIER[traits.rarityTier] * 0.2),
    stellarProfile,
    orbitColor: rarityConfig.orbitColor,
    rarityTier: traits.rarityTier,
    nebula: rarityConfig.nebula ? { colors: ['#2b1055', '#7a00ff', '#ff8e53'], intensity: 0.65, radius: spreadRadius * 1.2 } : undefined,
  };
}
