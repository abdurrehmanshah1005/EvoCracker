import { useGameStore } from '@store/gameStore';
import { MainMenu } from '@ui/screens/MainMenu';
import { GameScreen } from '@ui/screens/GameScreen';
import { AlgorithmLabScreen } from '@ui/screens/AlgorithmLabScreen';
import { SettingsScreen } from '@ui/screens/SettingsScreen';

function App() {
  const currentScreen = useGameStore((s) => s.currentScreen);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'mainMenu':
        return <MainMenu />;
      case 'playing':
        return <GameScreen />;
      case 'algorithmLab':
        return <AlgorithmLabScreen />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <MainMenu />;
    }
  };

  return <>{renderScreen()}</>;
}

export default App;
