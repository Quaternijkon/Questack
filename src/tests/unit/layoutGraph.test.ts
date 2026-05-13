import { describe, expect, it } from 'vitest';
import { layoutTaskGraph } from '../../components/graph/layoutGraph';
import type { DependencyEdge } from '../../domain/models/dependency';
import type { Task } from '../../domain/models/task';

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    projectId: 'proj1',
    parentId: null,
    title: `Task ${id}`,
    manualStatus: 'todo',
    priority: 'medium',
    sortOrder: 0,
    createdAt: '2026-05-14T00:00:00.000Z',
    updatedAt: '2026-05-14T00:00:00.000Z',
    ...overrides,
  };
}

function makeEdge(id: string, fromTaskId: string, toTaskId: string): DependencyEdge {
  return {
    id,
    projectId: 'proj1',
    fromTaskId,
    toTaskId,
    type: 'finish_to_start',
    createdAt: '2026-05-14T00:00:00.000Z',
  };
}

describe('layoutTaskGraph', () => {
  it('puts independent root task groups into separate layer bands', () => {
    const tasks = [
      makeTask('root-a', { title: 'Root A', sortOrder: 0 }),
      makeTask('a-child', { parentId: 'root-a', sortOrder: 0 }),
      makeTask('root-b', { title: 'Root B', sortOrder: 1 }),
      makeTask('b-child', { parentId: 'root-b', sortOrder: 0 }),
    ];

    const layout = layoutTaskGraph(tasks, []);

    expect(layout.layerBands.map((band) => band.rootTaskId)).toEqual(['root-a', 'root-b']);
    expect(layout.layerBands[0].taskIds).toEqual(expect.arrayContaining(['root-a', 'a-child']));
    expect(layout.layerBands[1].taskIds).toEqual(expect.arrayContaining(['root-b', 'b-child']));
    expect(layout.layerBands[1].y).toBeGreaterThan(layout.layerBands[0].y);
  });

  it('uses vertical position for task decomposition and horizontal position for dependency order', () => {
    const tasks = [
      makeTask('root'),
      makeTask('first-child', { parentId: 'root', sortOrder: 0 }),
      makeTask('second-child', { parentId: 'root', sortOrder: 1 }),
    ];
    const edges = [makeEdge('e1', 'first-child', 'second-child')];

    const layout = layoutTaskGraph(tasks, edges);
    const root = layout.positions.get('root')!;
    const firstChild = layout.positions.get('first-child')!;
    const secondChild = layout.positions.get('second-child')!;

    expect(firstChild.y).toBeGreaterThan(root.y);
    expect(secondChild.y).toBeGreaterThan(root.y);
    expect(secondChild.x).toBeGreaterThan(firstChild.x);
  });

  it('keeps manual positions in edit mode while still creating layer bands', () => {
    const tasks = [makeTask('root'), makeTask('child', { parentId: 'root' })];

    const layout = layoutTaskGraph(tasks, [], {
      manualPositions: {
        child: { x: 640, y: 320 },
      },
    });

    expect(layout.positions.get('child')).toMatchObject({
      x: 640,
      y: 320,
      source: 'manual',
    });
    expect(layout.positions.get('root')?.source).toBe('auto');
    expect(layout.layerBands).toHaveLength(1);
  });
});
