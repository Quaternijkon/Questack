import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProjectShell } from '../../components/layout/ProjectShell';
import { createDefaultProjectSettings } from '../../domain/models/project';
import { db } from '../../repositories/indexedDb/db';
import { IndexedDbProjectRepository } from '../../repositories/indexedDb/IndexedDbProjectRepository';
import { useGraphStore } from '../../state/graphStore';
import { useProjectStore } from '../../state/projectStore';
import { useTaskStore } from '../../state/taskStore';

describe('ProjectShell sample loading', () => {
  beforeEach(async () => {
    await db.projects.clear();
    await db.tasks.clear();
    await db.dependencyEdges.clear();
    useProjectStore.setState({ projects: [], currentProjectId: null, loading: false });
    useTaskStore.setState({ tasks: [], derivedStates: new Map(), selectedTaskId: null, loading: false });
    useGraphStore.setState({
      edges: [],
      readyTasks: [],
      blockedReasons: [],
      topologicalOrder: [],
      loading: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('returns active projects when archivedAt is missing', async () => {
    const now = new Date().toISOString();
    const repo = new IndexedDbProjectRepository();

    await db.projects.bulkPut([
      {
        id: 'active-project',
        name: 'Active project',
        createdAt: now,
        updatedAt: now,
        settings: createDefaultProjectSettings(),
      },
      {
        id: 'archived-project',
        name: 'Archived project',
        createdAt: now,
        updatedAt: now,
        archivedAt: now,
        settings: createDefaultProjectSettings(),
      },
    ]);

    const projects = await repo.getAll();

    expect(projects.map((project) => project.id)).toEqual(['active-project']);
  });

  it('loads the feature tour sample from the empty start screen', async () => {
    const { container } = render(<ProjectShell />);
    const buttons = container.querySelectorAll('.empty-state button');

    expect(buttons).toHaveLength(2);

    fireEvent.click(buttons[1]);

    await waitFor(() => {
      expect(useProjectStore.getState().projects[0]?.name).toContain('Questack');
      expect(useTaskStore.getState().tasks.length).toBeGreaterThanOrEqual(40);
      expect(useGraphStore.getState().edges.length).toBeGreaterThanOrEqual(30);
    });

    const projectId = useProjectStore.getState().projects[0].id;
    expect(useProjectStore.getState().currentProjectId).toBe(projectId);
  });
});
