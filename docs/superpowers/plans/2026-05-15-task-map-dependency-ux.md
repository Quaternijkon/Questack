# Task Map And Dependency Editing UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Questack v0.5.0 as a smoother task-map workspace: use map/set-style visuals to express decomposition more clearly, fix unreliable task-tree expand controls, and make dependency creation/editing require fewer, more intuitive actions.

**Architecture:** Keep the existing local-first React + TypeScript + Vite architecture. Add focused domain helpers for task-map presentation and dependency editing suggestions, then wire them into `TaskTreeItem`, `GraphView`, `GraphNode`, and `DependencyEditor` without replacing the existing stores or IndexedDB schema.

**Tech Stack:** React 19, TypeScript, Vite, Zustand, React Flow `@xyflow/react`, Dexie, Vitest, React Testing Library, lucide-react.

---

## Product Direction

### Map Sets vs Pure Hierarchy

Use “task maps” as the primary expression of decomposition, while keeping the tree as the fast text scanner.

The current tree hierarchy is good for dense reading and keyboard-style editing, but it makes decomposition feel like a file explorer. A task map can better show that a parent task is a bounded problem space containing subproblems, not merely an indented row. The target model is:

- The **task tree** remains the compact outline view.
- The **graph view** becomes a **task map workspace**: each task group is a separate map; container tasks render as visible grouping regions; leaf tasks render as executable cards.
- Parent-child decomposition is drawn as containment/grouping first, with light guide lines only when useful.
- Explicit dependency remains directional left-to-right and visually distinct from containment.

Do not remove the current tree view. Fix its expand control and keep it as the fastest way to inspect and edit a large hierarchy.

### Next Version Target

Implement the work below as `v0.5.0`. After implementation:

- Update `package.json` and `package-lock.json` from `0.4.0` to `0.5.0`.
- Update `README.md` Version History with a `0.5.0` entry.
- Keep `README.md` as the durable release log for all future versions.

---

## File Structure

### Existing Files To Modify

- `src/components/task-tree/TaskTreeItem.tsx`
  - Make the expand/collapse target larger, keyboard accessible, and independent from row selection.
  - Replace text glyphs `>` and `v` with lucide chevrons.

- `src/components/task-tree/TaskTreeView.tsx`
  - Add regression coverage hooks through accessible labels. Do not add visible instructional text.

- `src/components/graph/GraphView.tsx`
  - Add task-map rendering mode inside the existing graph view.
  - Keep one task group per view.
  - Add dependency editing mode with source/target selection, preview, and fewer required inspector hops.

- `src/components/graph/GraphNode.tsx`
  - Add explicit source/target dependency action buttons.
  - Make node controls stop propagation reliably.
  - Surface status and blocker information without requiring inspector opening.

- `src/components/inspector/DependencyEditor.tsx`
  - Replace the shared single select with separate incoming/outgoing controls and quick actions.
  - Add recent/candidate lists sorted by graph relevance.

- `src/state/uiStore.ts`
  - Add state for dependency editing mode: selected dependency source, hover/preview target, and map display mode.

- `src/index.css`
  - Add task-map set styles, larger tree-toggle hit target, dependency editing preview styles, and accessible focus states.

- `README.md`
  - Update current version and Version History after implementation.

- `package.json`
  - Bump version to `0.5.0` after implementation.

- `package-lock.json`
  - Keep lockfile version fields in sync with `package.json`.

### New Files To Create

- `src/domain/services/taskMapService.ts`
  - Pure helpers for task-map grouping regions, containment bounds, and display metadata.

- `src/domain/services/dependencySuggestionService.ts`
  - Pure helpers for ranking dependency candidates and generating validation preview text.

- `src/tests/unit/taskMapService.test.ts`
  - Unit tests for map grouping bounds and containment semantics.

- `src/tests/unit/dependencySuggestionService.test.ts`
  - Unit tests for dependency candidate ranking, duplicate exclusion, self exclusion, and cycle-risk exclusion.

- `src/tests/unit/taskTreeItem.test.tsx`
  - Component tests proving the expand button has a reliable hit area and does not accidentally open the inspector.

- `src/tests/unit/dependencyEditor.test.tsx`
  - Component tests for adding incoming/outgoing dependencies with independent selectors.

---

## Task 1: Fix Task Tree Expand Control Reliability

