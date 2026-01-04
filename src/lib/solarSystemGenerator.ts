import { VISUAL_CONFIG, PLANET_TYPES } from '@/constants';
import type { WalletTraits, RarityTier } from '@/hooks/useWalletData';
import { calculateScore } from '@/hooks/useWalletData';

type PlanetSurface = 'basic' | 'oceanic' | 'cratered' | 'gas';

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
    // Spec: Meme Lord -> bright/acid, DeFi -> crystalline/icy
    const isMemePlanet = traits.isMemeLord && random() > 0.4;
    const isDeFiPlanet = traits.isDeFiKing && random() > 0.4;

    let type;
    if (isMemePlanet) {
      type = PLANET_TYPES.find(p => p.name === 'toxic') || PLANET_TYPES[6];
    } else if (isDeFiPlanet) {
      type = PLANET_TYPES.find(p => p.name === 'crystal' || p.name === 'icy') || PLANET_TYPES[1];
    } else {
      type = PLANET_TYPES[Math.floor(random() * PLANET_TYPES.length)];
    }

    const size = 0.3 + random() * 0.5;
    if (size > largestSize) { largestSize = size; largestPlanetIndex = i; }

    const orbitRadius = minOrbitRadius + i * 2.5 + random() * 0.7;
    const orbitSpeed = 0.0004 / (1 + i * 0.25);

    // Spec: 1 moon per 50 NFTs
    const moonCount = Math.min(Math.floor(traits.nftCount / 50), 4);
    const moons: MoonData[] = [];
    for (let j = 0; j < moonCount; j++) {
      moons.push({
        id: `moon-${i}-${j}`,
        size: 0.05 + random() * 0.1,
        orbitRadius: 0.8 + random() * 0.7,
        orbitSpeed: 0.0008 * (0.8 + random() * 0.4),
        initialAngle: random() * Math.PI * 2,
        color: `hsl(${random() * 360}, 20%, 60%)`,
      });
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
