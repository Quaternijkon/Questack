import { describe, it, expect } from 'vitest';
import {
  validateExport,
  importFromJson,
  exportToJson,
  detectParentChildCycles,
} from '../../domain/services/importExportService';
import type { Task } from '../../domain/models/task';
import type { Project } from '../../domain/models/project';
import { createDefaultProjectSettings } from '../../domain/models/project';

function makeProject(id: string, name: string): Project {
  return {
    id,
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: createDefaultProjectSettings(),
  };
}

function makeTask(id: string, projectId: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    projectId,
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

describe('validateExport', () => {
  it('rejects non-object data', () => {
    const errors = validateExport(null);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects missing projects array', () => {
    const errors = validateExport({ schemaVersion: 1 });
    expect(errors.some((e) => e.field === 'projects')).toBe(true);
  });

  it('validates correct data without errors', () => {
    const project = makeProject('p1', 'Test');
    const task = makeTask('t1', 'p1');
    const errors = validateExport({
      schemaVersion: 1,
      projects: [project],
      tasks: [task],
      dependencyEdges: [],
    });
    expect(errors).toEqual([]);
  });

  it('rejects tasks with invalid projectId', () => {
    const task = makeTask('t1', 'nonexistent');
    const errors = validateExport({
      schemaVersion: 1,
      projects: [],
      tasks: [task],
      dependencyEdges: [],
    });
    expect(errors.some((e) => e.field.startsWith('tasks'))).toBe(true);
  });

  it('rejects edges with missing task references', () => {
    const project = makeProject('p1', 'Test');
    const errors = validateExport({
      schemaVersion: 1,
      projects: [project],
      tasks: [],
      dependencyEdges: [
        {
          id: 'e1',
          projectId: 'p1',
          fromTaskId: 'nonexistent',
          toTaskId: 'also-non',
          type: 'finish_to_start',
          createdAt: new Date().toISOString(),
        },
      ],
    });
    expect(errors.some((e) => e.field.startsWith('dependencyEdges'))).toBe(true);
  });
});

describe('detectParentChildCycles', () => {
  it('detects simple parent-child cycle', () => {
    const tasks = [
      makeTask('a', 'p1', { parentId: 'b' }),
      makeTask('b', 'p1', { parentId: 'a' }),
    ];
    const cycles = detectParentChildCycles(tasks);
    expect(cycles.length).toBe(2);
  });

  it('returns empty for valid tree', () => {
    const tasks = [
      makeTask('a', 'p1'),
      makeTask('b', 'p1', { parentId: 'a' }),
    ];
    const cycles = detectParentChildCycles(tasks);
    expect(cycles).toEqual([]);
  });
});

describe('importFromJson', () => {
  it('rejects invalid JSON string', () => {
    const result = importFromJson('not json');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('imports valid data successfully', () => {
    const project = makeProject('p1', 'Test Project');
    const task = makeTask('t1', 'p1');
    const json = exportToJson([project], [task], []);
    const result = importFromJson(json);
    expect(result.success).toBe(true);
  });

  it('fails on cross-project dependency', () => {
    const projects = [makeProject('p1', 'Proj1'), makeProject('p2', 'Proj2')];
    const tasks = [makeTask('t1', 'p1'), makeTask('t2', 'p2')];
    const json = exportToJson(projects, tasks, [
      {
        id: 'e1',
        projectId: 'p1',
        fromTaskId: 't1',
        toTaskId: 't2',
        type: 'finish_to_start',
        createdAt: new Date().toISOString(),
      },
    ]);
    const result = importFromJson(json);
    expect(result.success).toBe(false);
  });
});

describe('exportToJson', () => {
  it('produces valid JSON string', () => {
    const project = makeProject('p1', 'Test');
    const task = makeTask('t1', 'p1');
    const json = exportToJson([project], [task], []);
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.projects).toHaveLength(1);
    expect(parsed.tasks).toHaveLength(1);
  });
});
