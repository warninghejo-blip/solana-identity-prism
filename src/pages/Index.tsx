import { useEffect, useMemo, useState, useCallback } from "react";
import { SolarSystem } from "@/components/SolarSystem";
import { useWalletData } from "@/hooks/useWalletData";
import { usePhantomWallet } from "@/hooks/usePhantomWallet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  Loader2,
  Sparkles,
  AlertCircle,
  PlugZap,
  ArrowLeft,
  Trophy,
  Star,
  Globe,
  Moon,
  Database,
} from "lucide-react";

function shortenAddress(address?: string | null) {
  if (!address || address === "0xDemo...Wallet") return "Cosmic Explorer";
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

type ViewState = "landing" | "scanning" | "ready";

const Index = () => {
  const [manualAddress, setManualAddress] = useState<string | undefined>();
  const [formAddress, setFormAddress] = useState("");
  const [isWarping, setIsWarping] = useState(false);
  const [viewState, setViewState] = useState<ViewState>("landing");

  const {
    address: connectedAddress,
    isConnected,
    isConnecting,
    hasProvider,
    error: walletError,
    connectWallet,
  } = usePhantomWallet();

  const resolvedAddress = manualAddress || (isConnected ? connectedAddress : undefined) || undefined;
  const walletData = useWalletData(resolvedAddress);
  const { traits, score, address, isLoading, error: dataError } = walletData;
  const displayAddress = useMemo(() => shortenAddress(address), [address]);
  const combinedError = walletError ?? dataError;
  const isExplorerMode = Boolean(manualAddress);

  // Unified State Machine for UI
  useEffect(() => {
    if (!resolvedAddress) {
      setViewState("landing");
      return;
    }

    if (isWarping) {
      setViewState("scanning");
      return;
    }

    if (isLoading || !traits) {
      setViewState("scanning");
    } else {
      // Delay to ensure smooth transition
      const timer = setTimeout(() => setViewState("ready"), 500);
      return () => clearTimeout(timer);
    }
  }, [resolvedAddress, isWarping, isLoading, traits]);

  // Handle Wallet Changes
  useEffect(() => {
    if (isConnected && !manualAddress) {
      setIsWarping(true);
      setTimeout(() => setIsWarping(false), 2500);
    }
  }, [connectedAddress, isConnected]);

  const handleManualExplore = () => {
    const trimmed = formAddress.trim();
    if (!trimmed) return;
    setManualAddress(trimmed);
    setIsWarping(true);
    setTimeout(() => setIsWarping(false), 2500);
  };

  const [mintState, setMintState] = useState<"idle" | "minting" | "success" | "error">("idle");
  const handleMint = useCallback(() => {
    setMintState("minting");
    setTimeout(() => setMintState("success"), 2000);
  }, []);

  const celestialStats = useMemo(() => {
    const defaultStats = [
      { id: "stars", label: "STARS", value: 0, icon: <Star className="h-3 w-3 text-yellow-400" /> },
      { id: "planets", label: "PLANETS", value: 0, icon: <Globe className="h-3 w-3 text-cyan-400" /> },
      { id: "moons", label: "MOONS", value: 0, icon: <Moon className="h-3 w-3 text-slate-400" /> },
    ];
    if (!traits) return defaultStats;
    
    let stars = traits.hasCombo || traits.rarityTier === "mythic" || traits.rarityTier === "legendary" ? 2 : 1;
    let planetBase = Math.floor(traits.uniqueTokenCount / 10);
    let minPlanets = traits.rarityTier === "mythic" ? 8 : traits.rarityTier === "legendary" ? 6 : traits.rarityTier === "epic" ? 5 : traits.rarityTier === "rare" ? 4 : 1;
    let planets = Math.min(Math.max(minPlanets, planetBase), 10);
    let moonsPerPlanet = Math.min(Math.floor(traits.nftCount / 50), 4);
    let totalMoons = planets * moonsPerPlanet;

    return [
      { id: "stars", label: "STARS", value: stars, icon: <Star className="h-3 w-3 text-yellow-400" /> },
      { id: "planets", label: "PLANETS", value: planets, icon: <Globe className="h-3 w-3 text-cyan-400" /> },
      { id: "moons", label: "MOONS", value: totalMoons, icon: <Moon className="h-3 w-3 text-slate-400" /> },
    ];
  }, [traits]);

  const achievements = useMemo(() => {
    if (!traits) return [];
    const list = [];
    if (traits.hasCombo) list.push({ id: "og_combo", label: "OG COMBO" });
    if (traits.hasSeeker) list.push({ id: "seeker", label: "SEEKER GENESIS" });
    if (traits.hasPreorder) list.push({ id: "preorder", label: "PREORDER HODLER" });
    if (traits.diamondHands) list.push({ id: "diamond_hands", label: "DIAMOND HANDS" });
    if (traits.hyperactiveDegen) list.push({ id: "degen", label: "HYPERACTIVE" });
    if (traits.isMemeLord) list.push({ id: "meme_lord", label: "MEME LORD" });
    if (traits.isDeFiKing) list.push({ id: "defi_king", label: "DEFI KING" });
    if (traits.isBlueChip) list.push({ id: "whale", label: "WHALE" });
    return list;
  }, [traits]);

  const statCards = useMemo(() => {
    if (!traits) return [];
    return [
      { label: "SOL", value: `${traits.solBalance.toFixed(2)}` },
      { label: "AGE", value: `${traits.walletAgeDays}d` },
      { label: "TX/D", value: `${traits.avgTxPerDay30d.toFixed(1)}` },
      { label: "NFTs", value: traits.nftCount.toString() },
    ];
  }, [traits]);

  return (
    <div className="identity-shell">
      <SolarSystem traits={traits} walletAddress={address} isWarping={isWarping} />
      <div className="identity-gradient" />

      {viewState !== "ready" ? (
        <LandingOverlay
          formAddress={formAddress}
          setFormAddress={setFormAddress}
          onExplore={handleManualExplore}
          connectWallet={connectWallet}
          isConnecting={isConnecting}
          hasProvider={hasProvider}
          combinedError={combinedError}
          isScanning={viewState === "scanning"}
        />
      ) : (
        <>
          <nav className="top-nav-prism mobile-nav">
            <div className="nav-brand-box">
              <img src="/phav.png" alt="Identity Prism" className="h-8 w-8 object-contain mr-2" />
              <div className="celestial-stats-top hidden sm:flex">
                {celestialStats.map(stat => (
                  <div key={stat.id} className="top-stat-item">
                    <span className="stat-label">{stat.label}</span>
                    <div className="stat-val-row">
                      {stat.icon}
                      <span className="stat-val">{stat.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="nav-right">
              <div className="debug-asset-pill hidden md:flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full mr-4 opacity-50">
                <Database className="h-3 w-3" />
                <span className="text-[10px] font-bold text-white/60 uppercase">Assets: {traits?.totalAssetsCount || 0}</span>
              </div>
              <WalletMultiButton className="prism-wallet-btn compact" />
            </div>
          </nav>

          <div className="mobile-stats-overlay sm:hidden">
            {celestialStats.map(stat => (
              <div key={stat.id} className="mobile-stat-pill">
                {stat.icon}
                <span>{stat.value}</span>
              </div>
            ))}
          </div>

          <div className="mobile-hud-container">
            <aside className="prism-hud-bottom glass-panel">
              <div className="hud-header-compact">
                <div className="identity-info-row">
                  <div className="rank-badge-mini">
                    <span className={`tier-dot ${traits?.rarityTier || "common"}`} />
                    {traits?.rarityTier?.toUpperCase() || "SCANNING..."}
                  </div>
                  <span className="address-text-mini">{displayAddress}</span>
                </div>
                <div className="score-mini">
                  <span className="score-num-mini">{isLoading ? "…" : score}</span>
                  <span className="score-label-mini">IDENTITY SCORE</span>
                </div>
              </div>

              {achievements.length > 0 && (
                <div className="achievements-hud">
                  <div className="ach-label">
                    <Trophy className="h-3 w-3 mr-1" /> ACHIEVEMENTS
                  </div>
                  <div className="ach-grid">
                    {achievements.map(ach => (
                      <div key={ach.id} className={`ach-tag ${ach.id}`}>
                        {ach.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="vitals-scroll-x">
                {statCards.map((card) => (
                  <div key={card.label} className="vital-card-mobile">
                    <p className="vital-label-mini">{card.label}</p>
                    <p className="vital-val-mini">{card.value}</p>
                  </div>
                ))}
              </div>

              <div className="hud-actions-mobile">
                <Button
                  onClick={handleMint}
                  disabled={mintState === "minting" || isLoading || !isConnected || isExplorerMode}
                  className="mint-btn-mobile"
                >
                  {mintState === "idle" && <span>MINT IDENTITY</span>}
                  {mintState === "minting" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {mintState === "success" && <span>IDENTITY SECURED</span>}
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setManualAddress(undefined);
                    setFormAddress("");
                    setViewState("landing");
                  }}
                  className="exit-btn-mobile"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  {isExplorerMode ? "EXIT" : "BACK"}
                </Button>
              </div>
            </aside>
          </div>
        </>
      )}

      {walletData?.error && (
        <div className="prism-error-toast">
          <AlertCircle className="h-4 w-4" />
          <span>{walletData.error}</span>
        </div>
      )}
    </div>
  );
};

function LandingOverlay({ formAddress, setFormAddress, onExplore, connectWallet, isConnecting, hasProvider, combinedError, isScanning }: any) {
  if (isScanning) {
    return (
      <div className="warp-overlay scanning-overlay">
        <div className="warp-content">
          <div className="scanning-progress">
            <div className="scanning-bar"></div>
          </div>
          <div className="warp-text">Scanning Solana Identity...</div>
          <div className="warp-subtext">Analyzing blockchain data</div>
        </div>
      </div>
    );
  }

  return (
    <div className="landing-wrap-v2">
      <div className="landing-card-v2 glass-panel">
        <div className="landing-header-v2">
          <div className="glow-icon-container">
            <img src="/phav.png" alt="Identity Prism" className="h-24 w-24 mx-auto mb-6 glow-logo" />
          </div>
          <p className="landing-eyebrow">Identity Prism v2.1</p>
          <h1 className="landing-title-v2">Decode your cosmic signature.</h1>
        </div>
        
        <div className="landing-actions-v2">
          <div className="input-group-v2">
            <Input
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
              placeholder="Enter Address or .sol"
              className="landing-input-v2"
            />
            <Button className="explore-btn-v2" onClick={onExplore} disabled={!formAddress.trim()}>
              <Sparkles className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="divider-v2">OR</div>

          {!hasProvider ? (
            <Button asChild className="connect-btn-v2 outline">
              <a href="https://phantom.app/download" target="_blank" rel="noreferrer">
                Install Phantom
              </a>
            </Button>
          ) : (
            <Button className="connect-btn-v2" onClick={connectWallet} disabled={isConnecting}>
              {isConnecting ? <Loader2 className="h-5 w-5 animate-spin" /> : <PlugZap className="h-5 w-5 mr-2" />}
              {isConnecting ? "Establishing link…" : "Connect Phantom"}
            </Button>
          )}
        </div>
        
        {combinedError && <p className="landing-error-v2">{combinedError}</p>}
      </div>
    </div>
  );
}

export default Index;
