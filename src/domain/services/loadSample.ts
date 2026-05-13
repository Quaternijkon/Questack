import { generateSampleData } from './sampleData';
import { db } from '../../repositories/indexedDb/db';
import type { Task } from '../models/task';
import type { DependencyEdge } from '../models/dependency';

export async function loadSampleIntoStores() {
  const { project, tasks, edges } = generateSampleData();

  await db.projects.put(project);

  for (const task of tasks) {
    await db.tasks.put(task as Task);
  }

  for (const edge of edges) {
    await db.dependencyEdges.put(edge as DependencyEdge);
  }

  return project.id;
}
