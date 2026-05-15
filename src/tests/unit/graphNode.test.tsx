import { fireEvent, render, screen } from '@testing-library/react';
import { ReactFlowProvider, type NodeProps } from '@xyflow/react';
import { describe, expect, it, vi } from 'vitest';
import TaskGraphNode from '../../components/graph/GraphNode';
import type { Task } from '../../domain/models/task';

function makeTask(id: string, title: string): Task {
  return {
    id,
    projectId: 'project-1',
    parentId: null,
    title,
    manualStatus: 'todo',
    priority: 'medium',
    sortOrder: 0,
    createdAt: '2026-05-15T00:00:00.000Z',
    updatedAt: '2026-05-15T00:00:00.000Z',
  };
}

function renderNode(overrides: Record<string, unknown> = {}) {
  const onCreateChild = vi.fn();
  const onCreateSuccessor = vi.fn();

  render(
    <ReactFlowProvider>
      <TaskGraphNode
        {...({
          id: 'task-1',
          type: 'taskNode',
          selected: false,
          dragging: false,
          zIndex: 0,
          isConnectable: true,
          xPos: 0,
          yPos: 0,
          data: {
            task: makeTask('task-1', '任务节点'),
            derivedState: undefined,
            status: 'ready',
            onCreateChild,
            onCreateSuccessor,
            ...overrides,
          },
        } as unknown as NodeProps)}
      />
    </ReactFlowProvider>
  );

  return { onCreateChild, onCreateSuccessor };
}

describe('TaskGraphNode node workbench controls', () => {
  it('exposes quick actions for child and successor task creation', () => {
    const { onCreateChild, onCreateSuccessor } = renderNode();

    fireEvent.click(screen.getByRole('button', { name: '添加子任务' }));
    fireEvent.click(screen.getByRole('button', { name: '添加后续任务' }));

    expect(onCreateChild).toHaveBeenCalledWith('task-1');
    expect(onCreateSuccessor).toHaveBeenCalledWith('task-1');
  });

  it('renders dependency input and output ports', () => {
    renderNode();

    expect(document.querySelector('.dependency-port.in')).toBeTruthy();
    expect(document.querySelector('.dependency-port.out')).toBeTruthy();
  });
});
