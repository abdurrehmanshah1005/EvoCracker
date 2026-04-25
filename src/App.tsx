import { useGameStore } from '@store/gameStore';
import { MainMenu } from '@ui/screens/MainMenu';
import { GameScreen } from '@ui/screens/GameScreen';
import { AlgorithmLabScreen } from '@ui/screens/AlgorithmLabScreen';
import { SettingsScreen } from '@ui/screens/SettingsScreen';
import { CharacterSelectScreen } from '@ui/screens/CharacterSelectScreen';
import { MapSelectScreen } from '@ui/screens/MapSelectScreen';
import { LeaderboardScreen } from '@ui/screens/LeaderboardScreen';

function App() {
  const currentScreen = useGameStore((s) => s.currentScreen);

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
      default:
        return <MainMenu />;
    }
  };

  return <>{renderScreen()}</>;
}

export default App;
