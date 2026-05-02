import { useGameStore } from '@store/gameStore';
import { MainMenu } from '@ui/screens/MainMenu';
import { GameScreen } from '@ui/screens/GameScreen';
import { AlgorithmLabScreen } from '@ui/screens/AlgorithmLabScreen';
import { SettingsScreen } from '@ui/screens/SettingsScreen';
import { CharacterSelectScreen } from '@ui/screens/CharacterSelectScreen';
import { MapSelectScreen } from '@ui/screens/MapSelectScreen';
import { LeaderboardScreen } from '@ui/screens/LeaderboardScreen';
import { MusicPlayer } from '@ui/components/MusicPlayer';
import { AliasShopScreen } from '@ui/screens/AliasShopScreen';

function App() {
  const currentScreen = useGameStore((s) => s.currentScreen);
  const musicEnabled = useGameStore((s) => s.musicEnabled);
  const toggleMusic = useGameStore((s) => s.toggleMusic);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'mainMenu':
        return <MainMenu />;
      case 'mapSelect':
        return <MapSelectScreen />;
      case 'characterSelect':
        return <CharacterSelectScreen />;
      case 'playing':
        return <GameScreen />;
      case 'algorithmLab':
        return <AlgorithmLabScreen />;
      case 'settings':
        return <SettingsScreen />;
      case 'leaderboard':
        return <LeaderboardScreen />;
      case 'aliasShop':
        return <AliasShopScreen />;
      default:
        return <MainMenu />;
    }
  };

  return (
    <>
      <MusicPlayer />
      {renderScreen()}
      
      {/* Global Music Toggle Button */}
      {currentScreen === 'mainMenu' && (
        <button 
          className="btn btn-pixel"
          style={{
            position: 'absolute',
            bottom: '16px',
            right: '16px',
            zIndex: 9999,
            padding: '8px 16px',
            fontSize: '0.75rem',
            letterSpacing: '2px',
            textTransform: 'uppercase'
          }}
          onClick={toggleMusic}
        >
          {musicEnabled ? '♪ MUSIC: ON' : '♪ MUSIC: OFF'}
        </button>
      )}
    </>
  );
}

export default App;
