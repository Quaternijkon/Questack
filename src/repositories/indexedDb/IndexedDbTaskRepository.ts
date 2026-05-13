import { db } from './db';
import type { Task } from '../../domain/models/task';
import type { TaskRepository } from '../ProjectRepository';

export class IndexedDbTaskRepository implements TaskRepository {
  async getByProject(projectId: string): Promise<Task[]> {
    return db.tasks.where('projectId').equals(projectId).toArray();
  }

  async getAll(): Promise<Task[]> {
    return db.tasks.toArray();
  }

  async getById(id: string): Promise<Task | undefined> {
    return db.tasks.get(id);
  }

  async getChildren(parentId: string): Promise<Task[]> {
    return db.tasks.where('parentId').equals(parentId).sortBy('sortOrder');
  }

  async getRootTasks(projectId: string): Promise<Task[]> {
    return db.tasks
      .where('projectId')
      .equals(projectId)
      .filter((t) => t.parentId === null)
      .sortBy('sortOrder');
  }

  async create(task: Omit<Task, 'id'> & { id: string }): Promise<Task> {
    await db.tasks.put(task as Task);
    return task as Task;
  }

  async update(id: string, data: Partial<Task>): Promise<Task | undefined> {
    const count = await db.tasks.update(id, { ...data, updatedAt: new Date().toISOString() });
    if (count === 0) return undefined;
    return db.tasks.get(id);
  }

  async delete(id: string): Promise<void> {
    await db.tasks.delete(id);
  }

  async deleteByProject(projectId: string): Promise<void> {
    const tasks = await this.getByProject(projectId);
    await db.tasks.bulkDelete(tasks.map((t) => t.id));
  }

  async bulkUpdate(updates: { id: string; data: Partial<Task> }[]): Promise<void> {
    const now = new Date().toISOString();
    const prepared = updates.map((u) => {
      const existing = { ...u.data, updatedAt: now };
      return { key: u.id, changes: existing };
    });
    await db.transaction('rw', db.tasks, async () => {
      for (const { key, changes } of prepared) {
        await db.tasks.update(key, changes);
      }
    });
  }
}
