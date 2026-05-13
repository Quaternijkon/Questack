import Dexie, { type Table } from 'dexie';
import type { Project } from '../../domain/models/project';
import type { Task } from '../../domain/models/task';
import type { DependencyEdge } from '../../domain/models/dependency';

export class QuestackDB extends Dexie {
  projects!: Table<Project, string>;
  tasks!: Table<Task, string>;
  dependencyEdges!: Table<DependencyEdge, string>;

  constructor() {
    super('questack');
    this.version(1).stores({
      projects: 'id, name, createdAt, archivedAt',
      tasks: 'id, projectId, parentId, manualStatus, sortOrder, createdAt, archivedAt',
      dependencyEdges: 'id, projectId, fromTaskId, toTaskId, createdAt',
    });
  }
}

export const db = new QuestackDB();
