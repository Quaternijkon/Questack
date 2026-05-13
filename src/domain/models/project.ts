export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  settings: ProjectSettings;
}

export interface ProjectSettings {
  readyQueueSort: 'topological' | 'priority' | 'createdAt' | 'manualOrder';
  graphDirection: 'TB' | 'LR';
  allowParentDependency: boolean;
  allowAncestorDependency: boolean;
}

export function createDefaultProjectSettings(): ProjectSettings {
  return {
    readyQueueSort: 'topological',
    graphDirection: 'TB',
    allowParentDependency: false,
    allowAncestorDependency: false,
  };
}
