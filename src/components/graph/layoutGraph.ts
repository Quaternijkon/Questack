import dagre from 'dagre';
import type { Task } from '../../domain/models/task';
import type { DependencyEdge } from '../../domain/models/dependency';

export function layoutGraph(
  tasks: Task[],
  edges: DependencyEdge[],
  direction: 'TB' | 'LR' = 'TB'
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const task of tasks) {
    g.setNode(task.id, { width: 180, height: 60 });
  }

  for (const edge of edges) {
    g.setEdge(edge.fromTaskId, edge.toTaskId);
  }

  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  for (const task of tasks) {
    const node = g.node(task.id);
    if (node) {
      positions.set(task.id, {
        x: node.x - 90,
        y: node.y - 30,
      });
    }
  }

  return positions;
}
