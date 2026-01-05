import { useEffect, useState } from "react";
import {
  HELIUS_CONFIG,
  MEME_COIN_MINTS,
  MEME_COIN_PRICES_USD,
  TOKEN_ADDRESSES,
  BLUE_CHIP_COLLECTION_NAMES,
  BLUE_CHIP_COLLECTIONS,
  DEFI_POSITION_HINTS,
  LST_MINTS,
  SCORING,
} from "@/constants";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, ConfirmedSignatureInfo } from "@solana/web3.js";

export type RarityTier = "common" | "rare" | "epic" | "legendary" | "mythic";

export interface WalletTraits {
  hasSeeker: boolean;
  hasPreorder: boolean;
  hasCombo: boolean;
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
  walletAgeDays: number;
  walletAgeBonus: number;
  rarityTier: RarityTier;
  totalAssetsCount: number;
  solTier: "shrimp" | "dolphin" | "whale" | null;
}

export interface WalletData {
  address: string;
  score: number;
  traits: WalletTraits | null;
  isLoading: boolean;
  error: string | null;
}

export function calculateScore(traits: WalletTraits): number {
  let score = 0;
  
  // 1. SOL Balance (Max 75)
  const sol = traits.solBalance;
  if (sol >= 5) score += SCORING.SOL_BALANCE_THRESHOLDS.LEGEND.bonus;
  else if (sol >= 1) score += SCORING.SOL_BALANCE_THRESHOLDS.MAJOR.bonus;
  else if (sol >= 0.1) score += SCORING.SOL_BALANCE_THRESHOLDS.MINOR.bonus;
  
  // 2. Wallet Age (Max 150)
  const age = traits.walletAgeDays;
  if (age > 365) score += SCORING.WALLET_AGE_MAX;
  else if (age > 180) score += SCORING.WALLET_AGE_PER_YEAR * 2;
  else if (age > 90) score += SCORING.WALLET_AGE_PER_YEAR;
  else if (age > 30) score += SCORING.WALLET_AGE_PER_YEAR / 2;
  
  // 3. Transaction Count (Max 100)
  const tx = traits.txCount;
  const txBonus = Math.min(tx * SCORING.TX_COUNT_MULTIPLIER, SCORING.TX_COUNT_CAP);
  score += txBonus;
  
  // 4. NFT Count (Max 100)
  const nfts = traits.nftCount;
  if (nfts > 100) score += 100;
  else if (nfts > 50) score += 75;
  else if (nfts > 10) score += 40;
  
  // 5. OG Status (Max 550)
  if (traits.hasSeeker) score += SCORING.SEEKER_GENESIS_BONUS;
  if (traits.hasPreorder) score += SCORING.CHAPTER2_PREORDER_BONUS;
  if (traits.hasCombo) score += SCORING.COMBO_BONUS;
  
  // 6. Behavioral Traits (Max 210)
  if (traits.isBlueChip) score += SCORING.BLUE_CHIP_BONUS;
  if (traits.isDeFiKing) score += SCORING.DEFI_KING_BONUS;
  if (traits.diamondHands) score += SCORING.DIAMOND_HANDS_BONUS;
  if (traits.hyperactiveDegen) score += SCORING.HYPERACTIVE_BONUS;
  if (traits.isMemeLord) score += SCORING.MEME_LORD_BONUS;
  
  // Log breakdown for debugging
  console.log(`%c[Scoring] Total: ${Math.round(score)} | SOL: ${sol} | Age: ${age}d | Tx: ${tx} | NFTs: ${nfts} | Seeker: ${traits.hasSeeker} | Preorder: ${traits.hasPreorder} | Combo: ${traits.hasCombo}`, "color: #a855f7; font-weight: bold;");
  
  return Math.min(Math.round(score), SCORING.MAX_SCORE);
}

const SOL_LAMPORTS = 1_000_000_000;
const DEMO_WALLET_ADDRESS = "0xDemo...Wallet";
const MEME_MINT_LOOKUP: Record<string, keyof typeof MEME_COIN_MINTS> = Object.entries(MEME_COIN_MINTS).reduce(
  (acc, [symbol, mint]) => {
    acc[mint] = symbol as keyof typeof MEME_COIN_MINTS;
    return acc;
  },
  {} as Record<string, keyof typeof MEME_COIN_MINTS>
);
const LST_ADDRESSES = Object.values(LST_MINTS);

