import { generateSampleData } from './sampleData';
import { db } from '../../repositories/indexedDb/db';

export async function loadSampleIntoStores() {
  const { project, tasks, edges } = generateSampleData();

  await db.projects.put(project);

  for (const task of tasks) {
    await db.tasks.put(task);
  }

  for (const edge of edges) {
    await db.dependencyEdges.put(edge);
  }

  return project.id;
}
