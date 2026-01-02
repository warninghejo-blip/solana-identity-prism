import { useEffect, useState } from 'react';
import {
  HELIUS_CONFIG,
  MEME_COIN_MINTS,
  SCORING,
  TOKEN_ADDRESSES,
  LST_MINTS,
  DEFI_POSITION_HINTS,
  BLUE_CHIP_COLLECTION_NAMES,
  RARITY_THRESHOLDS,
  type RarityTier,
} from '@/constants';

export interface WalletTraits {
  hasSeeker: boolean;
  hasPreorder: boolean;
  hasCombo: boolean; // Both Seeker AND Preorder
  isBlueChip: boolean;
  isDeFiKing: boolean;
  uniqueTokenCount: number;
  nftCount: number;
  txCount: number;
  memeCoinsHeld: string[];
  isMemeLord: boolean;
  hyperactiveDegen: boolean;
  diamondHands: boolean;
  avgTxPerDay30d: number;
  daysSinceLastTx: number | null;
  solBalance: number;
  solBonusApplied: number;
  walletAgeYears: number;
  walletAgeBonus: number;
  rarityTier: RarityTier;
}

export interface WalletData {
  address: string;
  score: number;
  traits: WalletTraits | null;
  isLoading: boolean;
  error: string | null;
}

// Calculate the total score based on wallet traits
export function calculateScore(traits: WalletTraits): number {
  let score = 0;
  
  if (traits.hasSeeker) score += SCORING.SEEKER_GENESIS_BONUS;
  if (traits.hasPreorder) score += SCORING.CHAPTER2_PREORDER_BONUS;
  if (traits.hasCombo) score += SCORING.COMBO_BONUS;
  if (traits.isBlueChip) score += SCORING.BLUE_CHIP_BONUS;
  if (traits.isMemeLord) score += SCORING.MEME_LORD_BONUS;
  if (traits.isDeFiKing) score += SCORING.DEFI_KING_BONUS;
  score += traits.solBonusApplied;
  score += traits.walletAgeBonus;

  // Transaction activity bonus (capped at 400 tx => 200 pts)
  const txBonus = Math.min(
    traits.txCount * SCORING.TX_COUNT_MULTIPLIER,
    SCORING.TX_COUNT_CAP
  );
  score += txBonus;
  
  // Cap the total score
  return Math.min(Math.round(score), SCORING.MAX_SCORE);
}

const DAY_MS = 86_400_000;
const THIRTY_DAYS_MS = DAY_MS * 30;
const YEAR_MS = DAY_MS * 365;
const DEMO_WALLET_ADDRESS = '0xDemo...Wallet';
const MEME_SYMBOLS = Object.keys(MEME_COIN_MINTS) as (keyof typeof MEME_COIN_MINTS)[];
const LST_MINT_VALUES = Object.values(LST_MINTS);
const SOL_LAMPORTS = 1_000_000_000;
const DEFI_HINTS = DEFI_POSITION_HINTS.map((hint) => hint.toLowerCase());

type WalletTraitsCore = Omit<WalletTraits, 'rarityTier'>;
interface NormalizedToken extends Record<string, any> {
  mint: string;
  normalizedAmount: number;
  symbol?: string;
  name?: string;
  tokenAccount?: Record<string, any>;
}

const disconnectedWalletState = buildDisconnectedWalletData();

