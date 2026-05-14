import { describe, expect, it } from 'vitest';
import type { Task } from '../../domain/models/task';
import { buildTaskMapRegions } from '../../domain/services/taskMapService';

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

describe('buildTaskMapRegions', () => {
  it('creates one containment region for each container task', () => {
    const tasks = [
      makeTask('root'),
      makeTask('child-a', { parentId: 'root', sortOrder: 0 }),
      makeTask('child-b', { parentId: 'root', sortOrder: 1 }),
      makeTask('grandchild', { parentId: 'child-b', sortOrder: 0 }),
    ];

    const regions = buildTaskMapRegions(tasks);

    expect(regions.map((region) => region.taskId)).toEqual(['root', 'child-b']);
    expect(regions[0]).toMatchObject({
      taskId: 'root',
      depth: 0,
      childTaskIds: ['child-a', 'child-b'],
      descendantTaskIds: ['child-a', 'child-b', 'grandchild'],
    });
    expect(regions[1]).toMatchObject({
      taskId: 'child-b',
      depth: 1,
      childTaskIds: ['grandchild'],
      descendantTaskIds: ['grandchild'],
    });
  });

  it('ignores archived tasks when building map regions', () => {
    const tasks = [
      makeTask('root'),
      makeTask('active-child', { parentId: 'root', sortOrder: 0 }),
      makeTask('archived-child', {
        parentId: 'root',
        sortOrder: 1,
        archivedAt: '2026-05-15T01:00:00.000Z',
      }),
    ];

    expect(buildTaskMapRegions(tasks)).toEqual([
      {
        taskId: 'root',
        depth: 0,
        childTaskIds: ['active-child'],
        descendantTaskIds: ['active-child'],
      },
    ]);
  });
});
