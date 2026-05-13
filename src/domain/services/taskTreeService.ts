import type { Task, DerivedTaskState, RollupStatus, ComputedStatus } from '../models/task';
import type { DependencyEdge } from '../models/dependency';

export function buildChildMap(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>();
  for (const task of tasks) {
    const parentId = task.parentId ?? '__root__';
    if (!map.has(parentId)) map.set(parentId, []);
    map.get(parentId)!.push(task);
  }
  return map;
}

export function getPath(
  taskId: string,
  parentMap: Map<string, Task | null>
): string[] {
  const path: string[] = [];
  let current: Task | null | undefined = parentMap.get(taskId);
  while (current) {
    path.unshift(current.id);
    current = parentMap.get(current.id);
  }
  return path;
}

export function getDepth(
  taskId: string,
  parentMap: Map<string, Task | null>
): number {
  let depth = 0;
  let current: Task | null | undefined = parentMap.get(taskId);
  while (current) {
    depth++;
    current = parentMap.get(current.id);
  }
  return depth;
}

export function getDescendants(
  taskId: string,
  childMap: Map<string, Task[]>
): Task[] {
  const result: Task[] = [];
  const stack = [...(childMap.get(taskId) ?? [])];
  while (stack.length > 0) {
    const child = stack.pop()!;
    result.push(child);
    for (const grandchild of childMap.get(child.id) ?? []) {
      stack.push(grandchild);
    }
  }
  return result;
}

export function getAncestors(
  taskId: string,
  parentMap: Map<string, Task | null>
): Task[] {
  const result: Task[] = [];
  let current: Task | null | undefined = parentMap.get(taskId);
  while (current) {
    result.push(current);
    current = parentMap.get(current.id);
  }
  return result;
}

export function computeComputedStatus(
  task: Task,
  _childMap: Map<string, Task[]>,
  incomingEdges: DependencyEdge[],
  taskById: Map<string, Task>
): ComputedStatus {
  if (task.manualStatus === 'done') return 'done';
  if (task.manualStatus === 'canceled') return 'canceled';
  if (task.manualStatus === 'in_progress') return 'active';

  const prerequisites = incomingEdges
    .map((e) => taskById.get(e.fromTaskId))
    .filter((p): p is Task => p != null);

  const hasUnmet = prerequisites.some(
    (p) => p.manualStatus !== 'done' && p.manualStatus !== 'canceled'
  );

  if (hasUnmet) return 'blocked';
  return 'ready';
}

export function computeRollupStatus(
  task: Task,
  childMap: Map<string, Task[]>,
  derivedMap: Map<string, DerivedTaskState>
): RollupStatus {
  const children = childMap.get(task.id) ?? [];
  if (children.length === 0) return 'todo';

  const allLeaves: DerivedTaskState[] = [];
  const stack = [...children];
  while (stack.length > 0) {
    const child = stack.pop()!;
    const derived = derivedMap.get(child.id);
    if (derived?.isLeaf) {
      allLeaves.push(derived);
    }
    for (const grandchild of childMap.get(child.id) ?? []) {
      stack.push(grandchild);
    }
  }

  if (allLeaves.length === 0) return 'todo';

  const allDoneOrCanceled = allLeaves.every(
    (d) => d.computedStatus === 'done' || d.computedStatus === 'canceled'
  );
  if (allDoneOrCanceled) return 'done';

  if (allLeaves.some((d) => d.computedStatus === 'active')) return 'in_progress';

  const allBlocked = allLeaves.every(
    (d) => d.computedStatus === 'blocked' || d.computedStatus === 'done' || d.computedStatus === 'canceled'
  );
  if (allBlocked) return 'blocked';

  if (allLeaves.some((d) => d.computedStatus === 'ready')) return 'ready';

  return 'todo';
}

export function computeAllDerivedStates(
  tasks: Task[],
  edges: DependencyEdge[]
): Map<string, DerivedTaskState> {
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const childMap = buildChildMap(tasks);
  const parentMap = new Map<string, Task | null>(
    tasks.map((t) => [t.id, taskById.get(t.parentId ?? '') ?? null])
  );

  const incoming = new Map<string, DependencyEdge[]>();
  for (const edge of edges) {
    if (!incoming.has(edge.toTaskId)) incoming.set(edge.toTaskId, []);
    incoming.get(edge.toTaskId)!.push(edge);
  }

  const derivedMap = new Map<string, DerivedTaskState>();

  for (const task of tasks) {
    const isLeaf = (childMap.get(task.id) ?? []).length === 0;
    const depth = getDepth(task.id, parentMap);
    const path = getPath(task.id, parentMap);
    const computedStatus = computeComputedStatus(task, childMap, incoming.get(task.id) ?? [], taskById);

    const descendants = getDescendants(task.id, childMap);
    const completedDescendantCount = descendants.filter(
      (d) => d.manualStatus === 'done' || d.manualStatus === 'canceled'
    ).length;

    const unmetDependencyIds =
      task.manualStatus !== 'done' && task.manualStatus !== 'canceled'
        ? (incoming.get(task.id) ?? [])
            .map((e) => taskById.get(e.fromTaskId))
            .filter(
              (p): p is Task =>
                p != null &&
                p.manualStatus !== 'done' &&
                p.manualStatus !== 'canceled'
            )
            .map((p) => p.id)
        : [];

    derivedMap.set(task.id, {
      taskId: task.id,
      isLeaf,
      depth,
      path,
      computedStatus,
      unmetDependencyIds,
      descendantCount: descendants.length,
      completedDescendantCount,
    });
  }

  for (const task of tasks) {
    const derived = derivedMap.get(task.id);
    if (derived && !derived.isLeaf) {
      derived.rollupStatus = computeRollupStatus(task, childMap, derivedMap);
    }
  }

  return derivedMap;
}
