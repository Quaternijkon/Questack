import { create } from 'zustand';
import type { Task, ManualTaskStatus, DerivedTaskState } from '../domain/models/task';
import { IndexedDbTaskRepository } from '../repositories/indexedDb/IndexedDbTaskRepository';
import { IndexedDbDependencyRepository } from '../repositories/indexedDb/IndexedDbDependencyRepository';
import { computeAllDerivedStates, buildChildMap } from '../domain/services/taskTreeService';
import { useGraphStore } from './graphStore';

interface TaskStoreState {
  tasks: Task[];
  derivedStates: Map<string, DerivedTaskState>;
  selectedTaskId: string | null;
  loading: boolean;

  loadTasks: (projectId: string) => Promise<void>;
  createTask: (
    projectId: string,
    parentId: string | null,
    title: string,
    sortOrder?: number
  ) => Promise<Task>;
  updateTask: (id: string, data: Partial<Task>) => Promise<void>;
  updateTaskManualStatus: (id: string, status: ManualTaskStatus) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  moveTask: (taskId: string, newParentId: string | null) => Promise<void>;
  selectTask: (id: string | null) => void;
  getSelectedTask: () => Task | undefined;
  getTaskById: (id: string) => Task | undefined;
  refreshDerivedStates: () => void;
  getChildMap: () => Map<string, Task[]>;
  getLeafTasks: () => Task[];
  getContainerTasks: () => Task[];
}

const taskRepo = new IndexedDbTaskRepository();
const depRepo = new IndexedDbDependencyRepository();

export const useTaskStore = create<TaskStoreState>((set, get) => ({
  tasks: [],
  derivedStates: new Map(),
  selectedTaskId: null,
  loading: false,

  loadTasks: async (projectId: string) => {
    set({ loading: true });
    const tasks = await taskRepo.getByProject(projectId);
    set({ tasks, loading: false });
    get().refreshDerivedStates();
  },

  createTask: async (projectId: string, parentId: string | null, title: string, sortOrder?: number) => {
    const now = new Date().toISOString();
    const children = await taskRepo.getChildren(parentId ?? '');
    const order = sortOrder ?? children.length;

    const task: Task = {
      id: crypto.randomUUID(),
      projectId,
      parentId,
      title,
      manualStatus: 'todo',
      priority: 'medium',
      sortOrder: order,
      createdAt: now,
      updatedAt: now,
    };
    await taskRepo.create(task);
    set((state) => ({ tasks: [...state.tasks, task] }));
    get().refreshDerivedStates();
    return task;
  },

  updateTask: async (id: string, data: Partial<Task>) => {
    const updated = await taskRepo.update(id, data);
    if (updated) {
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updated } : t)),
      }));
      get().refreshDerivedStates();
    }
  },

  updateTaskManualStatus: async (id: string, status: ManualTaskStatus) => {
    await get().updateTask(id, { manualStatus: status });
  },

  deleteTask: async (id: string) => {
    const childMap = buildChildMap(get().tasks);
    const idsToDelete = new Set<string>();
    const stack = [id];
    while (stack.length > 0) {
      const current = stack.pop()!;
      idsToDelete.add(current);
      for (const child of childMap.get(current) ?? []) {
        stack.push(child.id);
      }
    }
    for (const taskId of idsToDelete) {
      await depRepo.deleteByTask(taskId);
      await taskRepo.delete(taskId);
    }
    set((state) => ({
      tasks: state.tasks.filter((t) => !idsToDelete.has(t.id)),
      selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId,
    }));
    useGraphStore.getState().loadEdges(useProjectStore().currentProjectId ?? '');
    get().refreshDerivedStates();
  },

  moveTask: async (taskId: string, newParentId: string | null) => {
    const taskData = get().tasks.find((t) => t.id === taskId);
    if (!taskData) return;

    const childrenIds = new Set<string>();
    const childMap = buildChildMap(get().tasks);
    const stack = [taskId];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      childrenIds.add(cur);
      for (const c of childMap.get(cur) ?? []) stack.push(c.id);
    }

    if (childrenIds.has(newParentId ?? '')) return;

    const siblings = get().tasks.filter(
      (t) => t.parentId === newParentId && t.id !== taskId
    );
    const order = siblings.length;

    await taskRepo.update(taskId, { parentId: newParentId, sortOrder: order });
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, parentId: newParentId, sortOrder: order } : t
      ),
    }));
    get().refreshDerivedStates();
  },

  selectTask: (id: string | null) => set({ selectedTaskId: id }),

  getSelectedTask: () => {
    const { tasks, selectedTaskId } = get();
    return tasks.find((t) => t.id === selectedTaskId);
  },

  getTaskById: (id: string) => {
    return get().tasks.find((t) => t.id === id);
  },

  refreshDerivedStates: () => {
    const { tasks } = get();
    const edges = useGraphStore.getState().edges;
    const derivedStates = computeAllDerivedStates(tasks, edges);
    set({ derivedStates });
  },

  getChildMap: () => buildChildMap(get().tasks),

  getLeafTasks: () => {
    const childMap = buildChildMap(get().tasks);
    return get().tasks.filter((t) => (childMap.get(t.id) ?? []).length === 0);
  },

  getContainerTasks: () => {
    const childMap = buildChildMap(get().tasks);
    return get().tasks.filter((t) => (childMap.get(t.id) ?? []).length > 0);
  },
}));

import { useProjectStore } from './projectStore';
