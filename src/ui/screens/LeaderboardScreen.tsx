import React, { useEffect, useState } from 'react';
import { useGameStore } from '@store/gameStore';
import { SupabaseService } from '@services/SupabaseService';

export const LeaderboardScreen: React.FC = () => {
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const setScreen = useGameStore((s) => s.setScreen);

  useEffect(() => {
    const fetchScores = async () => {
      const data = await SupabaseService.getLeaderboard();
      setScores(data);
      setLoading(false);
    };
    fetchScores();
  }, []);

  return (
    <div className="screen-overlay leaderboard-screen">
      <div className="glass-panel main-panel p-lg">
        <h1 className="text-xl text-center text-accent mb-lg">Global Leaderboard</h1>
        
        {loading ? (
          <div className="text-center py-xl">Loading elite survivors...</div>
        ) : (
          <div className="leaderboard-table-container">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Survivor</th>
                  <th>Floor</th>
                  <th>Total Score</th>
                  <th>Last Update</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((score, index) => (
                  <tr key={score.player_id} className={index === 0 ? 'top-rank' : ''}>
                    <td>#{index + 1}</td>
                    <td>{score.username}</td>
                    <td>{score.best_floor}</td>
                    <td>{Math.round(score.total_score).toLocaleString()}</td>
                    <td>{new Date(score.updated_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex-center mt-xl">
          <button 
            className="btn btn-secondary"
            onClick={() => setScreen('mainMenu')}
          >
            Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
};
