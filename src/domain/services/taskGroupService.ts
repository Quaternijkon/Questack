import type { DependencyEdge } from '../models/dependency';
import type { Task } from '../models/task';

export type TaskGroupKind = 'independent' | 'interdependent';

export interface TaskGroup {
  id: string;
  kind: TaskGroupKind;
  label: string;
  taskIds: string[];
  rootTaskIds: string[];
  dependencyEdgeIds: string[];
}

export function buildTaskGroups(tasks: Task[], edges: DependencyEdge[]): TaskGroup[] {
  const activeTasks = tasks.filter((task) => task.archivedAt == null).sort(compareTasks);
  const activeTaskIds = new Set(activeTasks.map((task) => task.id));
  const parent = new Map(activeTasks.map((task) => [task.id, task.id]));

  const find = (taskId: string): string => {
    const current = parent.get(taskId);
    if (!current) return taskId;
    if (current === taskId) return current;
    const root = find(current);
    parent.set(taskId, root);
    return root;
  };

  const union = (a: string, b: string) => {
    if (!activeTaskIds.has(a) || !activeTaskIds.has(b)) return;
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootB, rootA);
  };

  for (const task of activeTasks) {
    if (task.parentId && activeTaskIds.has(task.parentId)) {
      union(task.id, task.parentId);
    }
  }

  const validDependencyEdges = edges
    .filter((edge) => activeTaskIds.has(edge.fromTaskId) && activeTaskIds.has(edge.toTaskId))
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const edge of validDependencyEdges) {
    union(edge.fromTaskId, edge.toTaskId);
  }

  const tasksByGroup = new Map<string, Task[]>();
  for (const task of activeTasks) {
    const groupId = find(task.id);
    const groupTasks = tasksByGroup.get(groupId) ?? [];
    groupTasks.push(task);
    tasksByGroup.set(groupId, groupTasks);
  }

  const taskById = new Map(activeTasks.map((task) => [task.id, task]));

  const groups = [...tasksByGroup.values()].map((groupTasks): TaskGroup => {
    const groupTaskIds = new Set(groupTasks.map((task) => task.id));
    const rootTasks = groupTasks
      .filter((task) => !task.parentId || !groupTaskIds.has(task.parentId))
      .sort(compareTasks);
    const dependencyEdgeIds = validDependencyEdges
      .filter((edge) => groupTaskIds.has(edge.fromTaskId) && groupTaskIds.has(edge.toTaskId))
      .map((edge) => edge.id);
    const rootTaskIds = rootTasks.map((task) => task.id);
    const id = `task-group:${rootTaskIds.join('|') || groupTasks[0]?.id || 'empty'}`;
    const label = buildGroupLabel(rootTasks, taskById);

    return {
      id,
      kind: dependencyEdgeIds.length > 0 ? 'interdependent' : 'independent',
      label,
      taskIds: groupTasks.sort(compareTasks).map((task) => task.id),
      rootTaskIds,
      dependencyEdgeIds,
    };
  });

  return groups.sort((a, b) => compareTaskIds(a.rootTaskIds[0], b.rootTaskIds[0], taskById));
}

function buildGroupLabel(rootTasks: Task[], taskById: Map<string, Task>): string {
  if (rootTasks.length === 0) return 'Task group';
  if (rootTasks.length === 1) return rootTasks[0].title || 'Untitled task group';

  const firstTitle = taskById.get(rootTasks[0].id)?.title || 'Untitled task group';
  return `${firstTitle} + ${rootTasks.length - 1}`;
}

function compareTaskIds(a: string | undefined, b: string | undefined, taskById: Map<string, Task>): number {
  return compareTasks(a ? taskById.get(a) : undefined, b ? taskById.get(b) : undefined);
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
