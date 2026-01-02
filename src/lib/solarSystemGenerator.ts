import { VISUAL_CONFIG, PLANET_TYPES, type RarityTier } from '@/constants';
import type { WalletTraits } from '@/hooks/useWalletData';

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
  palette: {
    primary: string;
    secondary: string;
  };
  intensity: number;
  plasmaBridge: boolean;
  novaBridge: boolean;
  novaBridgeColors?: {
    primary: string;
    secondary: string;
  };
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

// Hash wallet address for deterministic seeding
function hashWalletAddress(address: string): number {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    const char = address.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Seeded random for consistent generation
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
  
  // Use wallet address as seed for unique generation
  const addressSeed = walletAddress ? hashWalletAddress(walletAddress) : 0;
  const random = seededRandom(addressSeed + traits.uniqueTokenCount + traits.nftCount);

  // Determine stellar profile
  let starMode = rarityConfig.starMode;
  let palette = { ...rarityConfig.palette };
  let plasmaBridge = Boolean(rarityConfig.plasmaBridge);
  let novaBridge = false;
  let novaBridgeColors: StellarProfile['novaBridgeColors'];

  if (traits.hasCombo) {
    starMode = starMode === 'binaryPulsar' ? 'binaryPulsar' : 'binary';
    palette = {
      primary: VISUAL_CONFIG.SUN.SEEKER_COLOR,
      secondary: VISUAL_CONFIG.SUN.PREORDER_COLOR,
    };
    novaBridge = true;
    novaBridgeColors = {
      primary: VISUAL_CONFIG.SUN.SEEKER_COLOR,
      secondary: VISUAL_CONFIG.SUN.PREORDER_COLOR,
    };
    plasmaBridge = true;
  } else if (traits.hasSeeker && !traits.hasPreorder) {
    palette = {
      primary: VISUAL_CONFIG.SUN.SEEKER_COLOR,
      secondary: '#007C99',
    };
  } else if (traits.hasPreorder && !traits.hasSeeker) {
    palette = {
      primary: VISUAL_CONFIG.SUN.PREORDER_COLOR,
      secondary: '#FFB347',
    };
  }

  const stellarProfile: StellarProfile = {
    mode: starMode,
    palette,
    intensity: 4,
    plasmaBridge,
    novaBridge,
    novaBridgeColors,
  };

  // Calculate number of planets (rarity-based clamp)
  const basePlanetEstimate = Math.max(
    rarityConfig.planetRange[0],
    Math.floor(traits.uniqueTokenCount / VISUAL_CONFIG.PLANETS.TOKENS_PER_PLANET)
  );
  let planetCount = clamp(
    basePlanetEstimate || 1,
    rarityConfig.planetRange[0],
    rarityConfig.planetRange[1]
  );
  if (planetCount < rarityConfig.planetRange[1] && random() > 0.6) {
    planetCount += 1;
  }
  planetCount = clamp(planetCount, rarityConfig.planetRange[0], VISUAL_CONFIG.PLANETS.MAX_PLANETS);

  // Binary systems need more space
  const minOrbitRadius = stellarProfile.mode === 'single'
    ? VISUAL_CONFIG.PLANETS.MIN_ORBIT_RADIUS
    : VISUAL_CONFIG.PLANETS.MIN_ORBIT_RADIUS + 4;

  // Calculate total moons (1 per 50 NFTs) with rarity guarantees
  const baseMoonCount = Math.floor(traits.nftCount / VISUAL_CONFIG.MOONS.NFTS_PER_MOON);
  const minimumMoonCount = rarityConfig.ensureMoons ? planetCount : 0;
  const totalMoons = Math.max(baseMoonCount, minimumMoonCount);
  const moonsPerPlanet = Math.max(
    rarityConfig.ensureMoons ? 1 : 0,
    Math.ceil(totalMoons / planetCount)
  );

  // Find largest planet index for rings
  let largestPlanetIndex = 0;
  let largestSize = 0;

  const planets: PlanetData[] = [];
  for (let i = 0; i < planetCount; i++) {
    const typeIndex = Math.floor(random() * PLANET_TYPES.length);
    const size = VISUAL_CONFIG.PLANETS.SIZE_RANGE.min +
      random() * (VISUAL_CONFIG.PLANETS.SIZE_RANGE.max - VISUAL_CONFIG.PLANETS.SIZE_RANGE.min);

    if (size > largestSize) {
      largestSize = size;
      largestPlanetIndex = i;
    }

    const orbitRadius = minOrbitRadius +
      i * VISUAL_CONFIG.PLANETS.ORBIT_SPACING +
      random() * 0.7;

    const orbitSpeed = VISUAL_CONFIG.ANIMATION.PLANET_ORBIT / (1 + i * 0.25);

    const geometryIndex = Math.floor(random() * 10);
    const geometry: PlanetData['geometry'] = geometryIndex < 7 ? 'sphere' :
      geometryIndex < 9 ? 'oblate' : 'crystalline';

    const moonCount = Math.min(
      rarityConfig.ensureMoons ? Math.max(1, moonsPerPlanet) : Math.max(0, moonsPerPlanet - i),
      VISUAL_CONFIG.MOONS.MAX_MOONS_PER_PLANET
    );

    const moons: MoonData[] = [];
    for (let j = 0; j < moonCount; j++) {
      moons.push({
        id: `moon-${i}-${j}`,
        size: VISUAL_CONFIG.MOONS.SIZE_RANGE.min +
          random() * (VISUAL_CONFIG.MOONS.SIZE_RANGE.max - VISUAL_CONFIG.MOONS.SIZE_RANGE.min),
        orbitRadius: VISUAL_CONFIG.MOONS.ORBIT_RADIUS.min +
          random() * (VISUAL_CONFIG.MOONS.ORBIT_RADIUS.max - VISUAL_CONFIG.MOONS.ORBIT_RADIUS.min),
        orbitSpeed: VISUAL_CONFIG.ANIMATION.MOON_ORBIT * (0.8 + random() * 0.4),
        initialAngle: random() * Math.PI * 2,
        color: `hsl(${random() * 360}, 30%, 70%)`,
      });
    }

    planets.push({
      id: `planet-${i}`,
      size,
      orbitRadius,
      orbitSpeed,
      rotationSpeed: VISUAL_CONFIG.ANIMATION.PLANET_ROTATION * (0.5 + random()),
      type: PLANET_TYPES[typeIndex],
      initialAngle: random() * Math.PI * 2,
      moons,
      hasRing: false,
      geometry,
    });
  }

  const shouldRenderRing = traits.isBlueChip || rarityConfig.ensureRings;
  if (shouldRenderRing && planets.length > 0) {
    planets[largestPlanetIndex].hasRing = true;
  }

  const dustBase = VISUAL_CONFIG.DUST.BASE_COUNT +
    Math.floor(traits.txCount / 100) * VISUAL_CONFIG.DUST.TX_MULTIPLIER;
  const dustParticleCount = Math.min(
    Math.floor(dustBase * DUST_MULTIPLIER[traits.rarityTier]),
    VISUAL_CONFIG.DUST.MAX_PARTICLES
  );

  const spreadRadius = 50 + planetCount * 6 + (stellarProfile.mode !== 'single' ? 10 : 0);

  const starfieldDensity = 0.35 + (traits.rarityTier === 'mythic'
    ? 0.5
    : traits.rarityTier === 'legendary'
      ? 0.4
      : traits.rarityTier === 'epic'
        ? 0.3
        : traits.rarityTier === 'rare'
          ? 0.2
          : 0.1);

  const nebula = rarityConfig.nebula
    ? {
        colors: VISUAL_CONFIG.NEBULA.COLORS,
        intensity: VISUAL_CONFIG.NEBULA.INTENSITY,
        radius: spreadRadius * 1.2,
      }
    : undefined;

  return {
    planets,
    spaceDust: {
      particleCount: dustParticleCount,
      spreadRadius,
      colors: [palette.primary, palette.secondary, '#ffffff'],
    },
    starfieldDensity,
    stellarProfile,
    orbitColor: rarityConfig.orbitColor,
    nebula,
    rarityTier: traits.rarityTier,
  };
}
