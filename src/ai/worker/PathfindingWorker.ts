import { findPath } from '../pathfinding/AlgorithmRegistry';
import { Grid } from '../pathfinding/Grid';

let currentGrid: Grid | null = null;

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'SET_GRID') {
    currentGrid = Grid.deserialize(payload);
    self.postMessage({ type: 'GRID_SET' });
  } else if (type === 'FIND_PATH') {
    if (!currentGrid) {
      self.postMessage({ type: 'PATH_ERROR', id: payload.id, error: 'Grid not initialized' });
      return;
    }

    currentGrid.resetSearchState();

    const result = findPath({
      algorithm: payload.algorithm,
      grid: currentGrid,
      startX: payload.startX,
      startY: payload.startY,
      goalX: payload.goalX,
      goalY: payload.goalY,
      depthLimit: payload.depthLimit,
    });
    
    const cleanResult = {
      path: result.path,
      nodesExpanded: result.nodesExpanded,
      nodesVisited: result.nodesVisited,
      timeMs: result.timeMs,
      success: result.success,
      algorithm: result.algorithm,
    };

    self.postMessage({ type: 'PATH_RESULT', id: payload.id, result: cleanResult });
  }
};
