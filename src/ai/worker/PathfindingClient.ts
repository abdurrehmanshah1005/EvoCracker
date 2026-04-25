import { AlgorithmType } from '@utils/constants';
import type { PathResult } from '../pathfinding/Grid';

export interface PathfindingWorkerRequest {
  algorithm: AlgorithmType;
  startX: number;
  startY: number;
  goalX: number;
  goalY: number;
  depthLimit: number;
}

export class PathfindingClient {
  private static instance: PathfindingClient;
  private worker: Worker | null = null;
  private nextRequestId = 1;
  private pendingRequests = new Map<number, { resolve: (res: PathResult) => void; reject: (err: any) => void }>();

  private constructor() {
    this.initWorker();
  }

  public static getInstance(): PathfindingClient {
    if (!PathfindingClient.instance) {
      PathfindingClient.instance = new PathfindingClient();
    }
    return PathfindingClient.instance;
  }

  private initWorker() {
    try {
      // Create worker via Vite URL import
      this.worker = new Worker(new URL('./PathfindingWorker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = this.handleMessage.bind(this);
      this.worker.onerror = (err) => {
        console.error('PathfindingWorker error:', err);
      };
    } catch (e) {
      console.warn('Failed to initialize PathfindingWorker, fallback to sync might be needed', e);
    }
  }

  private handleMessage(e: MessageEvent) {
    const { type, id, result, error } = e.data;
    
    if (type === 'PATH_RESULT') {
      const resolver = this.pendingRequests.get(id);
      if (resolver) {
        this.pendingRequests.delete(id);
        resolver.resolve(result);
      }
    } else if (type === 'PATH_ERROR') {
      const resolver = this.pendingRequests.get(id);
      if (resolver) {
        this.pendingRequests.delete(id);
        resolver.reject(new Error(error));
      }
    }
  }

  public setGrid(gridData: any) {
    if (this.worker) {
      this.worker.postMessage({ type: 'SET_GRID', payload: gridData });
    }
  }

  public requestPath(request: PathfindingWorkerRequest): Promise<PathResult> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        return reject(new Error('Worker not initialized'));
      }
      
      const id = this.nextRequestId++;
      this.pendingRequests.set(id, { resolve, reject });
      
      this.worker.postMessage({
        type: 'FIND_PATH',
        payload: { id, ...request }
      });
    });
  }
}