export function useWalletData(address?: string) {
  const { connection } = useConnection();
  const [walletData, setWalletData] = useState<WalletData>(buildDisconnectedWalletData());

  useEffect(() => {
    if (!address || address === DEMO_WALLET_ADDRESS) {
      setWalletData(buildDisconnectedWalletData());
      return;
    }

    let cancelled = false;

    const fetchData = async () => {
      try {
        if (!HELIUS_CONFIG.API_KEY) {
          console.error("CRITICAL: Helius API Key is missing.");
          setWalletData((prev) => ({ ...prev, isLoading: false, error: "API Key Missing" }));
          return;
        }

        console.log("%c--- 🚀 INITIATING COSMIC SCAN v3.0 (SUPERNOVA) ---", "color: #22d3ee; font-weight: bold; font-size: 14px;");
        const publicKey = new PublicKey(address);
        setWalletData((prev) => ({ ...prev, address, isLoading: true, error: null }));

        // 1. Transaction Fetching (Aggressive - up to 10k txs)
        const fetchSignatures = async (pubkey: PublicKey) => {
          let allSignatures: ConfirmedSignatureInfo[] = [];
          let lastSig: string | undefined = undefined;
          
          for (let i = 0; i < 10; i++) { // Max 10,000 transactions
            try {
              const sigs: ConfirmedSignatureInfo[] = await connection.getSignaturesForAddress(pubkey, { 
                limit: 1000,
                before: lastSig 
              });
              if (sigs.length === 0) break;
              allSignatures = [...allSignatures, ...sigs];
              lastSig = sigs[sigs.length - 1].signature;
              if (sigs.length < 1000) break;
            } catch (e) {
              console.warn("Signature fetch error at page", i, e);
              break;
            }
          }
          return allSignatures;
        };

        const [balance, signatures, tokenAccountsResponse] = await Promise.all([
          connection.getBalance(publicKey),
          fetchSignatures(publicKey),
          connection.getParsedTokenAccountsByOwner(publicKey, {
            programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
          })
        ]);

        const solBalance = balance / SOL_LAMPORTS;
        const txCount = signatures.length;
        let firstTxDate = new Date();
        if (signatures.length > 0) {
          const oldest = signatures[signatures.length - 1];
          if (oldest.blockTime) firstTxDate = new Date(oldest.blockTime * 1000);
        }
        const walletAgeDays = Math.floor((Date.now() - firstTxDate.getTime()) / (1000 * 60 * 60 * 24));
        const avgTxPerDay30d = txCount / Math.max(1, walletAgeDays);

        // 2. DAS API - Fetch Assets via Helius
        console.log(`%c[DAS Request] Fetching assets for ${address}`, "color: #fbbf24;");
        
        const response = await fetch(HELIUS_CONFIG.RPC_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "identity-prism-scan",
            method: "getAssetsByOwner",
            params: {
              ownerAddress: address,
              page: 1,
              limit: 1000,
              displayOptions: {
                showCollectionMetadata: true
              }
            }
          }),
        });
        
        if (!response.ok) {
          console.error(`%c[DAS Error] HTTP ${response.status}`, "color: #ef4444;");
          throw new Error(`DAS API returned ${response.status}`);
        }

        const dasResponse = await response.json() as { result?: { items: DASAsset[] }, error?: { message?: string } };
        
        if (dasResponse.error) {
          console.error(`%c[DAS Error]`, "color: #ef4444;", dasResponse.error);
          throw new Error(dasResponse.error.message || "DAS API error");
        }
        
        const PREORDER_MINT = "2DMMamkkxQ6zDMBtkFp8KH7FoWzBMBA1CGTYwom4QH6Z";
        const PREORDER_COLLECTION = "3uejyD3ZwHDGwT8n6KctN3Stnjn9Nih79oXES9VqA38D";
        
        interface DASAsset {
          id: string;
          content?: {
            metadata?: {
              name?: string;
              symbol?: string;
            };
            links?: {
              image?: string;
            };
          };
          authorities?: { address: string }[];
          creators?: { address: string }[];
          grouping?: { group_key: string; group_value: string }[];
          interface?: string;
          token_info?: {
            decimals?: number;
            supply?: number;
            balance?: number | string;
            amount?: number | string;
          };
          compression?: {
            compressed: boolean;
          };
        }

        const assets = (dasResponse.result?.items as DASAsset[]) || [];
        const totalAssetsCount = assets.length;
        
        console.log(`%c[DAS Success] ${totalAssetsCount} assets found. Performing Nuclear Scan...`, "color: #22d3ee; font-weight: bold;");
        
        // NUCLEAR DEBUG: Print Name and Symbol of ALL 355 assets as requested
        console.log("%c[Nuclear Debug] FULL ASSET SCAN (Name & Symbol):", "color: #f472b6; font-weight: bold;");
        assets.forEach((a, i) => {
          const name = a.content?.metadata?.name || 'N/A';
          const symbol = a.content?.metadata?.symbol || 'N/A';
          console.log(`[${i}] ${name} (${symbol}) | ID: ${a.id}`);
        });
        
        const foundAsset = assets.find((a: DASAsset) => {
          const id = (a.id || "");
          const name = (a.content?.metadata?.name || "");
          const grouping = a.grouping || [];
          
          const isPreorderId = id === PREORDER_MINT;
          const isPreorderName = name.includes("Chapter 2") || name.includes("Seeker Preorder");
          const isPreorderGroup = grouping.some(g => g.group_value === PREORDER_COLLECTION);

          return isPreorderId || isPreorderName || isPreorderGroup;
        });

        if (foundAsset) {
          console.log("%c[!!!] NUCLEAR MATCH: PREORDER ASSET FOUND!", "color: #10b981; font-weight: bold;", foundAsset);
        } else {
          console.log("%c[???] NUCLEAR SCAN: NO PREORDER ASSET FOUND", "color: #ef4444;");
        }

        let nftCount = 0;
        let uniqueTokenCount = 0;
        let hasSeeker = false;
        let hasPreorder = !!foundAsset; 
        let isBlueChip = false;
        let hasLstExposure = false;
        let defiProtocolExposure = false;
        let memeValueUSD = 0;
        const memeHoldingsSet = new Set<string>();

        // 3. Analysis Loop
        assets.forEach((asset: DASAsset) => {
          const content = asset.content || {};
          const metadata = content.metadata || {};
          const rawName = (metadata.name || content.metadata?.name || asset.id || "");
          const name = rawName.toLowerCase();
          
          const mint = asset.id;
          
          // Seeker Genesis Detection
          const grouping = asset.grouping || [];
          const collectionGroup = grouping.find((g) => g.group_key === "collection");
          const authorities = asset.authorities || [];
          const creators = asset.creators || [];
          
          const isSeekerGenesis = 
            collectionGroup?.group_value === TOKEN_ADDRESSES.SEEKER_GENESIS_COLLECTION ||
            authorities.some((auth) => auth.address === TOKEN_ADDRESSES.SEEKER_MINT_AUTHORITY) ||
            creators.some((c) => c.address === TOKEN_ADDRESSES.SEEKER_MINT_AUTHORITY) ||
            (name.includes("seeker") && (name.includes("genesis") || name.includes("citizen")));
          
          if (isSeekerGenesis) hasSeeker = true;

          // Extra Chapter 2 Preorder check within the loop (Nuclear)
          const isChapter2Preorder = 
            mint === PREORDER_MINT ||
            (rawName.includes("Chapter 2") || rawName.includes("Seeker Preorder")) ||
            grouping.some(g => g.group_value === PREORDER_COLLECTION);

          if (isChapter2Preorder) hasPreorder = true;

          // NFT Logic (Decimals 0)
          const iface = (asset.interface || "").toUpperCase();
          const tokenInfo = asset.token_info || {};
          const decimals = tokenInfo.decimals ?? (isFungibleAsset(asset) ? 9 : 0);
          
          const isExplicitNFT = iface.includes("NFT") || iface.includes("PROGRAMMABLE") || iface === "CUSTOM" || asset.compression?.compressed === true;
          const isLikelyNFT = decimals === 0 && (metadata.name || content.links?.image || asset.grouping?.length > 0);
          const isKnownFungible = iface === "FUNGIBLETOKEN" || iface === "FUNGIBLEASSET" || ((tokenInfo.supply || 0) > 1 && decimals > 0);

          if (isExplicitNFT || (isLikelyNFT && !isKnownFungible)) {
            nftCount++;
            const collectionValue = collectionGroup?.group_value || "";
            if (BLUE_CHIP_COLLECTIONS.includes(collectionValue as typeof BLUE_CHIP_COLLECTIONS[number])) {
              isBlueChip = true;
            }
          } else {
            uniqueTokenCount++;
          }

          if (DEFI_POSITION_HINTS.some((hint) => name.includes(hint))) {
            defiProtocolExposure = true;
          }
          
          if (Object.values(LST_MINTS).some((m) => m === mint)) {
            hasLstExposure = true;
          }

          const memeSymbol = MEME_MINT_LOOKUP[mint];
          if (memeSymbol) {
            const balanceRaw = tokenInfo.balance ?? tokenInfo.amount ?? 0;
            const numericBalance = typeof balanceRaw === "number" ? balanceRaw : parseFloat(balanceRaw || "0");
            const uiAmount = decimals > 0 ? numericBalance / Math.pow(10, decimals) : numericBalance;
            if (uiAmount > 0) {
              memeHoldingsSet.add(memeSymbol);
              memeValueUSD += uiAmount * (MEME_COIN_PRICES_USD[memeSymbol] || 0);
            }
          }
        });

        // 4. SPL Fallback Check
        tokenAccountsResponse.value.forEach((ta: { 
          account: { 
            data: { 
              parsed: { 
                info: { 
                  mint: string; 
                  tokenAmount: { uiAmount: number; decimals: number } 
                } 
              } 
            } 
          } 
        }) => {
          const info = ta.account.data.parsed.info;
          if (info.tokenAmount.uiAmount > 0) {
            const mint = info.mint;
            const isPreorderMint = mint === TOKEN_ADDRESSES.CHAPTER2_PREORDER;
            if (isPreorderMint) hasPreorder = true;
            if (Object.values(LST_MINTS).some((m: string) => m === mint)) hasLstExposure = true;
            const memeSymbol = MEME_MINT_LOOKUP[mint];
            if (memeSymbol) {
              const amount = info.tokenAmount.uiAmount || 0;
              if (amount > 0) {
                memeHoldingsSet.add(memeSymbol);
                memeValueUSD += amount * (MEME_COIN_PRICES_USD[memeSymbol] || 0);
              }
            }
            if (!assets.some((a: { id: string }) => a.id === mint)) {
              uniqueTokenCount++;
              // If it has decimals 0 and was missed, it's an NFT
              if (info.tokenAmount.decimals === 0) {
                nftCount++;
                // Check if this missed asset is a Seeker/Preorder by mint address
                if (mint === "2DMMamkkxQ6zDMBtkFp8KH7FoWzBMBA1CGTYwom4QH6Z") hasPreorder = true;
              }
            }
          }
        });

        const hasCombo = hasSeeker && hasPreorder;
        const memeCoinsHeld = Array.from(memeHoldingsSet);
        const isMemeLord = memeValueUSD >= 10;
        const isDeFiKing = hasLstExposure || defiProtocolExposure;

        const solTier =
          solBalance >= 10 ? "whale" : solBalance >= 1 ? "dolphin" : solBalance >= 0.1 ? "shrimp" : null;

        const solBonusApplied = solBalance >= 5 ? 150 : solBalance >= 1 ? 70 : solBalance >= 0.1 ? 30 : 0;
        const walletAgeBonus = Math.min(Math.floor((walletAgeDays / 365) * 100), 300);

        const traits: WalletTraits = {
          hasSeeker, hasPreorder, hasCombo, isBlueChip, isDeFiKing,
          uniqueTokenCount, nftCount, txCount, memeCoinsHeld, isMemeLord,
          hyperactiveDegen: avgTxPerDay30d >= 8,
          diamondHands: walletAgeDays >= 60,
          avgTxPerDay30d, daysSinceLastTx: null,
          solBalance, solBonusApplied, walletAgeDays, walletAgeBonus,
          rarityTier: "common", totalAssetsCount,
          solTier,
        };

        const score = calculateScore(traits);
        traits.rarityTier = score >= 851 ? "mythic" : score >= 651 ? "legendary" : score >= 451 ? "epic" : score >= 201 ? "rare" : "common";

        if (cancelled) return;
        setWalletData({ address, traits, score, isLoading: false, error: null });
        console.log(`%c[Scan Final] NFTs: ${nftCount} | Tx: ${txCount} | Score: ${score}`, "color: #fff; background: #22d3ee; padding: 4px; border-radius: 4px;");

      } catch (error) {
        console.error("Scan Error:", error);
        if (cancelled) return;
        setWalletData({ address: address || "", traits: null, score: 0, isLoading: false, error: "Cosmic synchronization failed." });
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [address, connection]);

  return walletData;
}

function isFungibleAsset(asset: { interface?: string; token_info?: { supply?: number; decimals?: number } }): boolean {
  const iface = (asset.interface || "").toUpperCase();
  if (iface === "FUNGIBLETOKEN" || iface === "FUNGIBLEASSET") return true;
  const supply = asset.token_info?.supply || 0;
  const decimals = asset.token_info?.decimals || 0;
  return decimals > 0 || supply > 1;
}

function buildDisconnectedWalletData(): WalletData {
  return { address: DEMO_WALLET_ADDRESS, traits: null, score: 0, isLoading: false, error: null };
}
