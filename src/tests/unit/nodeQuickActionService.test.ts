import { describe, expect, it } from 'vitest';
import type { Task } from '../../domain/models/task';
import {
  createChildTaskDraft,
  createSuccessorTaskDraft,
} from '../../domain/services/nodeQuickActionService';

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    projectId: 'project-1',
    parentId: null,
    title: id,
    manualStatus: 'todo',
    priority: 'medium',
    sortOrder: 0,
    createdAt: '2026-05-15T00:00:00.000Z',
    updatedAt: '2026-05-15T00:00:00.000Z',
    ...overrides,
  };
}

describe('node quick action drafts', () => {
  it('creates a child draft under the source node after existing children', () => {
    const source = makeTask('source', { title: '设计节点工作台', sortOrder: 2 });
    const tasks = [
      source,
      makeTask('child-a', { parentId: 'source', sortOrder: 0 }),
      makeTask('child-b', { parentId: 'source', sortOrder: 1 }),
    ];

    expect(createChildTaskDraft(source, tasks)).toEqual({
      parentId: 'source',
      title: '设计节点工作台 / 子任务 3',
      sortOrder: 2,
    });
  });

  it('creates a successor draft as the next sibling', () => {
    const source = makeTask('source', { parentId: 'parent', title: '整理依赖', sortOrder: 1 });
    const tasks = [
      makeTask('sibling-a', { parentId: 'parent', sortOrder: 0 }),
      source,
      makeTask('sibling-b', { parentId: 'parent', sortOrder: 2 }),
    ];

    expect(createSuccessorTaskDraft(source, tasks)).toEqual({
      parentId: 'parent',
      title: '整理依赖 的后续任务',
      sortOrder: 3,
    });
  });

  it('ignores archived tasks when computing the next order', () => {
    const source = makeTask('source', { title: '入口任务' });
    const tasks = [
      source,
      makeTask('active-child', { parentId: 'source', sortOrder: 0 }),
      makeTask('archived-child', {
        parentId: 'source',
        sortOrder: 8,
        archivedAt: '2026-05-15T01:00:00.000Z',
      }),
    ];

    expect(createChildTaskDraft(source, tasks)).toMatchObject({
      parentId: 'source',
      sortOrder: 1,
    });
  });
});
