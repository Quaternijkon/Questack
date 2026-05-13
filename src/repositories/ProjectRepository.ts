import type { Project } from '../domain/models/project';
import type { Task } from '../domain/models/task';
import type { DependencyEdge } from '../domain/models/dependency';

export interface ProjectRepository {
  getAll(): Promise<Project[]>;
  getById(id: string): Promise<Project | undefined>;
  create(project: Omit<Project, 'id'> & { id: string }): Promise<Project>;
  update(id: string, data: Partial<Project>): Promise<Project | undefined>;
  delete(id: string): Promise<void>;
  archive(id: string): Promise<Project | undefined>;
}

export interface TaskRepository {
  getByProject(projectId: string): Promise<Task[]>;
  getAll(): Promise<Task[]>;
  getById(id: string): Promise<Task | undefined>;
  getChildren(parentId: string): Promise<Task[]>;
  getRootTasks(projectId: string): Promise<Task[]>;
  create(task: Omit<Task, 'id'> & { id: string }): Promise<Task>;
  update(id: string, data: Partial<Task>): Promise<Task | undefined>;
  delete(id: string): Promise<void>;
  deleteByProject(projectId: string): Promise<void>;
  bulkUpdate(updates: { id: string; data: Partial<Task> }[]): Promise<void>;
}

export interface DependencyRepository {
  getByProject(projectId: string): Promise<DependencyEdge[]>;
  getAll(): Promise<DependencyEdge[]>;
  getById(id: string): Promise<DependencyEdge | undefined>;
  getIncoming(taskId: string): Promise<DependencyEdge[]>;
  getOutgoing(taskId: string): Promise<DependencyEdge[]>;
  create(edge: Omit<DependencyEdge, 'id'> & { id: string }): Promise<DependencyEdge>;
  delete(id: string): Promise<void>;
  deleteByTask(taskId: string): Promise<void>;
  deleteByProject(projectId: string): Promise<void>;
}
