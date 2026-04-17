-- ========================
-- AlchEx: The Summoner's Trial
-- Supabase Database Schema
-- Run this in the Supabase SQL editor
-- ========================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Player profiles
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Elite genomes — the best-evolved enemy AIs
CREATE TABLE IF NOT EXISTS elite_genomes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  generation INT NOT NULL,
  enemy_type TEXT NOT NULL,
  chromosome JSONB NOT NULL,      -- Full genome JSON
  fitness_score FLOAT NOT NULL DEFAULT 0,
  floor_reached INT DEFAULT 0,
  playstyle_countered TEXT,       -- Which player playstyle this evolved against
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Leaderboard — one row per player, updated on beat
CREATE TABLE IF NOT EXISTS leaderboard (
  player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  best_floor INT DEFAULT 0,
  total_score FLOAT DEFAULT 0,
  strongest_genome_id UUID REFERENCES elite_genomes(id),
  generations_run INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Evolution history — for academic research data export
CREATE TABLE IF NOT EXISTS evolution_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  floor_number INT NOT NULL,
  generation_number INT NOT NULL,
  avg_fitness FLOAT,
  max_fitness FLOAT,
  min_fitness FLOAT,
  diversity_index FLOAT,
  dominant_algorithm TEXT,
  population_size INT,
  player_playstyle TEXT,
  gene_averages JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_elite_fitness ON elite_genomes(fitness_score DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(total_score DESC);
CREATE INDEX IF NOT EXISTS idx_evolution_player ON evolution_runs(player_id, floor_number);

-- Function: update leaderboard only if score improved
CREATE OR REPLACE FUNCTION update_leaderboard(
  p_player_id UUID,
  p_username TEXT,
  p_score FLOAT,
  p_floor INT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO leaderboard (player_id, username, total_score, best_floor, updated_at)
  VALUES (p_player_id, p_username, p_score, p_floor, now())
  ON CONFLICT (player_id)
  DO UPDATE SET
    total_score = GREATEST(leaderboard.total_score, EXCLUDED.total_score),
    best_floor = GREATEST(leaderboard.best_floor, EXCLUDED.best_floor),
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Enable Realtime on leaderboard
ALTER PUBLICATION supabase_realtime ADD TABLE leaderboard;