**Files:**
- Modify: `src/components/task-tree/TaskTreeItem.tsx`
- Modify: `src/index.css`
- Create: `src/tests/unit/taskTreeItem.test.tsx`

- [ ] **Step 1: Write the failing expand-control test**

Create `src/tests/unit/taskTreeItem.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TaskTreeItem from '../../components/task-tree/TaskTreeItem';
import type { Task } from '../../domain/models/task';
import { computeAllDerivedStates } from '../../domain/services/taskTreeService';
import { useTaskStore } from '../../state/taskStore';
import { useUIStore } from '../../state/uiStore';

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    projectId: 'project-1',
    parentId: null,
    title: `Task ${id}`,
    manualStatus: 'todo',
    priority: 'medium',
    sortOrder: 0,
    createdAt: '2026-05-15T00:00:00.000Z',
    updatedAt: '2026-05-15T00:00:00.000Z',
    ...overrides,
  };
}

describe('TaskTreeItem expand control', () => {
  beforeEach(() => {
    const tasks = [
      makeTask('parent'),
      makeTask('child', { parentId: 'parent' }),
    ];
    useTaskStore.setState({
      tasks,
      derivedStates: computeAllDerivedStates(tasks, []),
      selectedTaskId: null,
      loading: false,
    });
    useUIStore.setState({ expandedTaskIds: new Set<string>() });
  });

  it('toggles children from a dedicated button without selecting the row', () => {
    const onSelect = vi.fn();

    render(
      <TaskTreeItem
        task={useTaskStore.getState().tasks[0]}
        depth={0}
        onSelect={onSelect}
        onContextMenu={vi.fn()}
        selectedTaskId={null}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '展开子任务' }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText('Task child')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '收起子任务' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- src/tests/unit/taskTreeItem.test.tsx
```

Expected: FAIL because the current toggle button has no accessible name and still uses the tiny text glyph target.

- [ ] **Step 3: Implement the accessible tree toggle**

Modify `src/components/task-tree/TaskTreeItem.tsx`:

```tsx
import { ChevronDown, ChevronRight } from 'lucide-react';
```

Replace the toggle button block with:

```tsx
<button
  className={`tree-toggle ${expanded ? 'expanded' : ''}`}
  type="button"
  aria-label={expanded ? '收起子任务' : '展开子任务'}
  aria-expanded={hasChildren ? expanded : undefined}
  disabled={!hasChildren}
  onPointerDown={(event) => event.stopPropagation()}
  onClick={(event) => {
    event.preventDefault();
    event.stopPropagation();
    if (hasChildren) toggleTaskExpanded(task.id);
  }}
>
  {hasChildren ? (
    expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
  ) : (
    <span className="tree-toggle-placeholder" />
  )}
</button>
```

Remove `style={{ visibility: hasChildren ? 'visible' : 'hidden' }}` so the layout stays stable.

- [ ] **Step 4: Add hit-area and focus styles**

Append to `src/index.css`:

```css
.tree-toggle {
  width: 32px;
  height: 32px;
  min-width: 32px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.tree-toggle:disabled {
  pointer-events: none;
  opacity: 0;
}

.tree-toggle:focus-visible {
  outline: 2px solid var(--md-primary);
  outline-offset: 2px;
}

.tree-toggle-placeholder {
  width: 16px;
  height: 16px;
}
```

- [ ] **Step 5: Verify the tree test passes**

Run:

```bash
npm test -- src/tests/unit/taskTreeItem.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/task-tree/TaskTreeItem.tsx src/index.css src/tests/unit/taskTreeItem.test.tsx
git commit -m "fix: improve task tree expand control"
```

---

## Task 2: Add Task Map Service For Set-Based Decomposition

**Files:**
- Create: `src/domain/services/taskMapService.ts`
- Create: `src/tests/unit/taskMapService.test.ts`

- [ ] **Step 1: Write failing service tests**

Create `src/tests/unit/taskMapService.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildTaskMapRegions } from '../../domain/services/taskMapService';
import type { Task } from '../../domain/models/task';

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
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- src/tests/unit/taskMapService.test.ts
```

Expected: FAIL because `taskMapService.ts` does not exist.

- [ ] **Step 3: Implement `taskMapService.ts`**

Create `src/domain/services/taskMapService.ts`:

