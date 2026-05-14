import type { DependencyEdge } from '../models/dependency';
import type { Task } from '../models/task';
import { buildGraph, wouldCreateCycle } from './graphService';

export type DependencyDirection = 'incoming' | 'outgoing';

export interface DependencyCandidate {
  taskId: string;
  score: number;
  reasons: string[];
}

export function getDependencyCandidates({
  sourceTaskId,
  direction,
  tasks,
  edges,
}: {
  sourceTaskId: string;
  direction: DependencyDirection;
  tasks: Task[];
  edges: DependencyEdge[];
}): DependencyCandidate[] {
  const sourceTask = tasks.find((task) => task.id === sourceTaskId && task.archivedAt == null);
  if (!sourceTask) return [];

  const activeTasks = tasks.filter(
    (task) => task.archivedAt == null && task.projectId === sourceTask.projectId
  );
  const graph = buildGraph(activeTasks, edges);

  return activeTasks
    .filter((task) => task.id !== sourceTaskId)
    .filter((task) => !edgeExists(sourceTaskId, task.id, direction, edges))
    .filter((task) => {
      const fromTaskId = direction === 'outgoing' ? sourceTaskId : task.id;
      const toTaskId = direction === 'outgoing' ? task.id : sourceTaskId;
      return !wouldCreateCycle(fromTaskId, toTaskId, graph.adjacency);
    })
    .map((task) => scoreCandidate(sourceTask, task))
    .sort((a, b) => b.score - a.score || a.taskId.localeCompare(b.taskId));
}

function edgeExists(
  sourceTaskId: string,
  candidateTaskId: string,
  direction: DependencyDirection,
  edges: DependencyEdge[]
) {
  const fromTaskId = direction === 'outgoing' ? sourceTaskId : candidateTaskId;
  const toTaskId = direction === 'outgoing' ? candidateTaskId : sourceTaskId;

  return edges.some((edge) => edge.fromTaskId === fromTaskId && edge.toTaskId === toTaskId);
}

function scoreCandidate(sourceTask: Task, candidateTask: Task): DependencyCandidate {
  let score = 0;
  const reasons: string[] = [];

  if (sourceTask.parentId === candidateTask.parentId) {
    score += 100;
    reasons.push('same parent');
  }

  if (candidateTask.priority === 'critical') {
    score += 20;
    reasons.push('critical priority');
  } else if (candidateTask.priority === 'high') {
    score += 10;
    reasons.push('high priority');
  }

  score += Math.max(0, 10 - Math.abs(sourceTask.sortOrder - candidateTask.sortOrder));

  return { taskId: candidateTask.id, score, reasons };
}
