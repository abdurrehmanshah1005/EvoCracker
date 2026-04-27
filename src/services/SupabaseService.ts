import { supabase } from '@store/supabaseClient';
import { useGameStore } from '@store/gameStore';

export const SupabaseService = {
  /**
   * Initialize a player profile. Uses local storage to persist player ID.
   */
  async initializePlayer(username: string) {
    let playerId = localStorage.getItem('evocracker_player_id');
    
    if (!playerId) {
      const { data, error } = await supabase
        .from('players')
        .insert([{ username }])
        .select()
        .single();
        
      if (error) {
        console.error('Error creating player:', error);
        return null;
      }
      
      playerId = data.id;
      localStorage.setItem('evocracker_player_id', playerId!);
    }
    
    return playerId;
  },

  /**
   * Save an elite genome to the database.
   */
  async saveEliteGenome(genome: any, enemyType: string, fitness: number, floor: number) {
    const playerId = localStorage.getItem('evocracker_player_id');
    if (!playerId) return;

    const { error } = await supabase
      .from('elite_genomes')
      .insert([{
        player_id: playerId,
        generation: genome.generation,
        enemy_type: enemyType,
        chromosome: genome,
        fitness_score: fitness,
        floor_reached: floor,
        playstyle_countered: useGameStore.getState().playerPlaystyle || 'unknown'
      }]);

    if (error) console.error('Error saving elite genome:', error);
  },

  /**
   * Update the global leaderboard.
   */
  async updateLeaderboard(score: number, floor: number) {
    const playerId = localStorage.getItem('evocracker_player_id');
    const username = useGameStore.getState().username || 'Anonymous';
    
    // Local storage fallback since Supabase is unconfigured
    const localBoardStr = localStorage.getItem('evocracker_leaderboard');
    let board: any[] = localBoardStr ? JSON.parse(localBoardStr) : [];
    
    const existing = board.find(s => s.player_id === playerId);
    if (existing) {
      existing.total_score = Math.max(existing.total_score, score);
      existing.best_floor = Math.max(existing.best_floor, floor);
      existing.updated_at = new Date().toISOString();
      existing.username = username;
    } else {
      board.push({
        player_id: playerId || Math.random().toString(),
        username,
        total_score: score,
        best_floor: floor,
        updated_at: new Date().toISOString()
      });
    }
    board.sort((a, b) => b.total_score - a.total_score);
    localStorage.setItem('evocracker_leaderboard', JSON.stringify(board));

    if (!playerId || !import.meta.env.VITE_SUPABASE_URL) return;

    // Using the RPC function defined in the schema
    const { error } = await supabase.rpc('update_leaderboard', {
      p_player_id: playerId,
      p_username: username,
      p_score: score,
      p_floor: floor
    });

    if (error) console.error('Error updating leaderboard:', error);
  },

  /**
   * Log an evolution run for research purposes.
   */
  async logEvolutionRun(stats: any) {
    const playerId = localStorage.getItem('evocracker_player_id');
    if (!playerId) return;

    const { error } = await supabase
      .from('evolution_runs')
      .insert([{
        player_id: playerId,
        floor_number: stats.floor,
        generation_number: stats.generation,
        avg_fitness: stats.avgFitness,
        max_fitness: stats.maxFitness,
        min_fitness: stats.minFitness,
        diversity_index: stats.diversity,
        dominant_algorithm: stats.dominantAlgo,
        population_size: stats.popSize,
        player_playstyle: stats.playstyle,
        gene_averages: stats.geneAverages
      }]);

    if (error) console.error('Error logging evolution run:', error);
  },

  /**
   * Fetch the top scores for the leaderboard.
   */
  async getLeaderboard(limit = 10) {
    // Return local storage data as a fallback
    const localBoardStr = localStorage.getItem('evocracker_leaderboard');
    const localBoard: any[] = localBoardStr ? JSON.parse(localBoardStr) : [];

    if (!import.meta.env.VITE_SUPABASE_URL) {
      return localBoard.slice(0, limit);
    }

    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('total_score', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching leaderboard:', error);
      return localBoard.slice(0, limit);
    }
    
    return data;
  }
};
