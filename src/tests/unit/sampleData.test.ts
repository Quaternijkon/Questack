import { describe, expect, it } from 'vitest';
import { generateSampleData } from '../../domain/services/sampleData';
import { validateExport } from '../../domain/services/importExportService';
import { computeReadyTasks, computeBlockedReasons, topologicalSort } from '../../domain/services/graphService';
import { buildChildMap, computeAllDerivedStates } from '../../domain/services/taskTreeService';
import { buildTaskGroups } from '../../domain/services/taskGroupService';
import type { Task } from '../../domain/models/task';
import type { DependencyEdge } from '../../domain/models/dependency';

describe('generateSampleData', () => {
  it('creates a valid feature tour project for onboarding and QA', () => {
    const { project, tasks, edges } = generateSampleData();
    const fullTasks = tasks as Task[];
    const fullEdges = edges as DependencyEdge[];

    expect(project.name).toContain('Questack');
    expect(fullTasks.length).toBeGreaterThanOrEqual(40);
    expect(fullEdges.length).toBeGreaterThanOrEqual(30);
    expect(validateExport({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      projects: [project],
      tasks: fullTasks,
      dependencyEdges: fullEdges,
    })).toEqual([]);
    expect(() => topologicalSort(fullTasks, fullEdges)).not.toThrow();
  });

  it('covers statuses, priorities, estimates, deep decomposition, ready queue, and blocked reasons', () => {
    const { tasks, edges } = generateSampleData();
    const fullTasks = tasks as Task[];
    const fullEdges = edges as DependencyEdge[];

    expect(new Set(fullTasks.map((task) => task.manualStatus))).toEqual(
      new Set(['todo', 'in_progress', 'done', 'canceled'])
    );
    expect(new Set(fullTasks.map((task) => task.priority))).toEqual(
      new Set(['low', 'medium', 'high', 'critical'])
    );
    expect(fullTasks.some((task) => task.estimateMinutes != null)).toBe(true);

    const derivedStates = computeAllDerivedStates(fullTasks, fullEdges);
    const maxDepth = Math.max(...[...derivedStates.values()].map((state) => state.depth));
    expect(maxDepth).toBeGreaterThanOrEqual(3);

    const readyTasks = computeReadyTasks(fullTasks, fullEdges, buildChildMap(fullTasks));
    const blockedReasons = computeBlockedReasons(fullTasks, fullEdges);

    expect(readyTasks.length).toBeGreaterThanOrEqual(4);
    expect(blockedReasons.length).toBeGreaterThanOrEqual(4);
    expect([...derivedStates.values()].some((state) => state.rollupStatus === 'blocked')).toBe(true);
  });

  it('includes multiple task groups that can exercise graph group switching', () => {
    const { tasks, edges } = generateSampleData();
    const fullTasks = tasks as Task[];
    const fullEdges = edges as DependencyEdge[];

    const groups = buildTaskGroups(fullTasks, fullEdges);
    const independentGroupCount = groups.filter((group) => group.kind === 'independent').length;
    const interdependentGroupCount = groups.filter((group) => group.kind === 'interdependent').length;

    expect(groups.length).toBeGreaterThanOrEqual(2);
    expect(independentGroupCount).toBeGreaterThanOrEqual(1);
    expect(interdependentGroupCount).toBeGreaterThanOrEqual(1);
  });
});
