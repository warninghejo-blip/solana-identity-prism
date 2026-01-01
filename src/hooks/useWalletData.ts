import { useState, useMemo } from 'react';
import { SCORING } from '@/constants';

export interface WalletTraits {
  hasSeeker: boolean;
  hasPreorder: boolean;
  hasCombo: boolean; // Both Seeker AND Preorder
  isBlueChip: boolean;
  uniqueTokenCount: number;
  nftCount: number;
  txCount: number;
}

export interface WalletData {
  address: string;
  score: number;
  traits: WalletTraits;
  isLoading: boolean;
  error: string | null;
}

// Calculate the total score based on wallet traits
export function calculateScore(traits: WalletTraits): number {
  let score = 0;
  
  // Seeker Genesis bonus
  if (traits.hasSeeker) {
    score += SCORING.SEEKER_GENESIS_BONUS;
  }
  
  // Chapter 2 Preorder bonus
  if (traits.hasPreorder) {
    score += SCORING.CHAPTER2_PREORDER_BONUS;
  }
  
  // COMBO BONUS: Additional +20 when user has BOTH tokens
  if (traits.hasSeeker && traits.hasPreorder) {
    score += SCORING.COMBO_BONUS;
  }
  
  // Blue chip bonus
  if (traits.isBlueChip) {
    score += SCORING.BLUE_CHIP_BONUS;
  }
  
  // Token diversity bonus
  score += traits.uniqueTokenCount * SCORING.UNIQUE_TOKEN_BONUS;
  
  // NFT collection bonus
  score += traits.nftCount * SCORING.NFT_COLLECTION_BONUS;
  
  // Transaction activity bonus (capped)
  const txBonus = Math.min(
    traits.txCount * SCORING.TX_COUNT_MULTIPLIER,
    SCORING.TX_COUNT_CAP
  );
  score += txBonus;
  
  // Cap the total score
  return Math.min(score, SCORING.MAX_SCORE);
}

// Mock wallet data for demonstration - replace with actual blockchain queries
function generateMockTraits(address: string): WalletTraits {
  // Use address hash to generate deterministic but varied data
  const hash = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  const hasSeeker = hash % 3 === 0;
  const hasPreorder = hash % 2 === 0;
  const hasCombo = hasSeeker && hasPreorder;
  const nftCount = (hash % 500) + 10;
  const isBlueChip = nftCount >= SCORING.BLUE_CHIP_THRESHOLD * 10;
  
  return {
    hasSeeker,
    hasPreorder,
    hasCombo,
    isBlueChip,
    uniqueTokenCount: (hash % 80) + 5,
    nftCount,
    txCount: (hash % 2000) + 100,
  };
}

export function useWalletData(address?: string): WalletData {
  const [isLoading] = useState(false);
  const [error] = useState<string | null>(null);
  
  const walletData = useMemo(() => {
    if (!address) {
      // Default demo data with combo effect for showcase
      const demoTraits: WalletTraits = {
        hasSeeker: true,
        hasPreorder: true,
        hasCombo: true,
        isBlueChip: true,
        uniqueTokenCount: 45,
        nftCount: 230,
        txCount: 1500,
      };
      
      return {
        address: '0xDemo...Wallet',
        score: calculateScore(demoTraits),
        traits: demoTraits,
        isLoading,
        error,
      };
    }
    
    const traits = generateMockTraits(address);
    
    return {
      address,
      score: calculateScore(traits),
      traits,
      isLoading,
      error,
    };
  }, [address, isLoading, error]);
  
  return walletData;
}

// Hook for testing different wallet states
export function useWalletDemo() {
  const [demoMode, setDemoMode] = useState<'combo' | 'seeker' | 'preorder' | 'basic'>('combo');
  
  const traits = useMemo((): WalletTraits => {
    switch (demoMode) {
      case 'combo':
        return {
          hasSeeker: true,
          hasPreorder: true,
          hasCombo: true,
          isBlueChip: true,
          uniqueTokenCount: 85,
          nftCount: 450,
          txCount: 2500,
        };
      case 'seeker':
        return {
          hasSeeker: true,
          hasPreorder: false,
          hasCombo: false,
          isBlueChip: false,
          uniqueTokenCount: 35,
          nftCount: 120,
          txCount: 800,
        };
      case 'preorder':
        return {
          hasSeeker: false,
          hasPreorder: true,
          hasCombo: false,
          isBlueChip: true,
          uniqueTokenCount: 55,
          nftCount: 280,
          txCount: 1200,
        };
      case 'basic':
      default:
        return {
          hasSeeker: false,
          hasPreorder: false,
          hasCombo: false,
          isBlueChip: false,
          uniqueTokenCount: 15,
          nftCount: 30,
          txCount: 200,
        };
    }
  }, [demoMode]);
  
  return {
    demoMode,
    setDemoMode,
    traits,
    score: calculateScore(traits),
  };
}
