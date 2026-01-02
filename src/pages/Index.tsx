import { SolarSystem } from '@/components/SolarSystem';
import { useWalletData } from '@/hooks/useWalletData';
import { Badge } from '@/components/ui/badge';

const Index = () => {
  // Production mode: use actual wallet data (or demo data if not connected)
  const walletData = useWalletData();
  const { traits, score, address } = walletData;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* Solar System Visualization - Data-Driven */}
      <SolarSystem traits={traits} walletAddress={address} />
      
      {/* UI Overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Score Display */}
          <div className="bg-black/40 backdrop-blur-md rounded-xl p-3 sm:p-4 border border-white/10">
            <p className="text-white/60 text-xs sm:text-sm uppercase tracking-wider mb-1">Identity Score</p>
            <p className="text-3xl sm:text-4xl font-bold text-white">{score}</p>
            {traits.hasCombo && (
              <Badge className="mt-2 bg-gradient-to-r from-cyan-500 to-yellow-500 text-black font-semibold text-xs">
                +20 COMBO BONUS
              </Badge>
            )}
          </div>
          
          {/* Trait Badges */}
          <div className="flex flex-wrap gap-2 justify-start sm:justify-end max-w-full sm:max-w-md">
            {traits.hasSeeker && (
              <Badge className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 text-xs">
                ⚡ Seeker Genesis
              </Badge>
            )}
            {traits.hasPreorder && (
              <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 text-xs">
                ✨ Chapter 2 Preorder
              </Badge>
            )}
            {traits.isBlueChip && (
              <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/50 text-xs">
                💎 Blue Chip Holder
              </Badge>
            )}
            <Badge variant="outline" className="text-white/70 border-white/20 text-xs">
              🪐 {Math.min(Math.floor(traits.uniqueTokenCount / 10), 10)} Planets
            </Badge>
            <Badge variant="outline" className="text-white/70 border-white/20 text-xs">
              🌙 {Math.floor(traits.nftCount / 50)} Moons
            </Badge>
          </div>
        </div>
      </div>
      
      {/* Stats Panel - Mobile responsive */}
      <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-10">
        <div className="bg-black/40 backdrop-blur-md rounded-xl p-3 sm:p-4 border border-white/10 text-right">
          <p className="text-white/40 text-[10px] sm:text-xs uppercase tracking-wider mb-2">Wallet Stats</p>
          <div className="space-y-1 text-xs sm:text-sm">
            <p className="text-white/70">
              <span className="text-white/40">Tokens:</span> {traits.uniqueTokenCount}
            </p>
            <p className="text-white/70">
              <span className="text-white/40">NFTs:</span> {traits.nftCount}
            </p>
            <p className="text-white/70">
              <span className="text-white/40">Transactions:</span> {traits.txCount.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
      
      {/* Scoring breakdown indicator */}
      {(traits.hasSeeker || traits.hasPreorder) && (
        <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 z-10">
          <div className="bg-black/40 backdrop-blur-md rounded-xl p-3 sm:p-4 border border-white/10">
            <p className="text-white/40 text-[10px] sm:text-xs uppercase tracking-wider mb-2">Bonuses Applied</p>
            <div className="space-y-1 text-xs sm:text-sm">
              {traits.hasSeeker && (
                <p className="text-cyan-400">+50 Seeker Genesis</p>
              )}
              {traits.hasPreorder && (
                <p className="text-yellow-400">+30 Chapter 2 Preorder</p>
              )}
              {traits.hasCombo && (
                <p className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-yellow-400 font-semibold">
                  +20 Combo Bonus
                </p>
              )}
              {traits.isBlueChip && (
                <p className="text-purple-400">+100 Blue Chip</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
