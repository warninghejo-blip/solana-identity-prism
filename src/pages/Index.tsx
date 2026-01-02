import { useEffect, useMemo, useState, useCallback } from 'react';
import { SolarSystem } from '@/components/SolarSystem';
import { useWalletData } from '@/hooks/useWalletData';
import { usePhantomWallet } from '@/hooks/usePhantomWallet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2,
  PlugZap,
  Sparkles,
  Shield,
  Star,
  Wallet,
  Timer,
  Coins,
  Orbit,
  AlertCircle,
} from 'lucide-react';
import { MINT_CONFIG } from '@/constants';

function shortenAddress(address?: string | null) {
  if (!address) return 'Demo Wallet';
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

const Index = () => {
  const [phase, setPhase] = useState<'landing' | 'warping' | 'explorer'>('landing');
  const [manualAddress, setManualAddress] = useState<string | undefined>();
  const [formAddress, setFormAddress] = useState('');
  const [warpKey, setWarpKey] = useState(0);

  const {
    address: connectedAddress,
    isConnected,
    isConnecting,
    hasProvider,
    error: walletError,
    connectWallet,
    disconnectWallet,
  } = usePhantomWallet();

  const resolvedAddress = isConnected ? connectedAddress ?? undefined : manualAddress;
  const walletData = useWalletData(resolvedAddress);
  const { traits, score, address, isLoading, error: dataError } = walletData;
  const displayAddress = useMemo(() => shortenAddress(address), [address]);
  const combinedError = walletError ?? dataError;
  const showExplorer = phase === 'explorer';
  const warpActive = phase === 'warping';

  const triggerWarp = useCallback(() => {
    setWarpKey((prev) => prev + 1);
    setPhase('warping');
  }, []);

  const handleManualExplore = () => {
    const trimmed = formAddress.trim();
    if (!trimmed) return;
    setManualAddress(trimmed);
    triggerWarp();
  };

  useEffect(() => {
    if (isConnected) {
      setManualAddress(undefined);
      triggerWarp();
    } else {
      setPhase('landing');
    }
  }, [isConnected, triggerWarp]);

  useEffect(() => {
    if (phase === 'warping') {
      const timeout = setTimeout(() => setPhase('explorer'), 1800);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [phase]);

  const achievements = useMemo(
    () => [
      { label: 'Seeker Genesis', active: traits.hasSeeker, detail: 'Origin starholder', icon: Sparkles },
      { label: 'Chapter 2 Preorder', active: traits.hasPreorder, detail: 'Chronicle aligned', icon: Orbit },
      { label: 'Combo Holder', active: traits.hasCombo, detail: 'Binary unlock', icon: Star },
      { label: 'Blue Chip Signal', active: traits.isBlueChip, detail: 'Prestige collections', icon: Shield },
      { label: 'DeFi King', active: traits.isDeFiKing, detail: 'Power liquidity', icon: Coins },
      { label: 'Meme Lord', active: traits.isMemeLord, detail: 'Culture amplifier', icon: Sparkles },
    ],
    [traits],
  );

  const statCards = useMemo(
    () => [
      {
        label: 'SOL Balance',
        value: `${traits.solBalance.toFixed(2)} SOL`,
        hint: traits.solBonusApplied ? `+${traits.solBonusApplied} bonus` : 'No bonus yet',
      },
      {
        label: 'Wallet Age',
        value: `${traits.walletAgeYears} yrs`,
        hint: traits.walletAgeBonus ? `+${traits.walletAgeBonus} pts` : 'New wallet',
      },
      {
        label: 'Activity (30d)',
        value: `${traits.avgTxPerDay30d.toFixed(1)}/day`,
        hint: traits.hyperactiveDegen ? 'Hyperactive Degen' : 'Calibrating',
      },
      {
        label: 'Dormancy',
        value: traits.daysSinceLastTx ? `${Math.floor(traits.daysSinceLastTx)} days` : 'Fresh',
        hint: traits.diamondHands ? 'Diamond hands' : 'Live feed',
      },
    ],
    [traits],
  );

  const [mintState, setMintState] = useState<'idle' | 'minting' | 'success' | 'error'>('idle');
  const [mintError, setMintError] = useState<string | null>(null);

  const handleMint = useCallback(() => {
    setMintState('minting');
    // Add minting logic here
    setTimeout(() => {
      setMintState('success');
    }, 2000);
  }, []);

  return (
    <div className="identity-shell">
      <SolarSystem traits={traits} walletAddress={address} />
      <div className="identity-gradient" />

      <div className="identity-hud">
        <div className="hud-top">
          <div className="brand-mark">
            <div className="brand-emblem">
              <Sparkles className="h-4 w-4 text-cyan-200" />
            </div>
            <div>
              <p className="heading">Identity Prism</p>
              <p className="subheading">Stellar Intelligence Bureau</p>
            </div>
          </div>
          <Badge variant="outline" className="badge-ambient">
            Scoring 3.0
          </Badge>
        </div>

        {showExplorer ? (
          <ExplorerHud
            score={score}
            addressLabel={displayAddress}
            isLoading={isLoading}
            traits={traits}
            onDisconnect={disconnectWallet}
            isConnected={isConnected}
          />
        ) : (
          <LandingOverlay
            formAddress={formAddress}
            setFormAddress={setFormAddress}
            onExplore={handleManualExplore}
            connectWallet={connectWallet}
            isConnecting={isConnecting}
            hasProvider={hasProvider}
            combinedError={combinedError}
          />
        )}
      </div>

      {warpActive && <WarpOverlay key={warpKey} />}

      {showExplorer && (
        <>
          <GlassSidebar
            achievements={achievements}
            statCards={statCards}
            score={walletData?.score ?? 0}
            isLoading={walletData?.isLoading || false}
            traits={walletData?.traits}
            mintState={mintState}
            mintError={mintError}
            onMint={handleMint}
            isConnected={isConnected}
          />
          {walletData?.error && (
            <div className="error-banner">
              <AlertCircle className="h-4 w-4" />
              <span>{walletData.error}</span>
            </div>
          )}
          <SignalFooter traits={traits} />
        </>
      )}
    </div>
  );
};

export default Index;

interface LandingOverlayProps {
  formAddress: string;
  setFormAddress: (value: string) => void;
  onExplore: () => void;
  connectWallet: () => Promise<void>;
  isConnecting: boolean;
  hasProvider: boolean;
  combinedError: string | null;
}

function LandingOverlay({
  formAddress,
  setFormAddress,
  onExplore,
  connectWallet,
  isConnecting,
  hasProvider,
  combinedError,
}: LandingOverlayProps) {
  return (
    <div className="landing-wrap">
      <div className="landing-grid" />
      <div className="landing-card glass-panel">
        <p className="landing-eyebrow">Initiate Stellar Scan</p>
        <h1 className="landing-title">Decode your cosmic signature.</h1>
        <p className="landing-copy">
          Identity Prism triangulates your on-chain gravity to generate a bespoke solar system.
          Connect or input any wallet to warp into the explorer deck.
        </p>
        <div className="landing-actions">
          <Input
            value={formAddress}
            onChange={(event) => setFormAddress(event.target.value)}
            placeholder="Enter Solana address"
            className="landing-input"
          />
          <Button size="lg" className="landing-explore" onClick={onExplore} disabled={!formAddress.trim()}>
            <Sparkles className="mr-2 h-4 w-4" />
            Warp to Address
          </Button>
        </div>
        <div className="landing-divider">or</div>
        {!hasProvider ? (
          <Button asChild size="lg" variant="outline" className="landing-connect outline">
            <a href="https://phantom.app/download" target="_blank" rel="noreferrer">
              <PlugZap className="mr-2 h-4 w-4" />
              Install Phantom
            </a>
          </Button>
        ) : (
          <Button size="lg" variant="secondary" onClick={connectWallet} disabled={isConnecting}>
            {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
            {isConnecting ? 'Establishing link…' : 'Connect Phantom'}
          </Button>
        )}
        {combinedError && <p className="landing-error">{combinedError}</p>}
        <div className="landing-tags">
          <span>Nova Bridge Visuals</span>
          <span>Binary Star Detection</span>
          <span>Mythic Nebulae</span>
        </div>
      </div>
    </div>
  );
}

interface ExplorerHudProps {
  score: number;
  addressLabel: string;
  isLoading: boolean;
  traits: ReturnType<typeof useWalletData>['traits'];
  onDisconnect: () => void;
  isConnected: boolean;
}

function ExplorerHud({ score, addressLabel, isLoading, traits, onDisconnect, isConnected }: ExplorerHudProps) {
  return (
    <div className="explorer-hud glass-panel">
      <div className="hud-score">
        <p className="hud-label">Identity Score</p>
        <p className="hud-value">{isLoading ? '…' : score}</p>
        <p className="hud-address">{addressLabel}</p>
      </div>
      <div className="hud-badges">
        {traits.hasSeeker && <HudBadge label="+50 Seeker Genesis" tone="cyan" />}
        {traits.hasPreorder && <HudBadge label="+30 Chapter 2" tone="gold" />}
        {traits.hasCombo && <HudBadge label="+20 Nova Combo" tone="aurora" />}
        {traits.isBlueChip && <HudBadge label="+100 Blue Chip" tone="purple" />}
      </div>
      <div className="hud-controls">
        <div className="chip">
          <Wallet className="h-4 w-4 text-white/70" />
          <span>{traits.uniqueTokenCount} tokens</span>
        </div>
        <div className="chip">
          <Star className="h-4 w-4 text-white/70" />
          <span>{traits.nftCount} NFTs</span>
        </div>
        <div className="chip">
          <Timer className="h-4 w-4 text-white/70" />
          <span>{traits.txCount.toLocaleString()} tx</span>
        </div>
        {isConnected && (
          <Button variant="ghost" size="sm" className="text-white/70 hover:text-white" onClick={onDisconnect}>
            Disconnect
          </Button>
        )}
      </div>
    </div>
  );
}

interface GlassSidebarProps {
  achievements: {
    label: string;
    active: boolean;
    detail: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
  statCards: { label: string; value: string; hint: string }[];
  score: number;
  isLoading: boolean;
  traits: ReturnType<typeof useWalletData>['traits'];
  mintState: 'idle' | 'minting' | 'success' | 'error';
  mintError: string | null;
  onMint: () => void;
  isConnected: boolean;
}

function GlassSidebar({
  achievements,
  statCards,
  score,
  isLoading,
  traits,
  mintState,
  mintError,
  onMint,
  isConnected,
}: GlassSidebarProps) {
  return (
    <aside className="glass-sidebar glass-panel">
      <div className="sidebar-heading">
        <p>Explorer Status</p>
        <span>{isLoading ? 'Syncing...' : 'Live'}</span>
      </div>

      <div className="sidebar-score">
        <p className="label">Score Vector</p>
        <p className="value">{isLoading ? '…' : score}</p>
        <span className="rarity-chip">{traits.rarityTier.toUpperCase()}</span>
      </div>

      <div className="sidebar-section">
        <p className="label">Achievements</p>
        <div className="sidebar-list">
          {achievements.map(({ label, active, detail, icon: Icon }) => (
            <div key={label} className={`achievement-card ${active ? 'active' : ''}`}>
              <div className="achievement-icon">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p>{label}</p>
                <span>{detail}</span>
              </div>
              <div className={`status-dot ${active ? 'on' : 'off'}`} />
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-section">
        <div className="mint-control">
          <Button
            size="lg"
            variant="secondary"
            onClick={onMint}
            disabled={mintState === 'minting' || isLoading || !isConnected}
            className="mint-button"
          >
            {mintState === 'idle' && <span>Mint Identity Prism</span>}
            {mintState === 'minting' && <Loader2 className="h-4 w-4 animate-spin" />}
            {mintState === 'success' && <span>✓ Minted!</span>}
            {mintState === 'error' && <span>Error</span>}
          </Button>
          {mintState === 'error' && mintError && (
            <p className="mint-error">{mintError}</p>
          )}
          <p className="mint-hint">
            {MINT_CONFIG.PRICE_SOL} SOL • Metadata includes all traits
          </p>
        </div>
      </div>

      <div className="sidebar-section">
        <p className="label">Vitals</p>
        <div className="stat-grid">
          {statCards.map((card) => (
            <div key={card.label} className="stat-card">
              <p>{card.label}</p>
              <h4>{card.value}</h4>
              <span>{card.hint}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function HudBadge({ label, tone }: { label: string; tone: 'cyan' | 'gold' | 'aurora' | 'purple' }) {
  return <span className={`hud-badge hud-badge-${tone}`}>{label}</span>;
}

function SignalFooter({ traits }: { traits: ReturnType<typeof useWalletData>['traits'] }) {
  const highlights = [
    `${Math.min(Math.floor(traits.uniqueTokenCount / 10), 10)} Planets`,
    `${Math.floor(traits.nftCount / 50)} Moons`,
    traits.hasCombo ? 'Binary Star Active' : 'Solo Sun',
    traits.isMemeLord ? 'Meme Lord Resonance' : 'Awaiting Meme Signal',
  ];

  return (
    <div className="signal-footer glass-panel">
      {highlights.map((highlight) => (
        <span key={highlight}>{highlight}</span>
      ))}
    </div>
  );
}

function WarpOverlay() {
  return (
    <div className="warp-overlay">
      <div className="warp-core" />
      {Array.from({ length: 15 }).map((_, index) => (
        <div key={index} className="warp-line" style={{ left: `${(index / 15) * 100}%` }} />
      ))}
    </div>
  );
}
