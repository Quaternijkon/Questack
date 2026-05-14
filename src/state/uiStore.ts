import { create } from 'zustand';

export type ViewMode = 'tree' | 'graph' | 'ready-queue' | 'roadmap';
export type InspectorTab = 'details' | 'dependencies' | 'activity';
export type ThemeMode = 'light' | 'dark';
export type GraphLayoutMode = 'auto' | 'edit';
export type GraphManualPositions = Record<string, Record<string, { x: number; y: number }>>;
export type DependencyDraft = {
  sourceTaskId: string | null;
  targetTaskId: string | null;
};

const GRAPH_MANUAL_POSITIONS_KEY = 'questack:graphManualPositions';
const THEME_MODE_KEY = 'questack:themeMode';

export interface UIStoreState {
  themeMode: ThemeMode;
  viewMode: ViewMode;
  inspectorOpen: boolean;
  inspectorTab: InspectorTab;
  sidebarCollapsed: boolean;
  expandedTaskIds: Set<string>;
  graphFilter: 'all' | 'ready' | 'blocked' | 'done' | 'in_progress' | 'todo' | 'canceled';
  showGraphFilter: boolean;
  selectedProjectId: string | null;
  graphLayoutMode: GraphLayoutMode;
  graphManualPositions: GraphManualPositions;
  dependencyDraft: DependencyDraft;

  setThemeMode: (mode: ThemeMode) => void;
  toggleThemeMode: () => void;
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
  startDependencyDraft: (sourceTaskId: string) => void;
  setDependencyDraftTarget: (targetTaskId: string | null) => void;
  clearDependencyDraft: () => void;
}

export const useUIStore = create<UIStoreState>((set, get) => ({
  themeMode: loadThemeMode(),
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
  dependencyDraft: { sourceTaskId: null, targetTaskId: null },

  setThemeMode: (mode) => {
    persistThemeMode(mode);
    set({ themeMode: mode });
  },

  toggleThemeMode: () => {
    const next = get().themeMode === 'light' ? 'dark' : 'light';
    persistThemeMode(next);
    set({ themeMode: next });
  },

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

  startDependencyDraft: (sourceTaskId) =>
    set({ dependencyDraft: { sourceTaskId, targetTaskId: null } }),

  setDependencyDraftTarget: (targetTaskId) =>
    set((state) => ({
      dependencyDraft: {
        ...state.dependencyDraft,
        targetTaskId,
      },
    })),

  clearDependencyDraft: () =>
    set({ dependencyDraft: { sourceTaskId: null, targetTaskId: null } }),
}));

function loadThemeMode(): ThemeMode {
  if (typeof localStorage === 'undefined') return 'light';
  const stored = localStorage.getItem(THEME_MODE_KEY);
  return stored === 'dark' ? 'dark' : 'light';
}

function persistThemeMode(mode: ThemeMode) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(THEME_MODE_KEY, mode);
}

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
