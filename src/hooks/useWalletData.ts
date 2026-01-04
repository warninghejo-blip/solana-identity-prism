import { useEffect, useState } from "react";
import {
  HELIUS_CONFIG,
  MEME_COIN_MINTS,
  TOKEN_ADDRESSES,
  BLUE_CHIP_COLLECTION_NAMES,
  DEFI_POSITION_HINTS,
  LST_MINTS,
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
  if (traits.hasSeeker) score += 200;
  if (traits.hasPreorder) score += 150;
  if (traits.hasCombo) score += 200;
  if (traits.isBlueChip) score += 100;
  if (traits.isMemeLord) score += 70;
  if (traits.isDeFiKing) score += 70;
  score += (traits.solBonusApplied || 0);
  score += (traits.walletAgeBonus || 0);
  score += Math.min((traits.txCount || 0) * 0.5, 200);
  return Math.round(score);
}

const SOL_LAMPORTS = 1_000_000_000;
const DEMO_WALLET_ADDRESS = "0xDemo...Wallet";
const MEME_SYMBOLS = Object.keys(MEME_COIN_MINTS) as (keyof typeof MEME_COIN_MINTS)[];
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
        const avgTxPerDay30d = txCount / 30;

        // 2. DAS API - Enhanced Asset Fetching
        const response = await fetch(HELIUS_CONFIG.RPC_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "prism-scan",
            method: "getAssetsByOwner",
            params: {
              ownerAddress: address,
              page: 1,
              limit: 1000,
              displayOptions: { 
                showCollectionMetadata: true, 
                showAuthorities: true,
                showMetadata: true,
                showFungible: true
              },
            },
          }),
        });
        
        const { result } = await response.json();
        const assets = result?.items || [];
        const totalAssetsCount = assets.length;
        
        console.log(`%c[Scan] DAS: ${totalAssetsCount} total assets found.`, "color: #22d3ee; font-weight: bold;");

        let nftCount = 0;
        let uniqueTokenCount = 0;
        let hasSeeker = false;
        let hasPreorder = false;
        let isBlueChip = false;
        let isDeFiKing = false;

        // 3. Analysis Loop
        assets.forEach((asset: any) => {
          const content = asset.content || {};
          const metadata = content.metadata || asset.content?.metadata || {};
          const name = (metadata.name || content.metadata?.name || asset.id || "").toLowerCase();
          const symbol = (metadata.symbol || content.metadata?.symbol || "").toLowerCase();
          
          const mint = asset.id;
          const isPreorderMint = mint === TOKEN_ADDRESSES.CHAPTER2_PREORDER;
          const collection = asset.grouping?.find((g: any) => g.group_key === "collection")?.group_value;
          const isSeekerCollection = collection === TOKEN_ADDRESSES.SEEKER_GENESIS_COLLECTION;

          const auths = (asset.authorities || []).map((a: any) => a.address);
          const creators = (metadata.creators || asset.creators || content.metadata?.creators || []).map((c: any) => typeof c === 'string' ? c : c.address);

          // Seeker Detection
          if (isSeekerCollection || auths.includes(TOKEN_ADDRESSES.SEEKER_MINT_AUTHORITY) || creators.includes(TOKEN_ADDRESSES.SEEKER_MINT_AUTHORITY) || name.includes("seeker")) {
            console.log(`%c[!!!] SEEKER DETECTED: ${name}`, "color: #22d3ee; font-weight: 900;");
            hasSeeker = true;
          }

          // Preorder Detection
          if (isPreorderMint || (name.includes("chapter") && name.includes("2") && name.includes("preorder"))) {
            console.log(`%c[!!!] PREORDER DETECTED: ${name}`, "color: #fbbf24; font-weight: 900;");
            hasPreorder = true;
          }

          // NFT Logic (Decimals 0)
          const iface = (asset.interface || "").toUpperCase();
          const tokenInfo = asset.token_info || {};
          const decimals = tokenInfo.decimals ?? (isFungibleAsset(asset) ? 9 : 0);
          
          const isExplicitNFT = iface.includes("NFT") || iface.includes("PROGRAMMABLE") || iface === "CUSTOM" || asset.compression?.compressed === true;
          const isLikelyNFT = decimals === 0 && (metadata.name || content.links?.image || asset.grouping?.length > 0);
          const isKnownFungible = iface === "FUNGIBLETOKEN" || iface === "FUNGIBLEASSET" || (tokenInfo.supply > 1 && decimals > 0);

          if (isExplicitNFT || (isLikelyNFT && !isKnownFungible)) {
            nftCount++;
            if (BLUE_CHIP_COLLECTION_NAMES.some(bc => name.includes(bc) || (collection && collection.toLowerCase().includes(bc)))) {
              isBlueChip = true;
            }
          } else {
            uniqueTokenCount++;
          }

          if (DEFI_POSITION_HINTS.some(hint => name.includes(hint.toLowerCase()))) {
            isDeFiKing = true;
          }
          if (LST_ADDRESSES.includes(mint)) {
            isDeFiKing = true;
          }
        });

        // 4. SPL Fallback Check
        tokenAccountsResponse.value.forEach((ta: any) => {
          const info = ta.account.data.parsed.info;
          if (info.tokenAmount.uiAmount > 0) {
            const mint = info.mint;
            if (mint === TOKEN_ADDRESSES.CHAPTER2_PREORDER) hasPreorder = true;
            if (LST_ADDRESSES.includes(mint)) isDeFiKing = true;
            if (!assets.some((a: any) => a.id === mint)) {
              uniqueTokenCount++;
              // If it has decimals 0 and was missed, it's an NFT
              if (info.tokenAmount.decimals === 0) nftCount++;
            }
          }
        });

        const hasCombo = hasSeeker && hasPreorder;
        const memeCoinsHeld = MEME_SYMBOLS.filter((s) =>
          assets.some((a: any) => a.id === MEME_COIN_MINTS[s]) ||
          tokenAccountsResponse.value.some((ta: any) => ta.account.data.parsed.info.mint === MEME_COIN_MINTS[s])
        );
        const isMemeLord = memeCoinsHeld.length > 3;

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

function isFungibleAsset(asset: any): boolean {
  const iface = (asset.interface || "").toUpperCase();
  if (iface === "FUNGIBLETOKEN" || iface === "FUNGIBLEASSET") return true;
  const supply = asset.token_info?.supply || 0;
  const decimals = asset.token_info?.decimals || 0;
  return decimals > 0 || supply > 1;
}

function buildDisconnectedWalletData(): WalletData {
  return { address: DEMO_WALLET_ADDRESS, traits: null, score: 0, isLoading: false, error: null };
}
