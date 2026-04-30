# Phase 1: Core System Documentation

This document clearly outlines the foundational elements of the EvoCracker AI research project: the game's state space, the agent capabilities, and the mathematical formulation of the Genetic Algorithm's fitness function.

## 1. Game State Space

The game's state space represents the environment the AI agents navigate and the data structures that encode their current situation. 

- **Grid-Based Environment**: The world is represented as a 2D discrete grid (`Grid`). Each cell in the grid (`GridNode`) has coordinates `(x, y)` and contains specific properties:
  - `walkable`: Boolean indicating if the cell can be traversed.
  - `weight`: The movement cost associated with the cell, derived from its terrain type.
  - `tileType`: The physical property of the cell (e.g., `FLOOR_STONE`, `WALL`, `WATER`, `MUD`, `TRAP`).
- **Navigational State**: During pathfinding operations, each node temporarily stores search state information:
  - `g`: Exact cost from the start node.
  - `h`: Heuristic estimated cost to the goal.
  - `f`: Total estimated cost (`g + h`).
  - `visited`, `inOpenSet`, `depth`, and `parent`.
- **Connectivity**: The environment supports both 4-directional (orthogonal) and 8-directional (orthogonal + diagonal) movement. Diagonal movements are cost-adjusted (typically $\sqrt{2}$) and prevent corner-cutting through walls.
- **Behavioral States**: An agent's behavior state is governed by a Behavior Tree, transitioning between distinct logical states depending on context: `IDLE`, `PATROL`, `INVESTIGATE`, `CHASE`, and `FLEE`.

## 2. Agent Capabilities

Agents in EvoCracker possess a wide array of capabilities driven by their underlying behavior trees, genetic traits, and pathfinding systems.

### 2.1 Sensory Capabilities
- **Vision System**: Agents utilize a raycasting-based Field of View (FOV) to detect the player and other dynamic objects within their line of sight.

### 2.2 Action Capabilities
- **Movement**: Pathfinding towards a specific target node or exploring the map via random/patrol movements.
- **Combat**: Dealing damage to the player upon successful engagement.
- **Cooperation**: Assisting other agents to secure "cooperative kills" or flanking maneuvers.
- **Fleeing**: Retreating when at a disadvantage or executing hit-and-run tactics.

### 2.3 Search Algorithms
Agents use a variety of pathfinding and search algorithms to navigate, and their preference for each algorithm evolves over time. Available algorithms include:
- **BFS (Breadth-First Search)**
- **DFS (Depth-First Search)**
- **IDS (Iterative Deepening Search)**
- **DLS (Depth-Limited Search)**
- **UCS (Uniform Cost Search)**
- **A\* (A-Star)**
- **Greedy BFS**
- **Hill Climbing**

### 2.4 Genetic Traits (Genome)
Each agent possesses a `Genome` consisting of values between 0.0 and 1.0 that govern its physical and psychological capabilities:
- **`speed`**: Determines the agent's movement velocity.
- **`vision`**: Modifies the range and arc of the agent's FOV.
- **`aggression`**: Likelihood to attack versus flee.
- **`persistence`**: How long the agent will chase the player after losing line of sight.
- **`cautiousness`**: Hesitation before engaging or entering unknown areas.
- **`packTendency`**: Desire to group up with other agents.
- **`ambushTendency`**: Preference for hiding near choke points.
- **`patrolVariance`**: Degree of randomness in patrol routes.
- **`algorithmWeights`**: A set of weights determining which of the 8 search algorithms the agent is most likely to employ.

## 3. Mathematical Formulation of the Fitness Function

The Genetic Algorithm evolves the enemy population between floors. The goal of the fitness function is to reward agents that successfully challenge the player's specific playstyle.

### 3.1 Base Fitness Calculation
The base fitness of an enemy is calculated as a weighted sum of various performance metrics gathered during its lifetime:

Base Fitness = (Time Visible * 0.3) + (Damage Dealt * 2.0) + (Detections * 1.5) + (Survival Time * 0.2) + (Area Covered * 0.4) - (Time Stuck * 1.0) + (Cooperative Kills * 2.5)

Where:
- Time Visible: Time (in seconds) the player spent within the agent's vision.
- Damage Dealt: Total damage the agent dealt to the player.
- Detections: Number of times the agent successfully detected a previously hidden player.
- Survival Time: Time (in seconds) the agent stayed alive.
- Area Covered: Number of unique tiles the agent visited (area coverage).
- Time Stuck: Time (in seconds) the agent spent unable to move or oscillating in place.
- Cooperative Kills: Number of kills (or heavy damage instances) assisted by other agents.

### 3.2 Playstyle-Adaptive Bias
To ensure the enemies evolve to counter the user, a player profile is constructed (`rusher`, `stayer`, `explorer`, `fighter`, or `hybrid`). The base fitness is then scaled based on the agent's genetic traits that best counter that specific playstyle:

- **If Player is 'Stayer' (Hides frequently):**  
  Final Fitness = Base Fitness * (1 + (Genome Persistence * 0.5))
- **If Player is 'Rusher' (Moves quickly to the exit):**  
  Final Fitness = Base Fitness * (1 + (Genome Speed * 0.5))
- **If Player is 'Explorer' (Visits many rooms):**  
  Final Fitness = Base Fitness * (1 + (Genome Pack Tendency * 0.4))
- **If Player is 'Fighter' (Engages enemies often):**  
  Final Fitness = Base Fitness * (1 + (Genome Cautiousness * 0.3))
- **If Player is 'Hybrid' (No dominant pattern):**  
  Final Fitness = Base Fitness * 1.1

The final fitness is clamped to a minimum of 0:
Fitness = Math.max(0, Final Fitness)
