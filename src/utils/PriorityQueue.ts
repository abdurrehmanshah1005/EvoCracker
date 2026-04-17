// ========================
// Binary Heap Priority Queue
// Critical for A*, UCS, Greedy BFS performance
// ========================

export class PriorityQueue<T> {
  private heap: T[] = [];
  private comparator: (a: T, b: T) => number;

  constructor(comparator: (a: T, b: T) => number) {
    this.comparator = comparator;
  }

  get size(): number {
    return this.heap.length;
  }

  get isEmpty(): boolean {
    return this.heap.length === 0;
  }

  /** Add element to queue — O(log n) */
  push(value: T): void {
    this.heap.push(value);
    this.bubbleUp(this.heap.length - 1);
  }

  /** Remove and return highest-priority element — O(log n) */
  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;

    const top = this.heap[0];
    const bottom = this.heap.pop()!;

    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this.sinkDown(0);
    }

    return top;
  }

  /** Peek at highest-priority element — O(1) */
  peek(): T | undefined {
    return this.heap[0];
  }

  /** Check if element exists — O(n) */
  contains(value: T): boolean {
    return this.heap.includes(value);
  }

  /** Clear all elements */
  clear(): void {
    this.heap = [];
  }

  /** Get all elements (copy) */
  toArray(): T[] {
    return [...this.heap];
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.comparator(this.heap[index], this.heap[parentIndex]) >= 0) break;
      [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
      index = parentIndex;
    }
  }

  private sinkDown(index: number): void {
    const length = this.heap.length;

    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      if (leftChild < length && this.comparator(this.heap[leftChild], this.heap[smallest]) < 0) {
        smallest = leftChild;
      }
      if (rightChild < length && this.comparator(this.heap[rightChild], this.heap[smallest]) < 0) {
        smallest = rightChild;
      }

      if (smallest === index) break;

      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}
