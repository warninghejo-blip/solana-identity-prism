import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { HELIUS_CONFIG, MINT_CONFIG, TREASURY_ADDRESS } from '@/constants';
import type { WalletTraits } from '@/hooks/useWalletData';
import type { PhantomProvider } from '@/hooks/usePhantomWallet';

export interface MintMetadata {
  collection: string;
  network: string;
  score: number;
  rarity: WalletTraits['rarityTier'];
  traits: {
    seeker: boolean;
    preorder: boolean;
    combo: boolean;
    blueChip: boolean;
    memeLord: boolean;
    defiKing: boolean;
    hyperactive: boolean;
    diamondHands: boolean;
  };
  stats: {
    tokens: number;
    nfts: number;
    transactions: number;
    solBalance: number;
    walletAgeYears: number;
  };
  timestamp: string;
  address: string;
}

export interface MintIdentityPrismArgs {
  provider: PhantomProvider;
  address: string;
  traits: WalletTraits;
  score: number;
}

export interface MintIdentityPrismResult {
  signature: string;
  metadata: MintMetadata;
  metadataBase64: string;
}

function encodeBase64(value: string): string {
  if (typeof window !== 'undefined' && window.btoa) {
    return window.btoa(unescape(encodeURIComponent(value)));
  }
  return Buffer.from(value, 'utf-8').toString('base64');
}

export async function mintIdentityPrism({
  provider,
  address,
  traits,
  score,
}: MintIdentityPrismArgs): Promise<MintIdentityPrismResult> {
  if (!provider) {
    throw new Error('Wallet provider not available');
  }

  const connection = new Connection(HELIUS_CONFIG.RPC_URL, 'confirmed');
  const payer = provider.publicKey ?? new PublicKey(address);
  const treasury = new PublicKey(TREASURY_ADDRESS);
  const priceLamports = Math.round(MINT_CONFIG.PRICE_SOL * LAMPORTS_PER_SOL);

  const metadata: MintMetadata = {
    collection: MINT_CONFIG.COLLECTION,
    network: MINT_CONFIG.NETWORK,
    score,
    rarity: traits.rarityTier,
    traits: {
      seeker: traits.hasSeeker,
      preorder: traits.hasPreorder,
      combo: traits.hasCombo,
      blueChip: traits.isBlueChip,
      memeLord: traits.isMemeLord,
      defiKing: traits.isDeFiKing,
      hyperactive: traits.hyperactiveDegen,
      diamondHands: traits.diamondHands,
    },
    stats: {
      tokens: traits.uniqueTokenCount,
      nfts: traits.nftCount,
      transactions: traits.txCount,
      solBalance: traits.solBalance,
      walletAgeYears: traits.walletAgeYears,
    },
    timestamp: new Date().toISOString(),
    address,
  };

  const transferIx = SystemProgram.transfer({
    fromPubkey: payer,
    toPubkey: treasury,
    lamports: priceLamports,
  });

  const transaction = new Transaction().add(transferIx);
  transaction.feePayer = payer;
  const latestBlockhash = await connection.getLatestBlockhash('finalized');
  transaction.recentBlockhash = latestBlockhash.blockhash;

  let signature: string;
  if (provider.signAndSendTransaction) {
    const result = await provider.signAndSendTransaction(transaction);
    signature = result.signature;
  } else if (provider.signTransaction) {
    const signed = await provider.signTransaction(transaction);
    signature = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(
      {
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      },
      'confirmed'
    );
  } else {
    throw new Error('Wallet does not support transaction signing');
  }

  return {
    signature,
    metadata,
    metadataBase64: encodeBase64(JSON.stringify(metadata)),
  };
}
