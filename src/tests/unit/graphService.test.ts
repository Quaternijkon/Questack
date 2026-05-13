import { describe, it, expect } from 'vitest';
import {
  wouldCreateCycle,
  topologicalSort,
  findCycles,
  buildGraph,
  isRedundantEdge,
  computeReadyTasks,
  computeBlockedReasons,
} from '../../domain/services/graphService';
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

function makeEdge(
  id: string,
  fromTaskId: string,
  toTaskId: string
): DependencyEdge {
  return {
    id,
    projectId: 'proj1',
    fromTaskId,
    toTaskId,
    type: 'finish_to_start',
    createdAt: new Date().toISOString(),
  };
}

describe('wouldCreateCycle', () => {
  it('returns true when from and to are the same', () => {
    const adj = new Map([['a', []]]);
    expect(wouldCreateCycle('a', 'a', adj)).toBe(true);
  });

  it('returns true when adding edge would create a cycle', () => {
    const adj = new Map([
      ['a', ['b']],
      ['b', ['c']],
      ['c', []],
    ]);
    expect(wouldCreateCycle('c', 'a', adj)).toBe(true);
  });

  it('returns false when adding edge is safe', () => {
    const adj = new Map([
      ['a', []],
      ['b', []],
      ['c', []],
    ]);
    expect(wouldCreateCycle('a', 'b', adj)).toBe(false);
  });

  it('handles indirect path', () => {
    const adj = new Map([
      ['a', ['b']],
      ['b', ['c']],
      ['c', ['d']],
      ['d', []],
    ]);
    expect(wouldCreateCycle('d', 'a', adj)).toBe(true);
    expect(wouldCreateCycle('a', 'd', adj)).toBe(false);
  });
});

describe('topologicalSort', () => {
  it('returns linear order for chain', () => {
    const tasks = [makeTask('a'), makeTask('b'), makeTask('c')];
    const edges = [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'c')];
    const result = topologicalSort(tasks, edges);
    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('returns parallel tasks in some order', () => {
    const tasks = [makeTask('a'), makeTask('b'), makeTask('c')];
    const edges = [makeEdge('e1', 'a', 'c'), makeEdge('e2', 'b', 'c')];
    const result = topologicalSort(tasks, edges);
    expect(result[0]).toBeOneOf(['a', 'b']);
    expect(result[1]).toBeOneOf(['a', 'b']);
    expect(result[2]).toBe('c');
  });

  it('throws on cycle', () => {
    const tasks = [makeTask('a'), makeTask('b')];
    const edges = [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'a')];
    expect(() => topologicalSort(tasks, edges)).toThrow('cycle');
  });

  it('returns empty array for no tasks', () => {
    expect(topologicalSort([], [])).toEqual([]);
  });

  it('handles disconnected components', () => {
    const tasks = [makeTask('a'), makeTask('b'), makeTask('c')];
    const edges: DependencyEdge[] = [];
    const result = topologicalSort(tasks, edges);
    expect(result).toHaveLength(3);
    expect(result.sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('findCycles', () => {
  it('returns empty array for DAG', () => {
    const adj = new Map([
      ['a', ['b']],
      ['b', ['c']],
      ['c', []],
    ]);
    const cycles = findCycles(adj);
    expect(cycles).toEqual([]);
  });

  it('finds simple cycle', () => {
    const adj = new Map([
      ['a', ['b']],
      ['b', ['a']],
    ]);
    const cycles = findCycles(adj);
    expect(cycles.length).toBeGreaterThan(0);
  });
});

describe('buildGraph', () => {
  it('filters archived tasks and orphan edges', () => {
    const tasks = [
      makeTask('a'),
      makeTask('b', { archivedAt: '2025-01-01' }),
    ];
    const edges = [
      makeEdge('e1', 'a', 'b'),
      makeEdge('e2', 'b', 'c'),
    ];
    const graph = buildGraph(tasks, edges);
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].id).toBe('a');
    expect(graph.edges).toHaveLength(0);
  });
});

describe('isRedundantEdge', () => {
  it('returns true when direct edge already exists', () => {
    const adj = new Map([
      ['a', ['b']],
      ['b', []],
    ]);
    expect(isRedundantEdge('a', 'b', adj)).toBe(true);
  });

  it('returns true when indirect path exists', () => {
    const adj = new Map([
      ['a', ['b']],
      ['b', ['c']],
      ['c', []],
    ]);
    expect(isRedundantEdge('a', 'c', adj)).toBe(true);
  });
});

describe('computeReadyTasks', () => {
  it('returns leaf tasks with no unmet dependencies', () => {
    const tasks = [
      makeTask('a'),
      makeTask('b'),
      makeTask('p', { manualStatus: 'todo' }),
    ];
    const childMap = new Map([['p', [makeTask('c', { parentId: 'p' })]]]);
    const edges: DependencyEdge[] = [];
    const ready = computeReadyTasks(tasks, edges, childMap);
    expect(ready.map((t) => t.id)).toContain('a');
    expect(ready.map((t) => t.id)).toContain('b');
    expect(ready.map((t) => t.id)).not.toContain('p');
  });

  it('excludes completed and canceled tasks', () => {
    const tasks = [
      makeTask('a', { manualStatus: 'done' }),
      makeTask('b', { manualStatus: 'canceled' }),
      makeTask('c'),
    ];
    const childMap = new Map();
    const edges: DependencyEdge[] = [];
    const ready = computeReadyTasks(tasks, edges, childMap);
    expect(ready.map((t) => t.id)).toEqual(['c']);
  });

  it('blocks task with unmet prerequisite', () => {
    const tasks = [makeTask('a'), makeTask('b')];
    const childMap = new Map();
    const edges = [makeEdge('e1', 'a', 'b')];
    const ready = computeReadyTasks(tasks, edges, childMap);
    expect(ready.map((t) => t.id)).toContain('a');
    expect(ready.map((t) => t.id)).not.toContain('b');
  });

  it('unblocks task when prerequisite is done', () => {
    const tasks = [
      makeTask('a', { manualStatus: 'done' }),
      makeTask('b'),
    ];
    const childMap = new Map();
    const edges = [makeEdge('e1', 'a', 'b')];
    const ready = computeReadyTasks(tasks, edges, childMap);
    expect(ready.map((t) => t.id)).toContain('b');
  });
});

describe('computeBlockedReasons', () => {
  it('returns unmet prerequisites for blocked tasks', () => {
    const tasks = [makeTask('a', { title: 'Task A' }), makeTask('b', { title: 'Task B' })];
    const edges = [makeEdge('e1', 'a', 'b')];
    const reasons = computeBlockedReasons(tasks, edges);
    const bReason = reasons.find((r) => r.taskId === 'b');
    expect(bReason).toBeDefined();
    expect(bReason!.unmetPrerequisites[0].id).toBe('a');
  });
});
