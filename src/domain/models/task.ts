export type ManualTaskStatus = 'todo' | 'in_progress' | 'done' | 'canceled';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type ComputedStatus = 'ready' | 'blocked' | 'active' | 'done' | 'canceled';
export type RollupStatus = 'todo' | 'ready' | 'in_progress' | 'blocked' | 'done' | 'canceled';

export interface Task {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  description?: string;
  manualStatus: ManualTaskStatus;
  priority: Priority;
  sortOrder: number;
  estimateMinutes?: number | null;
  dueAt?: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
}

export interface DerivedTaskState {
  taskId: string;
  isLeaf: boolean;
  depth: number;
  path: string[];
  computedStatus: ComputedStatus;
  rollupStatus?: RollupStatus;
  unmetDependencyIds: string[];
  descendantCount: number;
  completedDescendantCount: number;
}

export function createDefaultTask(projectId: string, parentId: string | null, sortOrder: number): Omit<Task, 'id'> {
  const now = new Date().toISOString();
  return {
    projectId,
    parentId,
    title: '',
    manualStatus: 'todo',
    priority: 'medium',
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };
}

export const MANUAL_STATUS_ORDER: Record<ManualTaskStatus, number> = {
  todo: 0,
  in_progress: 1,
  done: 2,
  canceled: 3,
};

export const PRIORITY_ORDER: Record<Priority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};
