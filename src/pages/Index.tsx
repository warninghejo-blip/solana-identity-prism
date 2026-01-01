import { SolarSystem } from '@/components/SolarSystem';
import { useWalletDemo } from '@/hooks/useWalletData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const Index = () => {
  const { demoMode, setDemoMode, traits, score } = useWalletDemo();

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* Solar System Visualization */}
      <SolarSystem traits={traits} />
      
      {/* UI Overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 p-6">
        <div className="flex items-center justify-between">
          {/* Score Display */}
          <div className="bg-black/40 backdrop-blur-md rounded-xl p-4 border border-white/10">
            <p className="text-white/60 text-sm uppercase tracking-wider mb-1">Identity Score</p>
            <p className="text-4xl font-bold text-white">{score}</p>
            {traits.hasCombo && (
              <Badge className="mt-2 bg-gradient-to-r from-cyan-500 to-yellow-500 text-black font-semibold">
                +20 COMBO BONUS
              </Badge>
            )}
          </div>
          
          {/* Trait Badges */}
          <div className="flex flex-wrap gap-2 justify-end max-w-md">
            {traits.hasSeeker && (
              <Badge className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/50">
                ⚡ Seeker Genesis
              </Badge>
            )}
            {traits.hasPreorder && (
              <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/50">
                ✨ Chapter 2 Preorder
              </Badge>
            )}
            {traits.isBlueChip && (
              <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/50">
                💎 Blue Chip Holder
              </Badge>
            )}
            <Badge variant="outline" className="text-white/70 border-white/20">
              🪐 {Math.min(Math.floor(traits.uniqueTokenCount / 10), 10)} Planets
            </Badge>
            <Badge variant="outline" className="text-white/70 border-white/20">
              🌙 {Math.floor(traits.nftCount / 50)} Moons
            </Badge>
          </div>
        </div>
      </div>
      
      {/* Demo Mode Switcher */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-black/40 backdrop-blur-md rounded-full p-2 border border-white/10 flex gap-2">
          <Button
            size="sm"
            variant={demoMode === 'combo' ? 'default' : 'ghost'}
            onClick={() => setDemoMode('combo')}
            className={demoMode === 'combo' ? 'bg-gradient-to-r from-cyan-500 to-yellow-500 text-black' : 'text-white/70'}
          >
            Combo
          </Button>
          <Button
            size="sm"
            variant={demoMode === 'seeker' ? 'default' : 'ghost'}
            onClick={() => setDemoMode('seeker')}
            className={demoMode === 'seeker' ? 'bg-cyan-500 text-black' : 'text-white/70'}
          >
            Seeker
          </Button>
          <Button
            size="sm"
            variant={demoMode === 'preorder' ? 'default' : 'ghost'}
            onClick={() => setDemoMode('preorder')}
            className={demoMode === 'preorder' ? 'bg-yellow-500 text-black' : 'text-white/70'}
          >
            Preorder
          </Button>
          <Button
            size="sm"
            variant={demoMode === 'basic' ? 'default' : 'ghost'}
            onClick={() => setDemoMode('basic')}
            className={demoMode === 'basic' ? 'bg-white text-black' : 'text-white/70'}
          >
            Basic
          </Button>
        </div>
      </div>
      
      {/* Stats Panel */}
      <div className="absolute bottom-6 right-6 z-10">
        <div className="bg-black/40 backdrop-blur-md rounded-xl p-4 border border-white/10 text-right">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Wallet Stats</p>
          <div className="space-y-1 text-sm">
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
    </div>
  );
};

export default Index;
