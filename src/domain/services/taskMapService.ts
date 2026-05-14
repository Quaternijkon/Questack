import type { Task } from '../models/task';
import { buildChildMap } from './taskTreeService';

export interface TaskMapRegion {
  taskId: string;
  depth: number;
  childTaskIds: string[];
  descendantTaskIds: string[];
}

export function buildTaskMapRegions(tasks: Task[]): TaskMapRegion[] {
  const activeTasks = tasks
    .filter((task) => task.archivedAt == null)
    .sort(compareTasks);
  const taskById = new Map(activeTasks.map((task) => [task.id, task]));
  const childMap = buildChildMap(activeTasks);

  return activeTasks
    .filter((task) => getSortedChildren(task.id, childMap).length > 0)
    .map((task) => ({
      taskId: task.id,
      depth: computeDepth(task, taskById),
      childTaskIds: getSortedChildren(task.id, childMap).map((child) => child.id),
      descendantTaskIds: getDescendantIdsInDisplayOrder(task.id, childMap),
    }))
    .sort((a, b) => a.depth - b.depth || compareTaskIds(a.taskId, b.taskId, taskById));
}

function getDescendantIdsInDisplayOrder(
  taskId: string,
  childMap: Map<string, Task[]>
): string[] {
  const result: string[] = [];

  for (const child of getSortedChildren(taskId, childMap)) {
    result.push(child.id);
    result.push(...getDescendantIdsInDisplayOrder(child.id, childMap));
  }

  return result;
}

function getSortedChildren(taskId: string, childMap: Map<string, Task[]>): Task[] {
  return [...(childMap.get(taskId) ?? [])].sort(compareTasks);
}

function computeDepth(task: Task, taskById: Map<string, Task>): number {
  let depth = 0;
  let current = task.parentId ? taskById.get(task.parentId) : undefined;

  while (current) {
    depth += 1;
    current = current.parentId ? taskById.get(current.parentId) : undefined;
  }

  return depth;
}

function compareTaskIds(a: string, b: string, taskById: Map<string, Task>) {
  return compareTasks(taskById.get(a), taskById.get(b));
}

function compareTasks(a: Task | undefined, b: Task | undefined) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  const orderDelta = a.sortOrder - b.sortOrder;
  if (orderDelta !== 0) return orderDelta;

  return a.id.localeCompare(b.id);
}
