import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TaskTreeItem from '../../components/task-tree/TaskTreeItem';
import type { Task } from '../../domain/models/task';
import { computeAllDerivedStates } from '../../domain/services/taskTreeService';
import { useTaskStore } from '../../state/taskStore';
import { useUIStore } from '../../state/uiStore';

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    projectId: 'project-1',
    parentId: null,
    title: `Task ${id}`,
    manualStatus: 'todo',
    priority: 'medium',
    sortOrder: 0,
    createdAt: '2026-05-15T00:00:00.000Z',
    updatedAt: '2026-05-15T00:00:00.000Z',
    ...overrides,
  };
}

describe('TaskTreeItem expand control', () => {
  beforeEach(() => {
    const tasks = [
      makeTask('parent'),
      makeTask('child', { parentId: 'parent' }),
    ];
    useTaskStore.setState({
      tasks,
      derivedStates: computeAllDerivedStates(tasks, []),
      selectedTaskId: null,
      loading: false,
    });
    useUIStore.setState({ expandedTaskIds: new Set<string>() });
  });

  afterEach(() => {
    cleanup();
  });

  it('toggles children from a dedicated button without selecting the row', () => {
    const onSelect = vi.fn();

    render(
      <TaskTreeItem
        task={useTaskStore.getState().tasks[0]}
        depth={0}
        onSelect={onSelect}
        onContextMenu={vi.fn()}
        selectedTaskId={null}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '展开子任务' }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText('Task child')).toBeTruthy();
    expect(screen.getByRole('button', { name: '收起子任务' })).toBeTruthy();
  });
});
