import type { Task } from '../../domain/models/task';
import type { DependencyEdge } from '../../domain/models/dependency';

export interface GraphNodePosition {
  x: number;
  y: number;
  source: 'auto' | 'manual';
}

export interface GraphLayerBand {
  id: string;
  rootTaskId: string;
  label: string;
  taskIds: string[];
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutTaskGraphOptions {
  manualPositions?: Record<string, { x: number; y: number }>;
  groupId?: string;
  groupLabel?: string;
}

export interface LayoutTaskGraphResult {
  positions: Map<string, GraphNodePosition>;
  layerBands: GraphLayerBand[];
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 88;
const COLUMN_GAP = 270;
const DEPTH_GAP = 132;
const LAYER_PADDING = 72;

export function layoutTaskGraph(
  tasks: Task[],
  edges: DependencyEdge[],
  options: LayoutTaskGraphOptions = {}
): LayoutTaskGraphResult {
  const activeTasks = tasks
    .filter((task) => task.archivedAt == null)
    .sort(compareTasks);
  const taskById = new Map(activeTasks.map((task) => [task.id, task]));
  const depths = computeDepths(activeTasks, taskById);
  const topoRanks = computeTopologicalRanks(activeTasks, edges);

  const positions = new Map<string, GraphNodePosition>();
  const layerBands: GraphLayerBand[] = [];
  const buckets = new Map<string, Task[]>();

  for (const task of activeTasks) {
    const depth = depths.get(task.id) ?? 0;
    const rank = topoRanks.get(task.id) ?? 0;
    const bucketKey = `${depth}:${rank}`;
    const bucket = buckets.get(bucketKey) ?? [];
    bucket.push(task);
    buckets.set(bucketKey, bucket);
  }

  let rankStride = 1;
  const collisionIndexByTask = new Map<string, number>();
  for (const bucket of buckets.values()) {
    bucket.sort(compareTasks);
    rankStride = Math.max(rankStride, bucket.length);
    bucket.forEach((task, index) => collisionIndexByTask.set(task.id, index));
  }

  for (const task of activeTasks) {
    const manualPosition = options.manualPositions?.[task.id];
    const depth = depths.get(task.id) ?? 0;
    const rank = topoRanks.get(task.id) ?? 0;
    const collisionIndex = collisionIndexByTask.get(task.id) ?? 0;
    const autoPosition = {
      x: LAYER_PADDING + (rank * rankStride + collisionIndex) * COLUMN_GAP,
      y: LAYER_PADDING + depth * DEPTH_GAP,
    };

    positions.set(task.id, manualPosition
      ? { ...manualPosition, source: 'manual' }
      : { ...autoPosition, source: 'auto' });
  }

  if (activeTasks.length > 0) {
    const taskIds = activeTasks.map((task) => task.id);
    const bounds = getLayerBounds(taskIds, positions);
    layerBands.push({
      id: options.groupId ?? 'task-group',
      rootTaskId: options.groupId ?? 'task-group',
      label: options.groupLabel ?? 'Task group',
      taskIds,
      x: bounds.x - LAYER_PADDING,
      y: bounds.y - LAYER_PADDING,
      width: bounds.width + LAYER_PADDING * 2,
      height: bounds.height + LAYER_PADDING * 2,
    });
  }

  return { positions, layerBands };
}

export function layoutGraph(
  tasks: Task[],
  edges: DependencyEdge[],
  direction: 'TB' | 'LR' = 'LR'
): Map<string, { x: number; y: number }> {
  void direction;
  const { positions } = layoutTaskGraph(tasks, edges);
  return new Map(
    [...positions.entries()].map(([taskId, position]) => [
      taskId,
      { x: position.x, y: position.y },
    ])
  );
}

function computeDepths(tasks: Task[], taskById: Map<string, Task>): Map<string, number> {
  const depths = new Map<string, number>();

  const getDepth = (task: Task): number => {
    const cached = depths.get(task.id);
    if (cached != null) return cached;
    if (!task.parentId) {
      depths.set(task.id, 0);
      return 0;
    }
    const parent = taskById.get(task.parentId);
    const depth = parent ? getDepth(parent) + 1 : 0;
    depths.set(task.id, depth);
    return depth;
  };

  for (const task of tasks) {
    getDepth(task);
  }

  return depths;
}

function computeTopologicalRanks(
  tasks: Task[],
  edges: DependencyEdge[]
): Map<string, number> {
  const taskIds = new Set(tasks.map((task) => task.id));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  const ranks = new Map<string, number>();

  for (const task of tasks) {
    inDegree.set(task.id, 0);
    adjacency.set(task.id, []);
    ranks.set(task.id, 0);
  }

  for (const edge of edges) {
    if (!taskIds.has(edge.fromTaskId) || !taskIds.has(edge.toTaskId)) continue;
    adjacency.get(edge.fromTaskId)!.push(edge.toTaskId);
    inDegree.set(edge.toTaskId, (inDegree.get(edge.toTaskId) ?? 0) + 1);
  }

  for (const nextTasks of adjacency.values()) {
    nextTasks.sort((a, b) => compareTaskIds(a, b, tasks));
  }

  const queue = tasks
    .filter((task) => (inDegree.get(task.id) ?? 0) === 0)
    .sort(compareTasks)
    .map((task) => task.id);

  while (queue.length > 0) {
    const taskId = queue.shift()!;
    const sourceRank = ranks.get(taskId) ?? 0;

    for (const nextId of adjacency.get(taskId) ?? []) {
      ranks.set(nextId, Math.max(ranks.get(nextId) ?? 0, sourceRank + 1));
      const nextDegree = (inDegree.get(nextId) ?? 0) - 1;
      inDegree.set(nextId, nextDegree);
      if (nextDegree === 0) {
        queue.push(nextId);
        queue.sort((a, b) => compareTaskIds(a, b, tasks));
      }
    }
  }

  return ranks;
}

function getLayerBounds(
  taskIds: string[],
  positions: Map<string, GraphNodePosition>
): { x: number; y: number; width: number; height: number } {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const taskId of taskIds) {
    const position = positions.get(taskId);
    if (!position) continue;
    minX = Math.min(minX, position.x);
    minY = Math.min(minY, position.y);
    maxX = Math.max(maxX, position.x + NODE_WIDTH);
    maxY = Math.max(maxY, position.y + NODE_HEIGHT);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { x: 0, y: 0, width: NODE_WIDTH, height: NODE_HEIGHT };
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function compareTaskIds(a: string, b: string, tasks: Task[]): number {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  return compareTasks(taskById.get(a), taskById.get(b));
}

function compareTasks(a: Task | undefined, b: Task | undefined): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const orderDelta = a.sortOrder - b.sortOrder;
  if (orderDelta !== 0) return orderDelta;
  const titleDelta = a.title.localeCompare(b.title, 'zh-Hans-CN');
  if (titleDelta !== 0) return titleDelta;
  return a.id.localeCompare(b.id);
}