```ts
import type { Task } from '../models/task';
import { buildChildMap, getDescendants } from './taskTreeService';

export interface TaskMapRegion {
  taskId: string;
  depth: number;
  childTaskIds: string[];
  descendantTaskIds: string[];
}

export function buildTaskMapRegions(tasks: Task[]): TaskMapRegion[] {
  const activeTasks = tasks
    .filter((task) => task.archivedAt == null)
    .sort(compareTasks);
  const taskById = new Map(activeTasks.map((task) => [task.id, task]));
  const childMap = buildChildMap(activeTasks);

  return activeTasks
    .filter((task) => (childMap.get(task.id) ?? []).length > 0)
    .map((task) => ({
      taskId: task.id,
      depth: computeDepth(task, taskById),
      childTaskIds: (childMap.get(task.id) ?? []).sort(compareTasks).map((child) => child.id),
      descendantTaskIds: getDescendants(task.id, childMap).sort(compareTasks).map((child) => child.id),
    }))
    .sort((a, b) => a.depth - b.depth || compareTaskIds(a.taskId, b.taskId, taskById));
}

function computeDepth(task: Task, taskById: Map<string, Task>): number {
  let depth = 0;
  let current = task.parentId ? taskById.get(task.parentId) : undefined;
  while (current) {
    depth += 1;
    current = current.parentId ? taskById.get(current.parentId) : undefined;
  }
  return depth;
}

function compareTaskIds(a: string, b: string, taskById: Map<string, Task>) {
  return compareTasks(taskById.get(a), taskById.get(b));
}

function compareTasks(a: Task | undefined, b: Task | undefined) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const orderDelta = a.sortOrder - b.sortOrder;
  if (orderDelta !== 0) return orderDelta;
  return a.id.localeCompare(b.id);
}
```

- [ ] **Step 4: Verify service test passes**

Run:

```bash
npm test -- src/tests/unit/taskMapService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/services/taskMapService.ts src/tests/unit/taskMapService.test.ts
git commit -m "feat: add task map region service"
```

---

## Task 3: Render Decomposition As Task Map Sets

**Files:**
- Modify: `src/components/graph/GraphView.tsx`
- Modify: `src/components/graph/GraphNode.tsx`
- Modify: `src/index.css`
- Test: `src/tests/unit/taskMapService.test.ts`

- [ ] **Step 1: Add region metadata to graph rendering**

In `src/components/graph/GraphView.tsx`, import:

```ts
import { buildTaskMapRegions } from '../../domain/services/taskMapService';
```

Add a memo near `graphLayout`:

```ts
const taskMapRegions = useMemo(
  () => buildTaskMapRegions(visibleTasks),
  [visibleTasks]
);
```

- [ ] **Step 2: Render map regions in `ViewportPortal`**

Inside the existing `<ViewportPortal>`, render:

```tsx
<TaskMapRegions
  regions={taskMapRegions}
  positions={graphLayout.positions}
  tasks={visibleTasks}
/>
<TaskLayerBands bands={graphLayout.layerBands} />
```

Add this component in `GraphView.tsx`:

```tsx
function TaskMapRegions({
  regions,
  positions,
  tasks,
}: {
  regions: import('../../domain/services/taskMapService').TaskMapRegion[];
  positions: Map<string, { x: number; y: number }>;
  tasks: Task[];
}) {
  const taskById = new Map(tasks.map((task) => [task.id, task]));

  return (
    <div className="task-map-region-layer">
      {regions.map((region) => {
        const bounds = getRegionBounds(region.descendantTaskIds, positions);
        if (!bounds) return null;
        const task = taskById.get(region.taskId);
        return (
          <div
            key={region.taskId}
            className={`task-map-region depth-${Math.min(region.depth, 4)}`}
            style={{
              left: bounds.x - 28,
              top: bounds.y - 44,
              width: bounds.width + 56,
              height: bounds.height + 80,
            }}
          >
            <div className="task-map-region-title">{task?.title || 'Untitled group'}</div>
          </div>
        );
      })}
    </div>
  );
}

function getRegionBounds(
  taskIds: string[],
  positions: Map<string, { x: number; y: number }>
) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const taskId of taskIds) {
    const position = positions.get(taskId);
    if (!position) continue;
    minX = Math.min(minX, position.x);
    minY = Math.min(minY, position.y);
    maxX = Math.max(maxX, position.x + 220);
    maxY = Math.max(maxY, position.y + 112);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
```