export function useWalletData(address?: string): WalletData {
  const [walletData, setWalletData] = useState<WalletData>(disconnectedWalletState);

  useEffect(() => {
    if (!address) {
      setWalletData(buildDisconnectedWalletData());
      return;
    }

    const controller = new AbortController();

    (async () => {
      setWalletData(prev => ({
        ...prev,
        address,
        isLoading: true,
        error: null,
      }));

      try {
        const traits = await fetchWalletInsights(address, controller.signal);

        if (!controller.signal.aborted) {
          setWalletData({
            address,
            traits,
            score: calculateScore(traits),
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        const fallbackTraits = buildFallbackTraits(address);

        setWalletData({
          address,
          traits: fallbackTraits,
          score: calculateScore(fallbackTraits),
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch wallet data',
        });
      }
    })().catch((error) => {
      setWalletData({
        address,
        traits: null,
        score: 0,
        rarityTier: 'Unknown',
        isLoading: false,
        error: error.message || 'Failed to fetch wallet data',
      });
    });

    return () => controller.abort();
  }, [address]);

  return walletData;
}

async function fetchWalletInsights(address: string, signal?: AbortSignal): Promise<WalletTraits> {
  if (!HELIUS_CONFIG.API_KEY) {
    throw new Error('Missing VITE_HELIUS_API_KEY');
  }

  const restBase = `${HELIUS_CONFIG.REST_URL}/addresses/${address}`;
  const apiSuffix = `?api-key=${HELIUS_CONFIG.API_KEY}`;

  const [balancesRes, nftsRes, txRes, seekerAssets] = await Promise.all([
    fetchJson(`${restBase}/balances${apiSuffix}`, signal),
    fetchJson(`${restBase}/nfts${apiSuffix}`, signal).catch(() => null),
    fetchJson(`${restBase}/transactions${apiSuffix}&limit=200`, signal).catch(() => null),
    searchCollectionOwnership(address, TOKEN_ADDRESSES.SEEKER_GENESIS_COLLECTION, signal).catch(() => null),
  ]);

  const tokensRaw = Array.isArray(balancesRes?.tokens) ? balancesRes.tokens : [];
  const tokens: NormalizedToken[] = tokensRaw.map((token: any) => ({
    ...token,
    normalizedAmount: normalizeTokenAmount(token),
  }));

  const nfts = Array.isArray(nftsRes?.nfts) ? nftsRes.nfts : Array.isArray(nftsRes) ? nftsRes : [];
  const transactions = Array.isArray(txRes?.transactions) ? txRes.transactions : Array.isArray(txRes) ? txRes : [];

  const nftCount = nfts.length;
  const uniqueTokenCount = tokens.filter(token => token.normalizedAmount > 0).length;
  const hasPreorder = tokens.some(token => token.mint === TOKEN_ADDRESSES.CHAPTER2_PREORDER && token.normalizedAmount > 0);
  const hasSeeker = Boolean(
    seekerAssets && Array.isArray(seekerAssets) && seekerAssets.length > 0
  ) || nfts.some((nft: any) => matchesCollection(nft, TOKEN_ADDRESSES.SEEKER_GENESIS_COLLECTION));
  const hasCombo = hasSeeker && hasPreorder;

  const memeCoinsHeld = MEME_SYMBOLS.filter((symbol) =>
    tokens.some((token) => token.mint === MEME_COIN_MINTS[symbol] && token.normalizedAmount > 0)
  );
  const isMemeLord = memeCoinsHeld.length >= 3; // holds all three meme tokens

  const txTimestamps = transactions
    .map(parseTxTimestamp)
    .filter((value): value is number => typeof value === 'number');
  const now = Date.now();
  const lastTxMs = txTimestamps.length ? Math.max(...txTimestamps) : null;
  const daysSinceLastTx = lastTxMs ? (now - lastTxMs) / DAY_MS : null;
  const txCount30d = txTimestamps.filter(ts => now - ts <= THIRTY_DAYS_MS).length;
  const hyperactiveDegen = txCount30d >= SCORING.HYPERACTIVE_THRESHOLD_30D;
  const diamondHands = typeof daysSinceLastTx === 'number' && daysSinceLastTx >= SCORING.DIAMOND_HANDS_DAYS;
  const earliestTxMs = txTimestamps.length ? Math.min(...txTimestamps) : null;
  const walletAgeYears = earliestTxMs ? Math.min(
    Math.floor((now - earliestTxMs) / YEAR_MS),
    SCORING.WALLET_AGE_MAX / SCORING.WALLET_AGE_PER_YEAR
  ) : 0;
  const walletAgeBonus = walletAgeYears * SCORING.WALLET_AGE_PER_YEAR;

  const txCount = typeof txRes?.total === 'number' ? txRes.total : transactions.length;
  const solBalance = extractSolBalance(balancesRes);
  const solBonusApplied = getSolBonus(solBalance);
  const isBlueChip = detectBlueChipCollections(nfts);
  const isDeFiKing = detectDeFiPresence(tokens, nfts, transactions);

  const traitCore: WalletTraitsCore = {
    hasSeeker,
    hasPreorder,
    hasCombo,
    isBlueChip,
    isDeFiKing,
    uniqueTokenCount,
    nftCount,
    txCount,
    memeCoinsHeld,
    isMemeLord,
    hyperactiveDegen,
    diamondHands,
    avgTxPerDay30d: txCount30d / 30,
    daysSinceLastTx,
    solBalance,
    solBonusApplied,
    walletAgeYears,
    walletAgeBonus,
  };

  const baseTraits: WalletTraits = {
    ...traitCore,
    rarityTier: 'common',
  };

  const previewScore = calculateScore(baseTraits);
  const rarityTier = determineRarityTier(previewScore);

  return {
    ...baseTraits,
    rarityTier,
  };
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Helius request failed (${response.status}): ${errorText || response.statusText}`);
  }
  return response.json() as Promise<T>;
}

async function searchCollectionOwnership(address: string, collectionId: string, signal?: AbortSignal) {
  if (!collectionId) return null;

  const response = await fetch(`${HELIUS_CONFIG.RPC_URL}/?api-key=${HELIUS_CONFIG.API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: `collection-${collectionId}`,
      method: 'searchAssets',
      params: {
        ownerAddress: address,
        grouping: [{ groupKey: 'collection', groupValue: collectionId }],
        page: 1,
        limit: 1,
      },
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Helius searchAssets failed (${response.status}): ${errorText || response.statusText}`);
  }

  const payload = await response.json();
  return payload?.result?.items ?? [];
}

function matchesCollection(asset: any, collectionId: string): boolean {
  if (!asset || !collectionId) return false;
  if (asset.collection?.address === collectionId) return true;
  if (asset.collectionKey === collectionId) return true;
  if (asset.grouping && Array.isArray(asset.grouping)) {
    return asset.grouping.some((group: any) => group?.group_value === collectionId || group?.groupValue === collectionId);
  }
  return false;
}

function normalizeTokenAmount(token: any): number {
  const decimalsRaw = token?.decimals;
  const decimals = typeof decimalsRaw === 'number' ? decimalsRaw : Number(decimalsRaw ?? 0);
  const amountRaw = token?.amount;
  const raw = typeof amountRaw === 'string' ? parseFloat(amountRaw) : Number(amountRaw ?? 0);
  if (!decimals) return raw;
  return raw / Math.pow(10, decimals);
}

function parseTxTimestamp(tx: any): number | null {
  if (!tx) return null;
  const raw = tx.timestamp ?? tx.blockTime ?? tx.block_time ?? null;
  if (raw === null || raw === undefined) return null;
  const numeric = typeof raw === 'string' ? Number(raw) : raw;
  if (Number.isNaN(numeric)) return null;
  return numeric > 1e12 ? numeric : numeric * 1000;
}

function buildDisconnectedWalletData(): WalletData {
  const traits = buildFallbackTraits();
  return {
    address: DEMO_WALLET_ADDRESS,
    traits,
    score: calculateScore(traits),
    isLoading: false,
    error: null,
  };
}

function buildFallbackTraits(address?: string): WalletTraits {
  const seed = address
    ? address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    : 777;

  const hasSeeker = seed % 3 === 0;
  const hasPreorder = seed % 2 === 0;
  const hasCombo = hasSeeker && hasPreorder;
  const nftCount = (seed % 500) + 50;
  const uniqueTokenCount = (seed % 80) + 15;
  const txCount = (seed % 2000) + 250;
  const memeCoinsHeld = MEME_SYMBOLS.filter((_, index) => ((seed >> index) & 1) === 1);
  const isMemeLord = memeCoinsHeld.length >= 3;
  const daysSinceLastTx = (seed % 120);
  const hyperactiveDegen = (seed % 100) > 55;
  const diamondHands = daysSinceLastTx >= SCORING.DIAMOND_HANDS_DAYS;
  const solBalance = (seed % 20) + 0.25;
  const solBonusApplied = getSolBonus(solBalance);
  const walletAgeYears = Math.min(3, (seed % 4) + 1);
  const walletAgeBonus = walletAgeYears * SCORING.WALLET_AGE_PER_YEAR;
  const isBlueChip = seed % 3 === 0;
  const isDeFiKing = seed % 4 === 0;

  const traitCore: WalletTraitsCore = {
    hasSeeker,
    hasPreorder,
    hasCombo,
    isBlueChip,
    isDeFiKing,
    uniqueTokenCount,
    nftCount,
    txCount,
    memeCoinsHeld,
    isMemeLord,
    hyperactiveDegen,
    diamondHands,
    avgTxPerDay30d: txCount / 30,
    daysSinceLastTx,
    solBalance,
    solBonusApplied,
    walletAgeYears,
    walletAgeBonus,
  };

  const baseTraits: WalletTraits = {
    ...traitCore,
    rarityTier: 'common',
  };

  const rarityTier = determineRarityTier(calculateScore(baseTraits));

  return {
    ...baseTraits,
    rarityTier,
  };
}

function extractSolBalance(balancesRes: any): number {
  const nativeLamports =
    Number(balancesRes?.nativeBalance?.lamports ?? balancesRes?.lamports ?? 0);
  return nativeLamports / SOL_LAMPORTS;
}

function getSolBonus(solBalance: number): number {
  const thresholds = Object.values(SCORING.SOL_BALANCE_THRESHOLDS).sort(
    (a, b) => b.amount - a.amount
  );
  for (const threshold of thresholds) {
    if (solBalance >= threshold.amount) {
      return threshold.bonus;
    }
  }
  return 0;
}

function detectBlueChipCollections(nfts: any[]): boolean {
  return nfts.some((nft) => {
    const candidates = [
      nft?.collection?.name,
      nft?.collection?.family,
      nft?.content?.metadata?.collection?.name,
      nft?.name,
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());

    return BLUE_CHIP_COLLECTION_NAMES.some((name) =>
      candidates.some((candidate) => candidate.includes(name))
    );
  });
}

function detectDeFiPresence(tokens: NormalizedToken[], nfts: any[], transactions: any[]): boolean {
  const hasLST = tokens.some(
    (token) => LST_MINT_VALUES.includes(token.mint) && token.normalizedAmount > 0
  );
  if (hasLST) return true;

  const hasTokenHint = tokens.some((token) => {
    const text = `${token.symbol ?? ''} ${token.name ?? ''}`.toLowerCase();
    return DEFI_HINTS.some((hint) => text.includes(hint));
  });
  if (hasTokenHint) return true;

  const hasNftHint = nfts.some((nft) => {
    const text = `${nft?.collection?.name ?? ''} ${nft?.name ?? ''}`.toLowerCase();
    return DEFI_HINTS.some((hint) => text.includes(hint));
  });
  if (hasNftHint) return true;

  const hasTxHint = transactions.some((tx) => {
    const text = JSON.stringify(tx?.description ?? tx?.type ?? tx ?? '').toLowerCase();
    return DEFI_HINTS.some((hint) => text.includes(hint));
  });
  return hasTxHint;
}

function determineRarityTier(score: number): RarityTier {
  if (score >= RARITY_THRESHOLDS.MYTHIC) return 'mythic';
  if (score >= RARITY_THRESHOLDS.LEGENDARY) return 'legendary';
  if (score >= RARITY_THRESHOLDS.EPIC) return 'epic';
  if (score >= RARITY_THRESHOLDS.RARE) return 'rare';
  return 'common';
}
