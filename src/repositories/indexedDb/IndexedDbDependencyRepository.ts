import { db } from './db';
import type { DependencyEdge } from '../../domain/models/dependency';
import type { DependencyRepository } from '../ProjectRepository';

export class IndexedDbDependencyRepository implements DependencyRepository {
  async getByProject(projectId: string): Promise<DependencyEdge[]> {
    return db.dependencyEdges.where('projectId').equals(projectId).toArray();
  }

  async getAll(): Promise<DependencyEdge[]> {
    return db.dependencyEdges.toArray();
  }

  async getById(id: string): Promise<DependencyEdge | undefined> {
    return db.dependencyEdges.get(id);
  }

  async getIncoming(taskId: string): Promise<DependencyEdge[]> {
    return db.dependencyEdges.where('toTaskId').equals(taskId).toArray();
  }

  async getOutgoing(taskId: string): Promise<DependencyEdge[]> {
    return db.dependencyEdges.where('fromTaskId').equals(taskId).toArray();
  }

  async create(edge: Omit<DependencyEdge, 'id'> & { id: string }): Promise<DependencyEdge> {
    await db.dependencyEdges.put(edge as DependencyEdge);
    return edge as DependencyEdge;
  }

  async delete(id: string): Promise<void> {
    await db.dependencyEdges.delete(id);
  }

  async deleteByTask(taskId: string): Promise<void> {
    const incoming = await this.getIncoming(taskId);
    const outgoing = await this.getOutgoing(taskId);
    const ids = new Set([...incoming, ...outgoing].map((e) => e.id));
    await db.dependencyEdges.bulkDelete([...ids]);
  }

  async deleteByProject(projectId: string): Promise<void> {
    const edges = await this.getByProject(projectId);
    await db.dependencyEdges.bulkDelete(edges.map((e) => e.id));
  }
}
