import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import DependencyEditor from '../../components/inspector/DependencyEditor';
import type { Task } from '../../domain/models/task';
import { computeAllDerivedStates } from '../../domain/services/taskTreeService';
import { db } from '../../repositories/indexedDb/db';
import { useGraphStore } from '../../state/graphStore';
import { useProjectStore } from '../../state/projectStore';
import { useTaskStore } from '../../state/taskStore';

function makeTask(id: string, title: string, sortOrder = 0): Task {
  return {
    id,
    projectId: 'project-1',
    parentId: null,
    title,
    manualStatus: 'todo',
    priority: 'medium',
    sortOrder,
    createdAt: '2026-05-15T00:00:00.000Z',
    updatedAt: '2026-05-15T00:00:00.000Z',
  };
}

describe('DependencyEditor', () => {
  beforeEach(async () => {
    await db.dependencyEdges.clear();
    const tasks = [
      makeTask('selected', 'Selected task', 1),
      makeTask('before', 'Before task', 0),
      makeTask('after', 'After task', 2),
    ];
    useProjectStore.setState({ currentProjectId: 'project-1' });
    useTaskStore.setState({
      tasks,
      derivedStates: computeAllDerivedStates(tasks, []),
      selectedTaskId: 'selected',
      loading: false,
    });
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

  it('uses independent incoming and outgoing selectors', async () => {
    render(<DependencyEditor />);

    fireEvent.change(screen.getByLabelText('添加前置任务'), { target: { value: 'before' } });
    fireEvent.click(screen.getByRole('button', { name: '添加为前置' }));

    await waitFor(() => {
      expect(useGraphStore.getState().edges).toEqual([
        expect.objectContaining({ fromTaskId: 'before', toTaskId: 'selected' }),
      ]);
    });

    fireEvent.change(screen.getByLabelText('添加后续任务'), { target: { value: 'after' } });
    fireEvent.click(screen.getByRole('button', { name: '添加为后续' }));

    await waitFor(() => {
      expect(useGraphStore.getState().edges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ fromTaskId: 'before', toTaskId: 'selected' }),
          expect.objectContaining({ fromTaskId: 'selected', toTaskId: 'after' }),
        ])
      );
    });
  });
});