- [ ] **Step 3: Reduce visual weight of decomposition edges**

Keep decomposition edges, but make them secondary. In `toDecompositionEdges`, keep `label: '拆解'` only when the graph is zoomed enough is not available from React Flow here, so remove labels for now:

```ts
label: undefined,
```

The map regions now carry the primary decomposition meaning.

- [ ] **Step 4: Add task-map region styles**

Append to `src/index.css`:

```css
.task-map-region-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: -1;
}

.task-map-region {
  position: absolute;
  border: 1px solid rgba(66,133,244,0.22);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(66,133,244,0.07), rgba(52,168,83,0.035));
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.05);
}

.task-map-region.depth-1 {
  border-color: rgba(52,168,83,0.22);
  background: linear-gradient(180deg, rgba(52,168,83,0.07), rgba(251,188,4,0.035));
}

.task-map-region.depth-2,
.task-map-region.depth-3,
.task-map-region.depth-4 {
  border-color: rgba(251,188,4,0.24);
  background: linear-gradient(180deg, rgba(251,188,4,0.07), rgba(66,133,244,0.03));
}

.task-map-region-title {
  position: absolute;
  top: 10px;
  left: 14px;
  max-width: calc(100% - 28px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font: 800 12px/16px var(--font-sans);
  color: var(--md-on-surface-variant);
  background: var(--md-surface-container);
  border: 1px solid var(--panel-border);
  border-radius: 999px;
  padding: 3px 9px;
}
```

- [ ] **Step 5: Verify graph code compiles**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/graph/GraphView.tsx src/components/graph/GraphNode.tsx src/index.css
git commit -m "feat: render task decomposition as map regions"
```

---

## Task 4: Add Dependency Candidate Ranking

**Files:**
- Create: `src/domain/services/dependencySuggestionService.ts`
- Create: `src/tests/unit/dependencySuggestionService.test.ts`

- [ ] **Step 1: Write failing candidate ranking tests**

Create `src/tests/unit/dependencySuggestionService.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getDependencyCandidates } from '../../domain/services/dependencySuggestionService';
import type { DependencyEdge } from '../../domain/models/dependency';
import type { Task } from '../../domain/models/task';

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
});
```

- [ ] **Step 2: Run and verify failure**

Run:

```bash
npm test -- src/tests/unit/dependencySuggestionService.test.ts
```

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement dependency suggestions**

Create `src/domain/services/dependencySuggestionService.ts`:

```ts
import type { DependencyEdge } from '../models/dependency';
import type { Task } from '../models/task';
import { buildGraph, wouldCreateCycle } from './graphService';

export type DependencyDirection = 'incoming' | 'outgoing';

export interface DependencyCandidate {
  taskId: string;
  score: number;
  reasons: string[];
}

export function getDependencyCandidates({
  sourceTaskId,
  direction,
  tasks,
  edges,
}: {
  sourceTaskId: string;
  direction: DependencyDirection;
  tasks: Task[];
  edges: DependencyEdge[];
}): DependencyCandidate[] {
  const activeTasks = tasks.filter((task) => task.archivedAt == null);
  const sourceTask = activeTasks.find((task) => task.id === sourceTaskId);
  if (!sourceTask) return [];

  const graph = buildGraph(activeTasks, edges);

  return activeTasks
    .filter((task) => task.id !== sourceTaskId)
    .filter((task) => !edgeExists(sourceTaskId, task.id, direction, edges))
    .filter((task) => {
      const fromTaskId = direction === 'outgoing' ? sourceTaskId : task.id;
      const toTaskId = direction === 'outgoing' ? task.id : sourceTaskId;
      return !wouldCreateCycle(fromTaskId, toTaskId, graph.adjacency);
    })
    .map((task) => scoreCandidate(sourceTask, task))
    .sort((a, b) => b.score - a.score || a.taskId.localeCompare(b.taskId));
}

function edgeExists(
  sourceTaskId: string,
  candidateTaskId: string,
  direction: DependencyDirection,
  edges: DependencyEdge[]
) {
  const fromTaskId = direction === 'outgoing' ? sourceTaskId : candidateTaskId;
  const toTaskId = direction === 'outgoing' ? candidateTaskId : sourceTaskId;
  return edges.some((edge) => edge.fromTaskId === fromTaskId && edge.toTaskId === toTaskId);
}

