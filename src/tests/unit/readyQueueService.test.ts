import { describe, it, expect } from 'vitest';
import {
  computeAllDerivedStates,
  buildChildMap,
  getDescendants,
  getAncestors,
} from '../../domain/services/taskTreeService';
import type { Task } from '../../domain/models/task';
import type { DependencyEdge } from '../../domain/models/dependency';

function makeTask(
  id: string,
  overrides: Partial<Task> = {}
): Task {
  return {
    id,
    projectId: 'proj1',
    parentId: null,
    title: `Task ${id}`,
    manualStatus: 'todo',
    priority: 'medium',
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('computeAllDerivedStates', () => {
  it('marks leaf tasks correctly', () => {
    const tasks = [
      makeTask('a'),
      makeTask('b', { parentId: 'a' }),
      makeTask('c', { parentId: 'a' }),
    ];
    const edges: DependencyEdge[] = [];
    const states = computeAllDerivedStates(tasks, edges);

    expect(states.get('a')?.isLeaf).toBe(false);
    expect(states.get('b')?.isLeaf).toBe(true);
    expect(states.get('c')?.isLeaf).toBe(true);
  });

  it('computes correct depth', () => {
    const tasks = [
      makeTask('a'),
      makeTask('b', { parentId: 'a' }),
      makeTask('c', { parentId: 'b' }),
    ];
    const edges: DependencyEdge[] = [];
    const states = computeAllDerivedStates(tasks, edges);

    expect(states.get('a')?.depth).toBe(0);
    expect(states.get('b')?.depth).toBe(1);
    expect(states.get('c')?.depth).toBe(2);
  });

  it('computes path for nested tasks', () => {
    const tasks = [
      makeTask('a'),
      makeTask('b', { parentId: 'a' }),
      makeTask('c', { parentId: 'b' }),
    ];
    const edges: DependencyEdge[] = [];
    const states = computeAllDerivedStates(tasks, edges);

    expect(states.get('c')?.path).toEqual(['a', 'b']);
  });

  it('computes parent rollup status', () => {
    const tasks = [
      makeTask('a'),
      makeTask('b', { parentId: 'a', manualStatus: 'done' }),
      makeTask('c', { parentId: 'a', manualStatus: 'done' }),
    ];
    const edges: DependencyEdge[] = [];
    const states = computeAllDerivedStates(tasks, edges);

    expect(states.get('a')?.rollupStatus).toBe('done');
  });

  it('computes parent rollup as in_progress when a child is active', () => {
    const tasks = [
      makeTask('a'),
      makeTask('b', { parentId: 'a', manualStatus: 'in_progress' }),
      makeTask('c', { parentId: 'a', manualStatus: 'todo' }),
    ];
    const edges: DependencyEdge[] = [];
    const states = computeAllDerivedStates(tasks, edges);

    expect(states.get('a')?.rollupStatus).toBe('in_progress');
  });

  it('computes unmet dependencies', () => {
    const tasks = [
      makeTask('a', { manualStatus: 'todo', title: 'Pre' }),
      makeTask('b', { manualStatus: 'todo', title: 'Dep' }),
    ];
    const edges = [
      {
        id: 'e1',
        projectId: 'proj1',
        fromTaskId: 'a',
        toTaskId: 'b',
        type: 'finish_to_start' as const,
        createdAt: new Date().toISOString(),
      },
    ];
    const states = computeAllDerivedStates(tasks, edges);

    expect(states.get('b')?.unmetDependencyIds).toContain('a');
  });
});

describe('getDescendants', () => {
  it('returns all descendants', () => {
    const tasks = [
      makeTask('a'),
      makeTask('b', { parentId: 'a' }),
      makeTask('c', { parentId: 'a' }),
      makeTask('d', { parentId: 'b' }),
    ];
    const childMap = buildChildMap(tasks);
    const desc = getDescendants('a', childMap);
    expect(desc).toHaveLength(3);
  });
});

describe('getAncestors', () => {
  it('returns all ancestors', () => {
    const tasks = [
      makeTask('a'),
      makeTask('b', { parentId: 'a' }),
      makeTask('c', { parentId: 'b' }),
    ];
    const parentMap = new Map(
      tasks.map((t) => [
        t.id,
        tasks.find((p) => p.id === t.parentId) ?? null,
      ])
    );
    const ancestors = getAncestors('c', parentMap as Map<string, Task | null>);
    expect(ancestors).toHaveLength(2);
    expect(ancestors[0].id).toBe('b');
    expect(ancestors[1].id).toBe('a');
  });
});
