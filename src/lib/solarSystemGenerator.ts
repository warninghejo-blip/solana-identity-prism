import { VISUAL_CONFIG, PLANET_TYPES } from '@/constants';
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

export interface SolarSystemData {
  planets: PlanetData[];
  spaceDust: SpaceDustConfig;
  sunType: 'combo' | 'seeker' | 'preorder' | 'default';
  starfieldDensity: number;
  isBinarySystem: boolean;
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

export function generateSolarSystem(traits: WalletTraits, walletAddress?: string): SolarSystemData {
  // Use wallet address as seed for unique generation
  const addressSeed = walletAddress ? hashWalletAddress(walletAddress) : 0;
  const random = seededRandom(addressSeed + traits.uniqueTokenCount + traits.nftCount);
  
  // Determine sun type based on traits
  let sunType: SolarSystemData['sunType'] = 'default';
  const isBinarySystem = traits.hasCombo || (traits.hasSeeker && traits.hasPreorder);
  
  if (isBinarySystem) {
    sunType = 'combo';
  } else if (traits.hasSeeker) {
    sunType = 'seeker';
  } else if (traits.hasPreorder) {
    sunType = 'preorder';
  }
  
  // Calculate number of planets (1 per 10 unique tokens, max 10)
  const planetCount = Math.min(
    Math.max(1, Math.floor(traits.uniqueTokenCount / VISUAL_CONFIG.PLANETS.TOKENS_PER_PLANET)),
    VISUAL_CONFIG.PLANETS.MAX_PLANETS
  );
  
  // Binary systems need more space - increase minimum orbit radius
  const minOrbitRadius = isBinarySystem 
    ? VISUAL_CONFIG.PLANETS.MIN_ORBIT_RADIUS + 4 // Extra space for dual stars
    : VISUAL_CONFIG.PLANETS.MIN_ORBIT_RADIUS;
  
  // Calculate total moons (1 per 50 NFTs)
  const totalMoons = Math.floor(traits.nftCount / VISUAL_CONFIG.MOONS.NFTS_PER_MOON);
  
  // Distribute moons across planets
  const moonsPerPlanet = Math.ceil(totalMoons / planetCount);
  
  // Find largest planet index for blue chip ring
  let largestPlanetIndex = 0;
  let largestSize = 0;
  
  // Generate planets
  const planets: PlanetData[] = [];
  
  // Planet geometry types for variety
  const geometryTypes: PlanetData['geometry'][] = ['sphere', 'oblate', 'crystalline'];
  
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
      random() * 0.5;
    
    // Slower orbits for outer planets (more realistic)
    const orbitSpeed = VISUAL_CONFIG.ANIMATION.PLANET_ORBIT / (1 + i * 0.3);
    
    // Deterministic geometry based on seed
    const geometryIndex = Math.floor(random() * 10);
    const geometry: PlanetData['geometry'] = geometryIndex < 7 ? 'sphere' : 
      geometryIndex < 9 ? 'oblate' : 'crystalline';
    
    // Generate moons for this planet
    const moonCount = Math.min(
      i < planetCount - 1 ? moonsPerPlanet : totalMoons - (moonsPerPlanet * i),
      VISUAL_CONFIG.MOONS.MAX_MOONS_PER_PLANET
    );
    
    const moons: MoonData[] = [];
    for (let j = 0; j < Math.max(0, moonCount); j++) {
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
  
  // Add blue chip ring to largest planet
  if (traits.isBlueChip && planets.length > 0) {
    planets[largestPlanetIndex].hasRing = true;
  }
  
  // Calculate space dust density based on activity
  const dustParticleCount = Math.min(
    VISUAL_CONFIG.DUST.BASE_COUNT + Math.floor(traits.txCount / 100) * VISUAL_CONFIG.DUST.TX_MULTIPLIER,
    VISUAL_CONFIG.DUST.MAX_PARTICLES
  );
  
  // Starfield density based on overall activity
  const starfieldDensity = 0.3 + Math.min(traits.txCount / 3000, 0.7);
  
  return {
    planets,
    spaceDust: {
      particleCount: dustParticleCount,
      spreadRadius: 50 + planetCount * 5,
      colors: ['#ffffff', '#fffaf0', '#f0f8ff', '#fff8dc'],
    },
    sunType,
    starfieldDensity,
    isBinarySystem,
  };
}
