import type { Task } from '../models/task';
import type { DependencyEdge } from '../models/dependency';
import type { Project } from '../models/project';

export interface QuestackExport {
  schemaVersion: number;
  exportedAt: string;
  projects: Project[];
  tasks: Task[];
  dependencyEdges: DependencyEdge[];
}

export interface ExportValidationError {
  field: string;
  message: string;
}

export function validateExport(data: unknown): ExportValidationError[] {
  const errors: ExportValidationError[] = [];

  if (!data || typeof data !== 'object') {
    errors.push({ field: 'root', message: 'Export data must be an object' });
    return errors;
  }

  const obj = data as Record<string, unknown>;

  if (obj.schemaVersion !== 1) {
    errors.push({ field: 'schemaVersion', message: 'Unsupported schema version' });
  }

  if (!Array.isArray(obj.projects)) {
    errors.push({ field: 'projects', message: 'projects must be an array' });
    return errors;
  }

  if (!Array.isArray(obj.tasks)) {
    errors.push({ field: 'tasks', message: 'tasks must be an array' });
    return errors;
  }

  if (!Array.isArray(obj.dependencyEdges)) {
    errors.push({ field: 'dependencyEdges', message: 'dependencyEdges must be an array' });
    return errors;
  }

  const projects = obj.projects as Project[];
  const tasks = obj.tasks as Task[];
  const edges = obj.dependencyEdges as DependencyEdge[];

  const projectIds = new Set(projects.map((p) => p.id));
  const taskIds = new Set(tasks.map((t) => t.id));
  const edgeIds = new Set<string>();

  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    if (!p.id) errors.push({ field: `projects[${i}].id`, message: 'Missing id' });
    if (!p.name) errors.push({ field: `projects[${i}].name`, message: 'Missing name' });
  }

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (!t.id) {
      errors.push({ field: `tasks[${i}].id`, message: 'Missing id' });
      continue;
    }
    if (!t.projectId) errors.push({ field: `tasks[${i}].projectId`, message: 'Missing projectId' });
    else if (!projectIds.has(t.projectId))
      errors.push({ field: `tasks[${i}].projectId`, message: `Project ${t.projectId} not found` });

    if (t.parentId && !taskIds.has(t.parentId))
      errors.push({ field: `tasks[${i}].parentId`, message: `Parent task ${t.parentId} not found` });

    if (!['todo', 'in_progress', 'done', 'canceled'].includes(t.manualStatus))
      errors.push({ field: `tasks[${i}].manualStatus`, message: `Invalid status: ${t.manualStatus}` });
  }

  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    if (e.id) {
      if (edgeIds.has(e.id)) errors.push({ field: `dependencyEdges[${i}].id`, message: 'Duplicate edge id' });
      edgeIds.add(e.id);
    }

    if (!e.fromTaskId) errors.push({ field: `dependencyEdges[${i}].fromTaskId`, message: 'Missing' });
    else if (!taskIds.has(e.fromTaskId))
      errors.push({ field: `dependencyEdges[${i}].fromTaskId`, message: `Task ${e.fromTaskId} not found` });

    if (!e.toTaskId) errors.push({ field: `dependencyEdges[${i}].toTaskId`, message: 'Missing' });
    else if (!taskIds.has(e.toTaskId))
      errors.push({ field: `dependencyEdges[${i}].toTaskId`, message: `Task ${e.toTaskId} not found` });

    if (e.fromTaskId && e.toTaskId) {
      const fromTask = tasks.find((t) => t.id === e.fromTaskId);
      const toTask = tasks.find((t) => t.id === e.toTaskId);
      if (fromTask && toTask && fromTask.projectId !== toTask.projectId) {
        errors.push({
          field: `dependencyEdges[${i}]`,
          message: `Cross-project dependency: ${e.fromTaskId} (${fromTask.projectId}) -> ${e.toTaskId} (${toTask.projectId})`,
        });
      }
    }
  }

  return errors;
}

export function detectParentChildCycles(tasks: Task[]): string[] {
  const parentMap = new Map(tasks.map((t) => [t.id, t.parentId]));
  const cycleTaskIds: string[] = [];

  for (const task of tasks) {
    let current: string | null | undefined = task.parentId;
    while (current) {
      if (current === task.id) {
        cycleTaskIds.push(task.id);
        break;
      }
      current = parentMap.get(current);
    }
  }

  return cycleTaskIds;
}

export function exportToJson(
  projects: Project[],
  tasks: Task[],
  dependencyEdges: DependencyEdge[]
): string {
  const data: QuestackExport = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    projects,
    tasks,
    dependencyEdges,
  };
  return JSON.stringify(data, null, 2);
}

export function importFromJson(
  json: string
): { success: true; data: QuestackExport } | { success: false; errors: ExportValidationError[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { success: false, errors: [{ field: 'root', message: 'Invalid JSON' }] };
  }

  const errors = validateExport(parsed);
  if (errors.length > 0) return { success: false, errors };

  const parentCycleIds = detectParentChildCycles((parsed as QuestackExport).tasks);
  if (parentCycleIds.length > 0) {
    return {
      success: false,
      errors: [
        {
          field: 'tasks',
          message: `Parent-child cycle detected for tasks: ${parentCycleIds.join(', ')}`,
        },
      ],
    };
  }

  return { success: true, data: parsed as QuestackExport };
}
