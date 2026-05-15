import type { Task } from '../models/task';

export interface TaskCreationDraft {
  parentId: string | null;
  title: string;
  sortOrder: number;
}

export function createChildTaskDraft(sourceTask: Task, tasks: Task[]): TaskCreationDraft {
  const childCount = tasks.filter(
    (task) => task.parentId === sourceTask.id && task.archivedAt == null
  ).length;

  return {
    parentId: sourceTask.id,
    title: `${sourceTask.title || '未命名任务'} / 子任务 ${childCount + 1}`,
    sortOrder: childCount,
  };
}

export function createSuccessorTaskDraft(sourceTask: Task, tasks: Task[]): TaskCreationDraft {
  const siblingCount = tasks.filter(
    (task) => task.parentId === sourceTask.parentId && task.archivedAt == null
  ).length;

  return {
    parentId: sourceTask.parentId,
    title: `${sourceTask.title || '未命名任务'} 的后续任务`,
    sortOrder: siblingCount,
  };
}
