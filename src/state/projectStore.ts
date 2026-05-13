import { create } from 'zustand';
import type { Project, ProjectSettings } from '../domain/models/project';
import { createDefaultProjectSettings } from '../domain/models/project';
import { IndexedDbProjectRepository } from '../repositories/indexedDb/IndexedDbProjectRepository';

interface ProjectStoreState {
  projects: Project[];
  currentProjectId: string | null;
  loading: boolean;

  loadProjects: () => Promise<void>;
  createProject: (name: string, description?: string) => Promise<Project>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setCurrentProject: (id: string | null) => void;
  getCurrentProject: () => Project | undefined;
  updateProjectSettings: (id: string, settings: Partial<ProjectSettings>) => Promise<void>;
}

const repo = new IndexedDbProjectRepository();

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  projects: [],
  currentProjectId: null,
  loading: false,

  loadProjects: async () => {
    set({ loading: true });
    const projects = await repo.getAll();
    set({ projects, loading: false });
  },

  createProject: async (name: string, description?: string) => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const project: Project = {
      id,
      name,
      description,
      createdAt: now,
      updatedAt: now,
      settings: createDefaultProjectSettings(),
    };
    await repo.create(project);
    set((state) => ({
      projects: [...state.projects, project],
      currentProjectId: state.currentProjectId ?? id,
    }));
    return project;
  },

  updateProject: async (id: string, data: Partial<Project>) => {
    const updated = await repo.update(id, data);
    if (updated) {
      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? { ...p, ...updated } : p)),
      }));
    }
  },

  deleteProject: async (id: string) => {
    await repo.delete(id);
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProjectId: state.currentProjectId === id ? null : state.currentProjectId,
    }));
  },

  setCurrentProject: (id: string | null) => {
    set({ currentProjectId: id });
  },

  getCurrentProject: () => {
    const { projects, currentProjectId } = get();
    return projects.find((p) => p.id === currentProjectId);
  },

  updateProjectSettings: async (id: string, settings: Partial<ProjectSettings>) => {
    const project = get().projects.find((p) => p.id === id);
    if (!project) return;
    const newSettings = { ...project.settings, ...settings };
    const updated = await repo.update(id, { settings: newSettings });
    if (updated) {
      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? { ...p, ...updated } : p)),
      }));
    }
  },
}));
