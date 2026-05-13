import { create } from 'zustand';

export type ViewMode = 'tree' | 'graph' | 'ready-queue' | 'roadmap';
export type InspectorTab = 'details' | 'dependencies' | 'activity';
export type GraphLayoutMode = 'auto' | 'edit';
export type GraphManualPositions = Record<string, Record<string, { x: number; y: number }>>;

const GRAPH_MANUAL_POSITIONS_KEY = 'questack:graphManualPositions';

export interface UIStoreState {
  viewMode: ViewMode;
  inspectorOpen: boolean;
  inspectorTab: InspectorTab;
  sidebarCollapsed: boolean;
  expandedTaskIds: Set<string>;
  graphFilter: 'all' | 'ready' | 'blocked' | 'done' | 'in_progress';
  showGraphFilter: boolean;
  selectedProjectId: string | null;
  graphLayoutMode: GraphLayoutMode;
  graphManualPositions: GraphManualPositions;

  setViewMode: (mode: ViewMode) => void;
  toggleInspector: () => void;
  openInspector: (tab?: InspectorTab) => void;
  closeInspector: () => void;
  setInspectorTab: (tab: InspectorTab) => void;
  toggleSidebar: () => void;
  toggleTaskExpanded: (taskId: string) => void;
  setTaskExpanded: (taskId: string, expanded: boolean) => void;
  setAllExpanded: () => void;
  setAllCollapsed: () => void;
  isTaskExpanded: (taskId: string) => boolean;
  setGraphFilter: (filter: UIStoreState['graphFilter']) => void;
  setGraphLayoutMode: (mode: GraphLayoutMode) => void;
  saveGraphNodePosition: (projectId: string, taskId: string, position: { x: number; y: number }) => void;
  clearGraphManualPositions: (projectId: string) => void;
  getGraphManualPositions: (projectId: string) => Record<string, { x: number; y: number }>;
}

export const useUIStore = create<UIStoreState>((set, get) => ({
  viewMode: 'tree',
  inspectorOpen: false,
  inspectorTab: 'details',
  sidebarCollapsed: false,
  expandedTaskIds: new Set<string>(),
  graphFilter: 'all',
  showGraphFilter: true,
  selectedProjectId: null,
  graphLayoutMode: 'auto',
  graphManualPositions: loadGraphManualPositions(),

  setViewMode: (mode) => set({ viewMode: mode }),

  toggleInspector: () => set((state) => ({ inspectorOpen: !state.inspectorOpen })),
  openInspector: (tab) =>
    set({ inspectorOpen: true, inspectorTab: tab ?? 'details' }),
  closeInspector: () => set({ inspectorOpen: false }),
  setInspectorTab: (tab) => set({ inspectorTab: tab }),

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  toggleTaskExpanded: (taskId) =>
    set((state) => {
      const newSet = new Set(state.expandedTaskIds);
      if (newSet.has(taskId)) newSet.delete(taskId);
      else newSet.add(taskId);
      return { expandedTaskIds: newSet };
    }),

  setTaskExpanded: (taskId, expanded) =>
    set((state) => {
      const newSet = new Set(state.expandedTaskIds);
      if (expanded) newSet.add(taskId);
      else newSet.delete(taskId);
      return { expandedTaskIds: newSet };
    }),

  setAllExpanded: () => {
    return { expandedTaskIds: new Set() };
  },

  setAllCollapsed: () => {
    return { expandedTaskIds: new Set() };
  },

  isTaskExpanded: (taskId) => get().expandedTaskIds.has(taskId),

  setGraphFilter: (filter) => set({ graphFilter: filter }),

  setGraphLayoutMode: (mode) => set({ graphLayoutMode: mode }),

  saveGraphNodePosition: (projectId, taskId, position) =>
    set((state) => {
      const next: GraphManualPositions = {
        ...state.graphManualPositions,
        [projectId]: {
          ...(state.graphManualPositions[projectId] ?? {}),
          [taskId]: position,
        },
      };
      persistGraphManualPositions(next);
      return { graphManualPositions: next };
    }),

  clearGraphManualPositions: (projectId) =>
    set((state) => {
      const next: GraphManualPositions = { ...state.graphManualPositions };
      delete next[projectId];
      persistGraphManualPositions(next);
      return { graphManualPositions: next };
    }),

  getGraphManualPositions: (projectId) => get().graphManualPositions[projectId] ?? {},
}));

function loadGraphManualPositions(): GraphManualPositions {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(GRAPH_MANUAL_POSITIONS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as GraphManualPositions;
  } catch {
    return {};
  }
}

function persistGraphManualPositions(positions: GraphManualPositions) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(GRAPH_MANUAL_POSITIONS_KEY, JSON.stringify(positions));
}
