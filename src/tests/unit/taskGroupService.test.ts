import { describe, expect, it } from 'vitest';
import { buildTaskGroups } from '../../domain/services/taskGroupService';
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

describe('buildTaskGroups', () => {
  it('groups tasks connected by dependency or decomposition links into one task group', () => {
    const tasks = [
      makeTask('design-root', { title: 'Design', sortOrder: 0 }),
      makeTask('design-leaf', { parentId: 'design-root', sortOrder: 0 }),
      makeTask('build-root', { title: 'Build', sortOrder: 1 }),
      makeTask('build-leaf', { parentId: 'build-root', sortOrder: 0 }),
      makeTask('growth-root', { title: 'Growth', sortOrder: 2 }),
    ];
    const edges = [makeEdge('edge-1', 'design-leaf', 'build-leaf')];

    const groups = buildTaskGroups(tasks, edges);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      kind: 'interdependent',
      rootTaskIds: ['design-root', 'build-root'],
      dependencyEdgeIds: ['edge-1'],
    });
    expect(groups[0].taskIds).toEqual(
      expect.arrayContaining(['design-root', 'design-leaf', 'build-root', 'build-leaf'])
    );
    expect(groups[1]).toMatchObject({
      kind: 'independent',
      rootTaskIds: ['growth-root'],
      taskIds: ['growth-root'],
    });
  });

  it('ignores archived tasks and invalid dependency edges', () => {
    const tasks = [
      makeTask('active-root'),
      makeTask('archived-root', { archivedAt: '2026-05-14T01:00:00.000Z' }),
    ];
    const edges = [makeEdge('invalid-edge', 'active-root', 'archived-root')];

    const groups = buildTaskGroups(tasks, edges);

    expect(groups).toHaveLength(1);
    expect(groups[0].taskIds).toEqual(['active-root']);
    expect(groups[0].dependencyEdgeIds).toEqual([]);
  });
});
