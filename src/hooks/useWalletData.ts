import { useMemo } from 'react';
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
  
  // Seeker Genesis bonus (+50)
  if (traits.hasSeeker) {
    score += SCORING.SEEKER_GENESIS_BONUS;
  }
  
  // Chapter 2 Preorder bonus (+30)
  if (traits.hasPreorder) {
    score += SCORING.CHAPTER2_PREORDER_BONUS;
  }
  
  // COMBO BONUS: Additional +20 when user has BOTH tokens
  if (traits.hasSeeker && traits.hasPreorder) {
    score += SCORING.COMBO_BONUS;
  }
  
  // Blue chip bonus (+100)
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
  return Math.min(Math.round(score), SCORING.MAX_SCORE);
}

// Production wallet data hook - integrates with actual wallet
export function useWalletData(address?: string): WalletData {
  const walletData = useMemo(() => {
    // TODO: Replace with actual wallet integration
    // This should query:
    // 1. Check for Seeker Genesis token
    // 2. Check for Chapter 2 Preorder token (Mint: 2DMMamkkxQ6zDMBtkFp8KH7FoWzBMBA1CGTYwom4QH6Z)
    // 3. Get unique token count
    // 4. Get NFT count  
    // 5. Get transaction count
    
    if (!address) {
      // Demo data when wallet not connected - shows combo effect
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
        isLoading: false,
        error: null,
      };
    }
    
    // Generate deterministic traits from address for demo
    const hash = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    const hasSeeker = hash % 3 === 0;
    const hasPreorder = hash % 2 === 0;
    const hasCombo = hasSeeker && hasPreorder;
    const nftCount = (hash % 500) + 10;
    const isBlueChip = nftCount >= SCORING.BLUE_CHIP_THRESHOLD * 10;
    
    const traits: WalletTraits = {
      hasSeeker,
      hasPreorder,
      hasCombo,
      isBlueChip,
      uniqueTokenCount: (hash % 80) + 5,
      nftCount,
      txCount: (hash % 2000) + 100,
    };
    
    return {
      address,
      score: calculateScore(traits),
      traits,
      isLoading: false,
      error: null,
    };
  }, [address]);
  
  return walletData;
}
