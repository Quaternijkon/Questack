import { db } from './db';
import type { Project } from '../../domain/models/project';
import type { ProjectRepository } from '../ProjectRepository';

export class IndexedDbProjectRepository implements ProjectRepository {
  async getAll(): Promise<Project[]> {
    return db.projects.filter((project) => project.archivedAt == null || project.archivedAt === '').toArray();
  }

  async getById(id: string): Promise<Project | undefined> {
    return db.projects.get(id);
  }

  async create(project: Omit<Project, 'id'> & { id: string }): Promise<Project> {
    await db.projects.put(project as Project);
    return project as Project;
  }

  async update(id: string, data: Partial<Project>): Promise<Project | undefined> {
    const count = await db.projects.update(id, { ...data, updatedAt: new Date().toISOString() });
    if (count === 0) return undefined;
    return db.projects.get(id);
  }

  async delete(id: string): Promise<void> {
    await db.projects.delete(id);
  }

  async archive(id: string): Promise<Project | undefined> {
    return this.update(id, { archivedAt: new Date().toISOString() });
  }
}
