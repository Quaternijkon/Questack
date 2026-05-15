import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../../domain/models/task';
import { computeAllDerivedStates } from '../../domain/services/taskTreeService';
import { useGraphStore } from '../../state/graphStore';
import { useProjectStore } from '../../state/projectStore';
import { useTaskStore } from '../../state/taskStore';
import { useUIStore } from '../../state/uiStore';

const reactFlowMock = vi.hoisted(() => ({
  latestProps: undefined as undefined | {
    nodesDraggable: boolean;
    onNodeDragStop: (_event: unknown, node: { id: string; position: { x: number; y: number } }) => void;
  },
}));

vi.mock('@xyflow/react', () => ({
  Background: () => null,
  Controls: () => null,
  Handle: () => null,
  MarkerType: { ArrowClosed: 'arrowclosed' },
  MiniMap: () => null,
  Position: { Left: 'left', Right: 'right' },
  ReactFlow: (props: {
    children?: React.ReactNode;
    nodesDraggable: boolean;
    onNodeDragStop: (_event: unknown, node: { id: string; position: { x: number; y: number } }) => void;
  }) => {
    reactFlowMock.latestProps = props;
    return (
      <div data-testid="react-flow" data-nodes-draggable={String(props.nodesDraggable)}>
        {props.children}
      </div>
    );
  },
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ViewportPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useEdgesState: <T,>(initialEdges: T) => [initialEdges, vi.fn(), vi.fn()],
  useNodesState: <T,>(initialNodes: T) => [initialNodes, vi.fn(), vi.fn()],
}));

import GraphView from '../../components/graph/GraphView';

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

describe('GraphView free dragging', () => {
  beforeEach(() => {
    const tasks = [makeTask('task-1')];

    useProjectStore.setState({ currentProjectId: 'project-1' });
    useTaskStore.setState({
      tasks,
      derivedStates: computeAllDerivedStates(tasks, []),
      selectedTaskId: null,
      loading: false,
    });
    useGraphStore.setState({
      edges: [],
      readyTasks: [],
      blockedReasons: [],
      topologicalOrder: [],
      loading: false,
    });
    useUIStore.setState({
      graphLayoutMode: 'auto',
      graphManualPositions: {},
      graphFilter: 'all',
      dependencyDraft: { sourceTaskId: null, targetTaskId: null },
    });
    reactFlowMock.latestProps = undefined;
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps graph nodes draggable in auto layout and persists the first drag as free layout', () => {
    render(<GraphView />);

    expect(screen.getByTestId('react-flow').getAttribute('data-nodes-draggable')).toBe('true');

    act(() => {
      reactFlowMock.latestProps?.onNodeDragStop(null, {
        id: 'task-1',
        position: { x: 320, y: 240 },
      });
    });

    expect(useUIStore.getState().graphLayoutMode).toBe('edit');
    expect(useUIStore.getState().getGraphManualPositions('project-1')).toEqual({
      'task-1': { x: 320, y: 240 },
    });
  });
});
