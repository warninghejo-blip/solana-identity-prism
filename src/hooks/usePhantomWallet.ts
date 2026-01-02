import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PublicKey, Transaction } from '@solana/web3.js';

type PhantomEvent = 'connect' | 'disconnect' | 'accountChanged';

export interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: PublicKey;
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  on: (event: PhantomEvent, handler: (...args: any[]) => void) => void;
  off: (event: PhantomEvent, handler: (...args: any[]) => void) => void;
  signAndSendTransaction?: (transaction: Transaction) => Promise<{ signature: string }>;
  signTransaction?: (transaction: Transaction) => Promise<Transaction>;
}

const getProvider = (): PhantomProvider | null => {
  if (typeof window === 'undefined') return null;
  const anyWindow = window as Window & { solana?: PhantomProvider };
  if (anyWindow?.solana?.isPhantom) {
    return anyWindow.solana;
  }
  return null;
};

export interface PhantomWalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  hasProvider: boolean;
  error: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  provider: PhantomProvider | null;
}

export function usePhantomWallet(): PhantomWalletState {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const provider = useMemo(() => getProvider(), []);

  const syncAddress = useCallback(
    (pubkey?: PublicKey) => {
      if (pubkey) {
        setAddress(pubkey.toBase58());
      } else {
        setAddress(null);
      }
    },
    []
  );

  const connectWallet = useCallback(async () => {
    if (!provider) {
      setError('Phantom wallet not detected');
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);
      const response = await provider.connect();
      syncAddress(response?.publicKey ?? provider.publicKey);
    } catch (err) {
      if ((err as any)?.code === 4001) {
        setError('Connection request was rejected');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to connect wallet');
      }
    } finally {
      setIsConnecting(false);
    }
  }, [provider, syncAddress]);

  const disconnectWallet = useCallback(async () => {
    if (!provider) return;
    try {
      await provider.disconnect();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect wallet');
    } finally {
      setAddress(null);
    }
  }, [provider]);

  useEffect(() => {
    if (!provider) return;

    const handleConnect = (pubkey: PublicKey) => {
      syncAddress(pubkey ?? provider.publicKey);
      setError(null);
    };

    const handleDisconnect = () => {
      syncAddress(null);
    };

    provider.on('connect', handleConnect);
    provider.on('disconnect', handleDisconnect);
    provider.on('accountChanged', handleConnect);

    provider.connect({ onlyIfTrusted: true }).catch(() => {
      // Ignore silently; user not connected yet.
    });

    if (provider.publicKey) {
      syncAddress(provider.publicKey);
    }

    return () => {
      provider.off('connect', handleConnect);
      provider.off('disconnect', handleDisconnect);
      provider.off('accountChanged', handleConnect);
    };
  }, [provider, syncAddress]);

  return {
    address,
    isConnected: Boolean(address),
    isConnecting,
    hasProvider: Boolean(provider),
    error,
    connectWallet,
    disconnectWallet,
    provider,
  };
}