function scoreCandidate(sourceTask: Task, candidateTask: Task): DependencyCandidate {
  let score = 0;
  const reasons: string[] = [];

  if (sourceTask.parentId && sourceTask.parentId === candidateTask.parentId) {
    score += 100;
    reasons.push('same parent');
  }

  if (candidateTask.priority === 'critical') {
    score += 20;
    reasons.push('critical priority');
  }

  score += Math.max(0, 10 - Math.abs(sourceTask.sortOrder - candidateTask.sortOrder));

  return { taskId: candidateTask.id, score, reasons };
}
```

- [ ] **Step 4: Verify tests pass**

Run:

```bash
npm test -- src/tests/unit/dependencySuggestionService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/services/dependencySuggestionService.ts src/tests/unit/dependencySuggestionService.test.ts
git commit -m "feat: rank dependency candidates"
```

---

## Task 5: Make Inspector Dependency Editing Less Repetitive

**Files:**
- Modify: `src/components/inspector/DependencyEditor.tsx`
- Create: `src/tests/unit/dependencyEditor.test.tsx`

- [ ] **Step 1: Write failing component tests**

Create `src/tests/unit/dependencyEditor.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import DependencyEditor from '../../components/inspector/DependencyEditor';
import type { Task } from '../../domain/models/task';
import { computeAllDerivedStates } from '../../domain/services/taskTreeService';
import { useGraphStore } from '../../state/graphStore';
import { useProjectStore } from '../../state/projectStore';
import { useTaskStore } from '../../state/taskStore';

function makeTask(id: string, title: string): Task {
  return {
    id,
    projectId: 'project-1',
    parentId: null,
    title,
    manualStatus: 'todo',
    priority: 'medium',
    sortOrder: 0,
    createdAt: '2026-05-15T00:00:00.000Z',
    updatedAt: '2026-05-15T00:00:00.000Z',
  };
}

describe('DependencyEditor', () => {
  beforeEach(() => {
    const tasks = [
      makeTask('selected', 'Selected task'),
      makeTask('before', 'Before task'),
      makeTask('after', 'After task'),
    ];
    useProjectStore.setState({ currentProjectId: 'project-1' });
    useTaskStore.setState({
      tasks,
      derivedStates: computeAllDerivedStates(tasks, []),
      selectedTaskId: 'selected',
      loading: false,
    });
    useGraphStore.setState({
      edges: [],
      readyTasks: [],
      blockedReasons: [],
      topologicalOrder: [],
      loading: false,
    });
  });

  it('uses independent incoming and outgoing selectors', async () => {
    render(<DependencyEditor />);

    fireEvent.change(screen.getByLabelText('添加前置任务'), { target: { value: 'before' } });
    fireEvent.click(screen.getByRole('button', { name: '添加为前置' }));

    await waitFor(() => {
      expect(useGraphStore.getState().edges).toEqual([
        expect.objectContaining({ fromTaskId: 'before', toTaskId: 'selected' }),
      ]);
    });

    fireEvent.change(screen.getByLabelText('添加后续任务'), { target: { value: 'after' } });
    fireEvent.click(screen.getByRole('button', { name: '添加为后续' }));

    await waitFor(() => {
      expect(useGraphStore.getState().edges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ fromTaskId: 'before', toTaskId: 'selected' }),
          expect.objectContaining({ fromTaskId: 'selected', toTaskId: 'after' }),
        ])
      );
    });
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run:

```bash
npm test -- src/tests/unit/dependencyEditor.test.tsx
```

Expected: FAIL because the current component uses one shared selector and lacks the specified labels/buttons.

- [ ] **Step 3: Refactor `DependencyEditor.tsx`**

Use two separate pieces of state:

```tsx
const [incomingTarget, setIncomingTarget] = useState('');
const [outgoingTarget, setOutgoingTarget] = useState('');
```

Add selectors with stable accessible labels:

```tsx
<label className="m3-form-label" htmlFor="incoming-dependency-select">添加前置任务</label>
<select
  id="incoming-dependency-select"
  value={incomingTarget}
  onChange={(event) => setIncomingTarget(event.target.value)}
>
  <option value="">选择会阻塞当前任务的任务</option>
  {incomingCandidates.map((candidate) => (
    <option key={candidate.taskId} value={candidate.taskId}>
      {taskTitle(candidate.taskId)}
    </option>
  ))}
</select>
<button className="m3-btn-filled-tonal m3-btn-sm" onClick={handleAddIncoming}>
  添加为前置
</button>
```

