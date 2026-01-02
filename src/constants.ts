// Scoring Constants for Wallet Identity Visualizer
export const SCORING = {
  // Base bonuses for special tokens
  SEEKER_GENESIS_BONUS: 50,
  CHAPTER2_PREORDER_BONUS: 30,
  
  // COMBO BONUS: +20 additional points when user has BOTH Seeker AND Preorder
  COMBO_BONUS: 20,
  
  // Activity multipliers
  TX_COUNT_MULTIPLIER: 0.1, // Points per transaction (capped)
  TX_COUNT_CAP: 100,
  
  // Token diversity bonuses
  UNIQUE_TOKEN_BONUS: 2, // Per unique token type
  NFT_COLLECTION_BONUS: 1, // Per NFT owned
  BLUE_CHIP_BONUS: 100, // Bonus for blue chip holder
  
  // Thresholds
  MAX_SCORE: 1000,
  BLUE_CHIP_THRESHOLD: 10, // NFT count to qualify as blue chip holder
} as const;

// Token Contract Addresses (example placeholders - replace with real addresses)
export const TOKEN_ADDRESSES = {
  SEEKER_GENESIS: '0x1234567890abcdef1234567890abcdef12345678',
  CHAPTER2_PREORDER: '0xabcdef1234567890abcdef1234567890abcdef12',
} as const;

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
    EMISSIVE_INTENSITY: 3,
  },
  
  // Planet generation
  PLANETS: {
    TOKENS_PER_PLANET: 10, // 1 planet per 10 unique tokens
    MAX_PLANETS: 10,
    MIN_ORBIT_RADIUS: 5,
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
    BASE_COUNT: 200,
    TX_MULTIPLIER: 10, // Additional particles per 100 tx
    MAX_PARTICLES: 5000,
  },
  
  // Animation speeds (slow and majestic)
  ANIMATION: {
    SUN_ROTATION: 0.001,
    PLANET_ORBIT: 0.002,
    PLANET_ROTATION: 0.003,
    MOON_ORBIT: 0.005,
    BINARY_ORBIT: 0.003,
  },
  
  // Post-processing (High-Clarity Cinematic)
  POST_PROCESSING: {
    BLOOM_INTENSITY: 1.2, // Balanced, not overwhelming
    BLOOM_LUMINANCE_THRESHOLD: 0.85, // Only brightest parts glow
    BLOOM_LUMINANCE_SMOOTHING: 0.4,
    CHROMATIC_ABERRATION: 0.0008, // Very subtle, edge-only
    VIGNETTE_DARKNESS: 0.4,
    NOISE_OPACITY: 0.015,
  },
  
  // Starfield configuration
  STARS: {
    RADIUS: 300,
    DEPTH: 60,
    COUNT: 5000,
    FACTOR: 7,
    SATURATION: 0,
    FADE: true,
  },
} as const;

// Planet types for visual variety
export const PLANET_TYPES = [
  { name: 'rocky', color: '#8B7355', roughness: 0.9, metalness: 0.1 },
  { name: 'icy', color: '#B0E0E6', roughness: 0.3, metalness: 0.2 },
  { name: 'gaseous', color: '#DEB887', roughness: 0.1, metalness: 0.0 },
  { name: 'volcanic', color: '#8B0000', roughness: 0.8, metalness: 0.3 },
  { name: 'oceanic', color: '#1E90FF', roughness: 0.2, metalness: 0.1 },
  { name: 'desert', color: '#DAA520', roughness: 0.95, metalness: 0.05 },
  { name: 'toxic', color: '#9ACD32', roughness: 0.6, metalness: 0.15 },
  { name: 'crystal', color: '#E0FFFF', roughness: 0.1, metalness: 0.8 },
  { name: 'lava', color: '#FF4500', roughness: 0.7, metalness: 0.2 },
  { name: 'frozen', color: '#F0FFFF', roughness: 0.4, metalness: 0.3 },
] as const;
