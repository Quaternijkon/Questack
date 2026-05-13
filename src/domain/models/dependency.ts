export interface DependencyEdge {
  id: string;
  projectId: string;
  fromTaskId: string;
  toTaskId: string;
  type: 'finish_to_start';
  createdAt: string;
}

export interface BlockReason {
  taskId: string;
  unmetPrerequisites: { id: string; title: string; manualStatus: string }[];
}

export function createDependencyEdge(
  projectId: string,
  fromTaskId: string,
  toTaskId: string
): Omit<DependencyEdge, 'id'> {
  return {
    projectId,
    fromTaskId,
    toTaskId,
    type: 'finish_to_start',
    createdAt: new Date().toISOString(),
  };
}
