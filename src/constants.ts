const HELIUS_API_KEY = import.meta.env.VITE_HELIUS_API_KEY;

export const HELIUS_CONFIG = {
  API_KEY: HELIUS_API_KEY,
  REST_URL: 'https://api.helius.xyz/v0',
  RPC_URL: `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
};

export const MINT_CONFIG = {
  PRICE_SOL: 0.01,
  NETWORK: 'mainnet-beta',
  COLLECTION: 'Identity Prism',
};

// Scoring + rarity system (Identity Prism 3.0)
export const SCORING = {
  SEEKER_GENESIS_BONUS: 200,
  CHAPTER2_PREORDER_BONUS: 150,
  COMBO_BONUS: 200,
  BLUE_CHIP_BONUS: 100,
  MEME_LORD_BONUS: 70,
  DEFI_KING_BONUS: 70,
  HYPERACTIVE_THRESHOLD_30D: 8, // tx/day
  DIAMOND_HANDS_DAYS: 60,

  SOL_BALANCE_THRESHOLDS: {
    MINOR: { amount: 0.1, bonus: 30 },
    MAJOR: { amount: 1, bonus: 70 },
    LEGEND: { amount: 5, bonus: 150 },
  },

  WALLET_AGE_PER_YEAR: 100,
  WALLET_AGE_MAX: 300,

  TX_COUNT_MULTIPLIER: 0.5,
  TX_COUNT_CAP: 200, // max 400 tx * 0.5

  MAX_SCORE: 1200,
  BLUE_CHIP_THRESHOLD: 10,
} as const;

export const RARITY_THRESHOLDS = {
  COMMON: 0,
  RARE: 201,
  EPIC: 451,
  LEGENDARY: 651,
  MYTHIC: 851,
} as const;

export const MAX_SCORE_CAP = 1200;

export const TOKEN_ADDRESSES = {
  SEEKER_GENESIS_COLLECTION: 'GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te',
  SEEKER_MINT_AUTHORITY: 'GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4',
  CHAPTER2_PREORDER: '2DMMamkkxQ6zDMBtkFp8KH7FoWzBMBA1CGTYwom4QH6Z',
} as const;

export const MEME_COIN_MINTS = {
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  POPCAT: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
  MEW: 'MEW1VNoNHn99uH86fUvYvU42o9YkS9uH9Tst6t2291',
} as const;

export const LST_MINTS = {
  JITOSOL: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
  MSOL: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  BSOL: 'BSo13v7qDMGWCM1cW8wwfsfZ7vQLZKxHCiNSN2B7Mq2u',
} as const;

export const DEFI_POSITION_HINTS = ['kamino', 'drift', 'marginfi', 'mango', 'jito', 'solend', 'zeta'];

export const BLUE_CHIP_COLLECTION_NAMES = ['mad lads', 'solana monkey business', 'claynosaurz'];

export const TREASURY_ADDRESS = 'M1nTPcUB7bYp7uC3KxA9HtxFqouBZfyqCkCmDYJLdnU';

// Visual Configuration
export const VISUAL_CONFIG = {
  // Sun configurations
  SUN: {
    BASE_SIZE: 2,
    SEEKER_COLOR: '#00D4FF', // Cyan/Teal
    PREORDER_COLOR: '#FFD700', // Gold
    COMBO_PRIMARY: '#00D4FF', // Cyan
    COMBO_SECONDARY: '#FFD700', // Gold
    DEFAULT_COLOR: '#FF6B35', // Orange
    EMISSIVE_INTENSITY: 20,
    RARE_COLOR: '#8CFFE3',
    RARE_ACCENT: '#FFD19A',
    EPIC_COLOR: '#C3A3FF',
    EPIC_ACCENT: '#FF7AE2',
    LEGENDARY_COLOR: '#6AD9FF',
    MYTHIC_PRIMARY: '#FF9C6D',
    MYTHIC_SECONDARY: '#7F5BFF',
  },
  
  // Planet generation
  PLANETS: {
    TOKENS_PER_PLANET: 10, // 1 planet per 10 unique tokens
    MAX_PLANETS: 10,
    MIN_ORBIT_RADIUS: 6,
    ORBIT_SPACING: 2.5,
    SIZE_RANGE: { min: 0.3, max: 0.8 },
  },
  
  // Moon generation
  MOONS: {
    NFTS_PER_MOON: 50, // 1 moon per 50 NFTs
    MAX_MOONS_PER_PLANET: 4,
    SIZE_RANGE: { min: 0.05, max: 0.15 },
    ORBIT_RADIUS: { min: 0.8, max: 1.5 },
  },
  
  // Space dust density based on activity
  DUST: {
    BASE_COUNT: 150,
    TX_MULTIPLIER: 8, // Additional particles per 100 tx
    MAX_PARTICLES: 3000, // Reduced for mobile performance
  },
  
  // Animation speeds (slow and majestic)
  ANIMATION: {
    SUN_ROTATION: 0.0002,
    PLANET_ORBIT: 0.0004,
    PLANET_ROTATION: 0.0006,
    MOON_ORBIT: 0.0008,
    BINARY_ORBIT: 0.0005,
  },
  
  // Post-processing (High-Clarity Cinematic - Mobile Optimized)
  POST_PROCESSING: {
    BLOOM_INTENSITY: 1.4,
    BLOOM_LUMINANCE_THRESHOLD: 0.2,
    BLOOM_LUMINANCE_SMOOTHING: 0.9,
    CHROMATIC_ABERRATION: 0.0005, // Very subtle, edge-only
    VIGNETTE_DARKNESS: 0.35,
    NOISE_OPACITY: 0.012,
  },
  
  // Starfield configuration
  STARS: {
    RADIUS: 400,
    DEPTH: 80,
    COUNT: 15000,
    FACTOR: 6,
    SATURATION: 0,
    FADE: true,
  },
  
  ORBITS: {
    DEFAULT: '#4488ff',
    GOLDEN: '#ffd479',
  },
  
  NEBULA: {
    COLORS: ['#2b1055', '#7a00ff', '#ff8e53'],
    INTENSITY: 0.65,
  },
} as const;

export type RarityTier = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

// Planet types for visual variety
export const PLANET_TYPES = [
  { name: 'earth', baseColor: '#2E8B57', accent: '#8ddbe0', roughness: 0.5, metalness: 0.15, surface: 'oceanic' },
  { name: 'oceanic', baseColor: '#118cd6', accent: '#f5f8ff', roughness: 0.25, metalness: 0.08, surface: 'oceanic' },
  { name: 'rocky', baseColor: '#8B7355', accent: '#d1bfa5', roughness: 0.9, metalness: 0.12, surface: 'cratered' },
  { name: 'cratered', baseColor: '#777777', accent: '#cfcfcf', roughness: 0.85, metalness: 0.2, surface: 'cratered' },
  { name: 'gaseous', baseColor: '#D9A066', accent: '#f0d8b0', roughness: 0.12, metalness: 0.02, surface: 'gas' },
  { name: 'gas_striped', baseColor: '#b980ff', accent: '#f8b4ff', roughness: 0.1, metalness: 0.05, surface: 'gas' },
  { name: 'icy', baseColor: '#B0E0E6', accent: '#f7fdff', roughness: 0.3, metalness: 0.22, surface: 'cratered' },
  { name: 'volcanic', baseColor: '#8B0000', accent: '#ff7b00', roughness: 0.75, metalness: 0.25, surface: 'basic' },
  { name: 'desert', baseColor: '#DAA520', accent: '#f9e4a4', roughness: 0.95, metalness: 0.05, surface: 'basic' },
  { name: 'toxic', baseColor: '#9ACD32', accent: '#f0ffb3', roughness: 0.6, metalness: 0.15, surface: 'basic' },
  { name: 'crystal', baseColor: '#E0FFFF', accent: '#baf5ff', roughness: 0.1, metalness: 0.8, surface: 'basic' },
  { name: 'lava', baseColor: '#FF4500', accent: '#ffd74d', roughness: 0.65, metalness: 0.25, surface: 'basic' },
] as const;

export const MEME_COIN_PRICES_USD: Record<keyof typeof MEME_COIN_MINTS, number> = {
  BONK: 0.000002,
  WIF: 3.5,
  POPCAT: 0.35,
  MEW: 0.003,
};
