# Phase 5: The Game

This phase documents the playable web application and the real-time visualization dashboard.

## Phase 5 Deliverable Summary

- Completed end-to-end playable loop from calibration to evolved rounds.
- Integrated in-game analytics dashboard for algorithm and evolution inspection.
- Prepared the project for static hosting and release packaging.

## Verification Checklist

- [x] Core gameplay loop is complete and demonstrable.
- [x] Dashboard requirement is satisfied in playable runtime.
- [x] Build and hosting steps are documented for deployment.

## 1. Playable Application

EvoCracker is a Vite + React + PixiJS web game.

Local development:

```bash
npm run dev
```

Current local URL:

```text
http://127.0.0.1:5173/
```

Production build:

```bash
npm run build
```

Build output:

```text
dist/
```

## 2. Core Gameplay Loop

The game loop now matches the evaluator requirement:
1. Calibration round starts first.
2. Player reaches the exit to finish calibration.
3. Telemetry is cleaned and classified.
4. Generation 1 enemies spawn using the calibrated profile.
5. Player reaches the exit to finish the round.
6. Enemy genomes evolve between rounds.
7. The dashboard visualizes generations, algorithms, and player profile metrics.

Defeating enemies is optional. The round objective is reaching the exit.

## 3. User Interface Requirement

The AI dashboard is available in-game using the backtick key.

Dashboard tabs:
- Algorithms: algorithm reference, active enemy algorithms, runtime comparison.
- Genomes: population genes and fitness.
- Evolution: fitness graph and generation metrics.
- Player: classified playstyle, telemetry summary, exploration data.
- Performance: FPS, enemy count, iteration, difficulty.

## 4. Sprint and Movement

The player can sprint with `Shift`.

Sprint rules:
- Sprint drains to 0 while held.
- Once fully depleted, sprint is unavailable for 30 seconds.
- After the recharge timer finishes, stamina returns to full.
- Calibration movement is boosted so the setup round is faster.

## 5. Hosting Checklist

The project is deployment-ready as a static Vite application.

Recommended hosting options:
- Vercel: import the repository, set build command to `npm run build`, output directory to `dist`.
- Netlify: import the repository, set build command to `npm run build`, publish directory to `dist`.
- GitHub Pages: build `dist/` and publish it with a Pages workflow.

After hosting, replace this placeholder with the final public URL:

```text
Hosted URL: pending deployment
```

## 6. What to Show the Evaluator

Demo checklist:
- Open the hosted app.
- Complete calibration by reaching the exit.
- Show that raw telemetry produces a player style.
- Open the dashboard and show generation, fitness, runtime comparison, and active enemy pathfinding.
- Reach the exit on a combat floor and show that the next generation updates.
