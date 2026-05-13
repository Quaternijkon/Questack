import { create } from 'zustand';
import type { DependencyEdge, BlockReason } from '../domain/models/dependency';
import type { Task } from '../domain/models/task';
import { IndexedDbDependencyRepository } from '../repositories/indexedDb/IndexedDbDependencyRepository';
import { wouldCreateCycle, buildGraph, computeReadyTasks, computeBlockedReasons, topologicalSort } from '../domain/services/graphService';
import { buildChildMap } from '../domain/services/taskTreeService';
import { useTaskStore } from './taskStore';

interface GraphStoreState {
  edges: DependencyEdge[];
  readyTasks: Task[];
  blockedReasons: BlockReason[];
  topologicalOrder: string[];
  loading: boolean;

  loadEdges: (projectId: string) => Promise<void>;
  addDependency: (fromTaskId: string, toTaskId: string, projectId: string) => Promise<{ success: boolean; message?: string }>;
  removeDependency: (edgeId: string) => Promise<void>;
  refreshReadyQueue: () => void;
  getIncomingEdges: (taskId: string) => DependencyEdge[];
  getOutgoingEdges: (taskId: string) => DependencyEdge[];
  checkWouldCreateCycle: (fromId: string, toId: string) => boolean;
  getTopologicalOrder: () => string[];
}

const repo = new IndexedDbDependencyRepository();

export const useGraphStore = create<GraphStoreState>((set, get) => ({
  edges: [],
  readyTasks: [],
  blockedReasons: [],
  topologicalOrder: [],
  loading: false,

  loadEdges: async (projectId: string) => {
    set({ loading: true });
    const edges = await repo.getByProject(projectId);
    set({ edges, loading: false });
    get().refreshReadyQueue();
  },

  addDependency: async (fromTaskId: string, toTaskId: string, projectId: string) => {
    const tasks = useTaskStore.getState().tasks;
    const { edges } = get();
    const { adjacency } = buildGraph(tasks, edges);

    if (wouldCreateCycle(fromTaskId, toTaskId, adjacency)) {
      return { success: false, message: 'Adding this dependency would create a cycle' };
    }

    const exists = edges.some(
      (e) => e.fromTaskId === fromTaskId && e.toTaskId === toTaskId
    );
    if (exists) {
      return { success: false, message: 'This dependency already exists' };
    }

    const edge: DependencyEdge = {
      id: crypto.randomUUID(),
      projectId,
      fromTaskId,
      toTaskId,
      type: 'finish_to_start',
      createdAt: new Date().toISOString(),
    };
    await repo.create(edge);
    set((state) => ({ edges: [...state.edges, edge] }));
    useTaskStore.getState().refreshDerivedStates();
    get().refreshReadyQueue();
    return { success: true };
  },

  removeDependency: async (edgeId: string) => {
    await repo.delete(edgeId);
    set((state) => ({ edges: state.edges.filter((e) => e.id !== edgeId) }));
    useTaskStore.getState().refreshDerivedStates();
    get().refreshReadyQueue();
  },

  refreshReadyQueue: () => {
    const tasks = useTaskStore.getState().tasks.filter((t) => t.archivedAt == null);
    const { edges } = get();
    const childMap = buildChildMap(tasks);

    const readyTasks = computeReadyTasks(tasks, edges, childMap);
    const blockedReasons = computeBlockedReasons(tasks, edges);

    let topologicalOrder: string[];
    try {
      topologicalOrder = topologicalSort(tasks, edges);
    } catch {
      topologicalOrder = [];
    }

    set({ readyTasks, blockedReasons, topologicalOrder });
  },

  getIncomingEdges: (taskId: string) => {
    return get().edges.filter((e) => e.toTaskId === taskId);
  },

  getOutgoingEdges: (taskId: string) => {
    return get().edges.filter((e) => e.fromTaskId === taskId);
  },

  checkWouldCreateCycle: (fromId: string, toId: string) => {
    const tasks = useTaskStore.getState().tasks;
    const { edges } = get();
    const { adjacency } = buildGraph(tasks, edges);
    return wouldCreateCycle(fromId, toId, adjacency);
  },

  getTopologicalOrder: () => get().topologicalOrder,
}));
