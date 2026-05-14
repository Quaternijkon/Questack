import { describe, expect, it } from 'vitest';
import type { DependencyEdge } from '../../domain/models/dependency';
import type { Task } from '../../domain/models/task';
import { getDependencyCandidates } from '../../domain/services/dependencySuggestionService';

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

function makeEdge(id: string, fromTaskId: string, toTaskId: string): DependencyEdge {
  return {
    id,
    projectId: 'project-1',
    fromTaskId,
    toTaskId,
    type: 'finish_to_start',
    createdAt: '2026-05-15T00:00:00.000Z',
  };
}

describe('getDependencyCandidates', () => {
  it('excludes self, archived tasks, existing edges, and cycle risks', () => {
    const tasks = [
      makeTask('a', { sortOrder: 0 }),
      makeTask('b', { sortOrder: 1 }),
      makeTask('c', { sortOrder: 2 }),
      makeTask('archived', { archivedAt: '2026-05-15T01:00:00.000Z' }),
    ];
    const edges = [makeEdge('edge-1', 'a', 'b'), makeEdge('edge-2', 'b', 'c')];

    const candidates = getDependencyCandidates({
      sourceTaskId: 'c',
      direction: 'outgoing',
      tasks,
      edges,
    });

    expect(candidates.map((candidate) => candidate.taskId)).toEqual([]);
  });

  it('ranks same-parent tasks before distant tasks', () => {
    const tasks = [
      makeTask('source', { parentId: 'root', sortOrder: 1 }),
      makeTask('sibling', { parentId: 'root', sortOrder: 2 }),
      makeTask('distant', { parentId: 'other-root', sortOrder: 0 }),
    ];

    const candidates = getDependencyCandidates({
      sourceTaskId: 'source',
      direction: 'outgoing',
      tasks,
      edges: [],
    });

    expect(candidates.map((candidate) => candidate.taskId)).toEqual(['sibling', 'distant']);
    expect(candidates[0].reasons).toContain('same parent');
  });

  it('can rank incoming prerequisites separately from outgoing successors', () => {
    const tasks = [
      makeTask('selected', { parentId: 'root', sortOrder: 2 }),
      makeTask('candidate', { parentId: 'root', sortOrder: 1 }),
      makeTask('existing', { parentId: 'root', sortOrder: 0 }),
    ];

    const candidates = getDependencyCandidates({
      sourceTaskId: 'selected',
      direction: 'incoming',
      tasks,
      edges: [makeEdge('edge-1', 'existing', 'selected')],
    });

    expect(candidates.map((candidate) => candidate.taskId)).toEqual(['candidate']);
  });
});
