import type { Task } from '../models/task';
import type { DependencyEdge, BlockReason } from '../models/dependency';

export interface TaskGraph {
  nodes: Task[];
  edges: DependencyEdge[];
  adjacency: Map<string, string[]>;
  reverseAdjacency: Map<string, string[]>;
}

export function buildGraph(tasks: Task[], edges: DependencyEdge[]): TaskGraph {
  const activeTasks = tasks.filter((t) => t.archivedAt == null);
  const taskIds = new Set(activeTasks.map((t) => t.id));
  const validEdges = edges.filter(
    (e) => taskIds.has(e.fromTaskId) && taskIds.has(e.toTaskId)
  );

  const adjacency = new Map<string, string[]>();
  const reverseAdjacency = new Map<string, string[]>();

  for (const task of activeTasks) {
    adjacency.set(task.id, []);
    reverseAdjacency.set(task.id, []);
  }

  for (const edge of validEdges) {
    adjacency.get(edge.fromTaskId)!.push(edge.toTaskId);
    reverseAdjacency.get(edge.toTaskId)!.push(edge.fromTaskId);
  }

  return { nodes: activeTasks, edges: validEdges, adjacency, reverseAdjacency };
}

export function wouldCreateCycle(
  fromTaskId: string,
  toTaskId: string,
  adjacency: Map<string, string[]>
): boolean {
  if (fromTaskId === toTaskId) return true;

  const visited = new Set<string>();
  const stack = [toTaskId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === fromTaskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const next of adjacency.get(current) ?? []) {
      stack.push(next);
    }
  }

  return false;
}

export function isRedundantEdge(
  fromTaskId: string,
  toTaskId: string,
  adjacency: Map<string, string[]>
): boolean {
  const visited = new Set<string>();
  const stack: string[] = [];

  for (const direct of adjacency.get(fromTaskId) ?? []) {
    if (direct === toTaskId) return true;
    stack.push(direct);
  }

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === toTaskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const next of adjacency.get(current) ?? []) {
      stack.push(next);
    }
  }

  return false;
}

export function topologicalSort(nodes: Task[], edges: DependencyEdge[]): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    if (!adjacency.has(edge.fromTaskId) || !adjacency.has(edge.toTaskId)) continue;
    adjacency.get(edge.fromTaskId)!.push(edge.toTaskId);
    inDegree.set(edge.toTaskId, (inDegree.get(edge.toTaskId) ?? 0) + 1);
  }

  const queue = [...inDegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([id]) => id);

  const result: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    result.push(id);

    for (const next of adjacency.get(id) ?? []) {
      const degree = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, degree);
      if (degree === 0) queue.push(next);
    }
  }

  if (result.length !== nodes.length) {
    throw new Error('Dependency graph contains a cycle');
  }

  return result;
}

export function computeReadyTasks(
  tasks: Task[],
  edges: DependencyEdge[],
  childMap: Map<string, Task[]>
): Task[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const incoming = new Map<string, DependencyEdge[]>();

  for (const edge of edges) {
    if (!incoming.has(edge.toTaskId)) incoming.set(edge.toTaskId, []);
    incoming.get(edge.toTaskId)!.push(edge);
  }

  return tasks.filter((task) => {
    const isLeaf = (childMap.get(task.id) ?? []).length === 0;
    if (!isLeaf) return false;
    if (task.manualStatus === 'done' || task.manualStatus === 'canceled') return false;

    const prerequisites = incoming.get(task.id) ?? [];
    return prerequisites.every((edge) => {
      const predecessor = taskById.get(edge.fromTaskId);
      return (
        !predecessor ||
        predecessor.manualStatus === 'done' ||
        predecessor.manualStatus === 'canceled'
      );
    });
  });
}

export function computeBlockedReasons(
  tasks: Task[],
  edges: DependencyEdge[]
): BlockReason[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const incoming = new Map<string, DependencyEdge[]>();

  for (const edge of edges) {
    if (!incoming.has(edge.toTaskId)) incoming.set(edge.toTaskId, []);
    incoming.get(edge.toTaskId)!.push(edge);
  }

  const result: BlockReason[] = [];

  for (const task of tasks) {
    if (task.manualStatus === 'done' || task.manualStatus === 'canceled') continue;

    const prerequisites = incoming.get(task.id) ?? [];
    const unmet = prerequisites
      .map((e) => taskById.get(e.fromTaskId))
      .filter(
        (p): p is Task =>
          p != null &&
          p.manualStatus !== 'done' &&
          p.manualStatus !== 'canceled'
      )
      .map((p) => ({ id: p.id, title: p.title, manualStatus: p.manualStatus }));

    if (unmet.length > 0) {
      result.push({ taskId: task.id, unmetPrerequisites: unmet });
    }
  }

  return result;
}

export function findCycles(adjacency: Map<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();

  for (const node of adjacency.keys()) {
    color.set(node, WHITE);
    parent.set(node, null);
  }

  function dfs(node: string) {
    color.set(node, GRAY);
    for (const neighbor of adjacency.get(node) ?? []) {
      if (color.get(neighbor) === WHITE) {
        parent.set(neighbor, node);
        dfs(neighbor);
      } else if (color.get(neighbor) === GRAY) {
        const cycle: string[] = [];
        let cur = node;
        while (cur !== neighbor) {
          cycle.push(cur);
          cur = parent.get(cur) ?? '';
        }
        cycle.push(neighbor);
        cycle.reverse();
        cycles.push(cycle);
      }
    }
    color.set(node, BLACK);
  }

  for (const node of adjacency.keys()) {
    if (color.get(node) === WHITE) dfs(node);
  }

  return cycles;
}