Repeat for outgoing:

```tsx
<label className="m3-form-label" htmlFor="outgoing-dependency-select">添加后续任务</label>
<select
  id="outgoing-dependency-select"
  value={outgoingTarget}
  onChange={(event) => setOutgoingTarget(event.target.value)}
>
  <option value="">选择依赖当前任务的任务</option>
  {outgoingCandidates.map((candidate) => (
    <option key={candidate.taskId} value={candidate.taskId}>
      {taskTitle(candidate.taskId)}
    </option>
  ))}
</select>
<button className="m3-btn-filled-tonal m3-btn-sm" onClick={handleAddOutgoing}>
  添加为后续
</button>
```

Use `getDependencyCandidates`:

```tsx
const incomingCandidates = getDependencyCandidates({
  sourceTaskId: task.id,
  direction: 'incoming',
  tasks,
  edges,
});

const outgoingCandidates = getDependencyCandidates({
  sourceTaskId: task.id,
  direction: 'outgoing',
  tasks,
  edges,
});
```

- [ ] **Step 4: Verify component test passes**

Run:

```bash
npm test -- src/tests/unit/dependencyEditor.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/inspector/DependencyEditor.tsx src/tests/unit/dependencyEditor.test.tsx
git commit -m "feat: streamline inspector dependency editing"
```

---

## Task 6: Add Direct Dependency Editing In The Graph

**Files:**
- Modify: `src/state/uiStore.ts`
- Modify: `src/components/graph/GraphView.tsx`
- Modify: `src/components/graph/GraphNode.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Add dependency edit state**

In `src/state/uiStore.ts`, add:

```ts
export type DependencyDraft = {
  sourceTaskId: string | null;
  targetTaskId: string | null;
};
```

Add fields to `UIStoreState`:

```ts
dependencyDraft: DependencyDraft;
startDependencyDraft: (sourceTaskId: string) => void;
setDependencyDraftTarget: (targetTaskId: string | null) => void;
clearDependencyDraft: () => void;
```

Add default state:

```ts
dependencyDraft: { sourceTaskId: null, targetTaskId: null },
```

Add actions:

```ts
startDependencyDraft: (sourceTaskId) =>
  set({ dependencyDraft: { sourceTaskId, targetTaskId: null } }),
setDependencyDraftTarget: (targetTaskId) =>
  set((state) => ({
    dependencyDraft: {
      ...state.dependencyDraft,
      targetTaskId,
    },
  })),
clearDependencyDraft: () =>
  set({ dependencyDraft: { sourceTaskId: null, targetTaskId: null } }),
```

- [ ] **Step 2: Add graph node action props**

In `GraphView.tsx`, read UI actions:

```ts
const dependencyDraft = useUIStore((state) => state.dependencyDraft);
const startDependencyDraft = useUIStore((state) => state.startDependencyDraft);
const clearDependencyDraft = useUIStore((state) => state.clearDependencyDraft);
```

Pass to `toReactFlowNodes`:

```ts
return toReactFlowNodes(
  visibleTasks,
  derivedStates,
  graphLayout.positions,
  handleNodeStatusChange,
  startDependencyDraft,
  dependencyDraft.sourceTaskId
);
```

Update `toReactFlowNodes` signature:

```ts
function toReactFlowNodes(
  tasks: Task[],
  derived: Map<string, DerivedTaskState>,
  positions: Map<string, { x: number; y: number; source: 'auto' | 'manual' }>,
  onSetStatus: (taskId: string, status: ManualTaskStatus) => void,
  onStartDependency: (taskId: string) => void,
  dependencySourceTaskId: string | null
): Node[] {
```

Add data:

```ts
onStartDependency,
isDependencySource: dependencySourceTaskId === task.id,
```

- [ ] **Step 3: Add node button**

In `GraphNode.tsx`, extend `TaskNodeData`:

```ts
onStartDependency?: (taskId: string) => void;
isDependencySource?: boolean;
```

Add a button in `.node-actions`:

```tsx
<button
  className={`node-action-btn ${isDependencySource ? 'active' : ''}`}
  onClick={(event) => {
    event.stopPropagation();
    onStartDependency?.(task.id);
  }}
  type="button"
  title="从此任务创建依赖"
>
  <GitBranch size={12} />
</button>
```

Import:

```ts
import { Check, GitBranch, Play, RotateCcw } from 'lucide-react';
```

- [ ] **Step 4: Click target node to create dependency**

In `GraphView.tsx`, update `onNodeClick`:

```ts
const onNodeClick = useCallback(
  async (_: React.MouseEvent, node: Node) => {
    if (dependencyDraft.sourceTaskId && dependencyDraft.sourceTaskId !== node.id && currentProjectId) {
      const result = await addDependency(dependencyDraft.sourceTaskId, node.id, currentProjectId);
      if (!result.success) {
        alert(result.message);
      }
      clearDependencyDraft();
      return;
    }

    selectTask(node.id);
    openInspector('details');
  },
  [
    addDependency,
    clearDependencyDraft,
    currentProjectId,
    dependencyDraft.sourceTaskId,
    openInspector,
    selectTask,
  ]
);
```

- [ ] **Step 5: Add preview and source styles**

Append to `src/index.css`:

```css
.node-action-btn.active {
  border-color: var(--google-blue);
  color: var(--google-blue);
  background: rgba(66,133,244,0.14);
}

.task-node.dependency-source {
  outline: 2px solid rgba(66,133,244,0.55);
  outline-offset: 4px;
}
```

In `GraphNode.tsx`, add the class:

```tsx
<div className={`task-node status-${status}${isContainer ? ' task-node-container' : ''}${isDependencySource ? ' dependency-source' : ''}`}>
```

- [ ] **Step 6: Verify manually in the browser**

Run:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

Open:

```text
http://127.0.0.1:5173/Questack/
```

Manual check:

- Load sample data.
- Open graph view.
- Click dependency button on one node.
- Click a later node in the same task group.
- Confirm an edge appears.
- Try creating a cycle and confirm the existing cycle warning still appears.

- [ ] **Step 7: Commit**

```bash
git add src/state/uiStore.ts src/components/graph/GraphView.tsx src/components/graph/GraphNode.tsx src/index.css
git commit -m "feat: add direct graph dependency editing"
```

---

## Task 7: Version And README Maintenance

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `README.md`

- [ ] **Step 1: Bump version to v0.5.0**

Modify `package.json`:

```json
"version": "0.5.0"
```

Modify both top-level version entries in `package-lock.json`:

```json
"version": "0.5.0"
```

- [ ] **Step 2: Update README current status**

In `README.md`, update:

```markdown
Current version: `0.5.0`
```

Update test count after running the full suite. The expected count after this plan is at least 56 tests:

```markdown
Testing: Vitest unit and component coverage for graph layout, task groups, task maps, dependency editing, import/export, sample data, and store behavior.
```

- [ ] **Step 3: Add README Version History entry**

Add this entry at the top of Version History:

```markdown
### 0.5.0 - Task Map And Dependency Editing UX

- Added task-map set visuals for decomposition in graph view.
- Fixed task-tree expand/collapse hit target and accessibility.
- Added ranked dependency candidates.
- Split incoming and outgoing dependency editing controls.
- Added direct graph dependency creation from node actions.
- Kept one task group per graph view and preserved left-to-right dependency order.
```

- [ ] **Step 4: Run final verification**

Run:

```bash
npx -p npm@10 npm ci
npm run lint
npm test
npm run build
```

Expected:

- `npm ci`: PASS with no lockfile sync errors.
- `npm run lint`: PASS.
- `npm test`: PASS, with all test files passing.
- `npm run build`: PASS. A Vite chunk-size warning is acceptable if it is the only warning.

- [ ] **Step 5: Commit and push**

```bash
git add package.json package-lock.json README.md
git commit -m "docs: record v0.5.0 release"
git push origin main
```

---

## Self-Review Checklist

- [ ] The plan keeps the tree view and task-map graph view as complementary surfaces.
- [ ] The plan treats decomposition as containment/set regions, not as pure indentation only.
- [ ] The plan fixes the reported tree-arrow reliability issue with a larger button, accessible labels, and propagation control.
- [ ] The plan makes dependency editing possible from both inspector and graph canvas.
- [ ] The plan reduces unnecessary operations by avoiding shared selectors and inspector-only edge creation.
- [ ] The plan preserves existing IndexedDB schema and Zustand store boundaries.
- [ ] The plan includes explicit tests before implementation for each behavior change.
- [ ] The plan requires README and version history maintenance.
