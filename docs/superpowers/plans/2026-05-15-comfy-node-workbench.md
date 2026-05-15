# Comfy Node Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Questack v0.6.0 as a clearer task-map node workbench where task decomposition and task dependencies are visually distinct, and common node operations feel closer to a ComfyUI-style graph canvas.

**Architecture:** Keep the existing React Flow graph and local-first stores. Add one pure domain service for node quick-action drafts, then wire node-level controls into `GraphView` and `GraphNode`; improve relationship styling with explicit dependency ports, edge labels, containment badges, and a compact relationship key. Avoid schema changes.

**Tech Stack:** React 19, TypeScript, Vite, Zustand, React Flow `@xyflow/react`, Dexie, Vitest, React Testing Library, lucide-react.

---

## Product Direction

Questack must make two relationships easy to distinguish at a glance:

- **Task decomposition**: parent contains child work. It should read as a vertical breakdown and bounded problem area. Use task-map regions, container node badges, and subtle vertical guide edges.
- **Task dependency**: one task blocks another. It should read as an explicit left-to-right flow. Use visible left/right ports, stronger directional edges, arrow markers, and red blocking emphasis.

The ComfyUI-inspired interaction target is not to copy ComfyUI visually. The target is the same operational feel: nodes have clear ports, local node controls, direct canvas manipulation, and quick node creation without leaving the graph.

## Scope

Implement this as `v0.6.0`:

- Add clearer graph relation metadata and styling.
- Add node-level quick actions:
  - add a child task under the selected node;
  - add a successor task beside the selected node and create a dependency from source to successor;
  - keep existing status and dependency-source actions.
- Make React Flow handles visible and semantically styled:
  - left port: prerequisite input;
  - right port: successor output.
- Add a compact relationship key in the graph command area for task decomposition, dependency, and blocking dependency.
- Update README and package versions.

Out of scope for this release:

- multi-node copy/paste;
- full ComfyUI node search palette;
- custom edge dragging beyond React Flow connections;
- persistence schema changes.

## File Structure

### Existing Files To Modify

- `src/components/graph/GraphView.tsx`
  - Pass new quick-action handlers into graph nodes.
  - Create child/successor tasks from node actions.
  - Add a compact relationship key in the command bar.
  - Improve edge labels and relationship metadata.

- `src/components/graph/GraphNode.tsx`
  - Add visible dependency ports.
  - Add node action buttons for child and successor creation.
  - Show container/decomposition metadata more clearly.

- `src/index.css`
  - Style visible ports, relationship key chips, clearer dependency/decomposition/blocking edges, and node action hover states.

- `README.md`
  - Add v0.6.0 release notes.

- `package.json`
  - Bump version to `0.6.0`.

- `package-lock.json`
  - Keep lockfile root versions in sync.

### New Files To Create

- `src/domain/services/nodeQuickActionService.ts`
  - Pure helpers for drafting child/successor task creation from a graph node.

- `src/tests/unit/nodeQuickActionService.test.ts`
  - Tests for child/successor draft titles, parent IDs, and sort order.

- `src/tests/unit/graphNode.test.tsx`
  - Component tests for node quick actions and visible relationship controls.

---

## Task 1: Add Node Quick-Action Draft Service

**Files:**
- Create: `src/domain/services/nodeQuickActionService.ts`
- Create: `src/tests/unit/nodeQuickActionService.test.ts`

- [ ] **Step 1: Write failing service tests**

Create `src/tests/unit/nodeQuickActionService.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Task } from '../../domain/models/task';
import {
  createChildTaskDraft,
  createSuccessorTaskDraft,
} from '../../domain/services/nodeQuickActionService';

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

describe('node quick action drafts', () => {
  it('creates a child draft under the source node after existing children', () => {
    const source = makeTask('source', { title: '设计节点工作台', sortOrder: 2 });
    const tasks = [
      source,
      makeTask('child-a', { parentId: 'source', sortOrder: 0 }),
      makeTask('child-b', { parentId: 'source', sortOrder: 1 }),
    ];

    expect(createChildTaskDraft(source, tasks)).toEqual({
      parentId: 'source',
      title: '设计节点工作台 / 子任务 3',
      sortOrder: 2,
    });
  });

  it('creates a successor draft as the next sibling', () => {
    const source = makeTask('source', { parentId: 'parent', title: '整理依赖', sortOrder: 1 });
    const tasks = [
      makeTask('sibling-a', { parentId: 'parent', sortOrder: 0 }),
      source,
      makeTask('sibling-b', { parentId: 'parent', sortOrder: 2 }),
    ];

    expect(createSuccessorTaskDraft(source, tasks)).toEqual({
      parentId: 'parent',
      title: '整理依赖 的后续任务',
      sortOrder: 3,
    });
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run:

```bash
npm test -- src/tests/unit/nodeQuickActionService.test.ts
```

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement service**

Create `src/domain/services/nodeQuickActionService.ts`:

```ts
import type { Task } from '../models/task';

export interface TaskCreationDraft {
  parentId: string | null;
  title: string;
  sortOrder: number;
}

export function createChildTaskDraft(sourceTask: Task, tasks: Task[]): TaskCreationDraft {
  const childCount = tasks.filter(
    (task) => task.parentId === sourceTask.id && task.archivedAt == null
  ).length;

  return {
    parentId: sourceTask.id,
    title: `${sourceTask.title || '未命名任务'} / 子任务 ${childCount + 1}`,
    sortOrder: childCount,
  };
}

export function createSuccessorTaskDraft(sourceTask: Task, tasks: Task[]): TaskCreationDraft {
  const siblingCount = tasks.filter(
    (task) => task.parentId === sourceTask.parentId && task.archivedAt == null
  ).length;

  return {
    parentId: sourceTask.parentId,
    title: `${sourceTask.title || '未命名任务'} 的后续任务`,
    sortOrder: siblingCount,
  };
}
```

- [ ] **Step 4: Verify test passes**

Run:

```bash
npm test -- src/tests/unit/nodeQuickActionService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/services/nodeQuickActionService.ts src/tests/unit/nodeQuickActionService.test.ts
git commit -m "feat: add graph node quick action drafts"
```

---

## Task 2: Add Comfy-Style Node Controls

**Files:**
- Modify: `src/components/graph/GraphNode.tsx`
- Create: `src/tests/unit/graphNode.test.tsx`

- [ ] **Step 1: Write failing node component tests**

Create `src/tests/unit/graphNode.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { ReactFlowProvider, type NodeProps } from '@xyflow/react';
import { describe, expect, it, vi } from 'vitest';
import TaskGraphNode from '../../components/graph/GraphNode';
import type { Task } from '../../domain/models/task';

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

function renderNode(overrides: Record<string, unknown> = {}) {
  const onCreateChild = vi.fn();
  const onCreateSuccessor = vi.fn();

  render(
    <ReactFlowProvider>
      <TaskGraphNode
        data={{
          task: makeTask('task-1', '任务节点'),
          derivedState: undefined,
          status: 'ready',
          onCreateChild,
          onCreateSuccessor,
          ...overrides,
        }}
      />
    </ReactFlowProvider>
  );

  return { onCreateChild, onCreateSuccessor };
}

describe('TaskGraphNode node workbench controls', () => {
  it('exposes quick actions for child and successor task creation', () => {
    const { onCreateChild, onCreateSuccessor } = renderNode();

    fireEvent.click(screen.getByRole('button', { name: '添加子任务' }));
    fireEvent.click(screen.getByRole('button', { name: '添加后续任务' }));

    expect(onCreateChild).toHaveBeenCalledWith('task-1');
    expect(onCreateSuccessor).toHaveBeenCalledWith('task-1');
  });

  it('renders dependency input and output ports', () => {
    renderNode();

    expect(document.querySelector('.dependency-port.in')).toBeTruthy();
    expect(document.querySelector('.dependency-port.out')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run:

```bash
npm test -- src/tests/unit/graphNode.test.tsx
```

Expected: FAIL because the node does not yet expose those controls or port classes.

- [ ] **Step 3: Update `GraphNode.tsx`**

Add imports:

```ts
import { Check, GitBranch, ListTree, Play, Plus, RotateCcw, StepForward } from 'lucide-react';
```

Extend node data:

```ts
onCreateChild?: (taskId: string) => void;
onCreateSuccessor?: (taskId: string) => void;
```

Change handles:

```tsx
<Handle className="dependency-port in" type="target" position={Position.Left} />
...
<Handle className="dependency-port out" type="source" position={Position.Right} />
```

Add node action buttons:

```tsx
<button
  aria-label="添加子任务"
  className="node-action-btn"
  onClick={(event) => {
    event.stopPropagation();
    onCreateChild?.(task.id);
  }}
  onPointerDown={stopActionPointer}
  type="button"
  title="添加子任务"
>
  <ListTree size={12} />
</button>
<button
  aria-label="添加后续任务"
  className="node-action-btn"
  onClick={(event) => {
    event.stopPropagation();
    onCreateSuccessor?.(task.id);
  }}
  onPointerDown={stopActionPointer}
  type="button"
  title="添加后续任务"
>
  <StepForward size={12} />
</button>
```

- [ ] **Step 4: Verify component test passes**

Run:

```bash
npm test -- src/tests/unit/graphNode.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/graph/GraphNode.tsx src/tests/unit/graphNode.test.tsx
git commit -m "feat: add comfy-style graph node controls"
```

---

## Task 3: Wire Quick Node Creation Into Graph View

**Files:**
- Modify: `src/components/graph/GraphView.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Import quick action service**

In `GraphView.tsx` import:

```ts
import {
  createChildTaskDraft,
  createSuccessorTaskDraft,
} from '../../domain/services/nodeQuickActionService';
```

- [ ] **Step 2: Read `createTask` from `useTaskStore`**

Inside `GraphView`:

```ts
const createTask = useTaskStore((s) => s.createTask);
```

- [ ] **Step 3: Add quick creation callbacks**

Add:

```ts
const handleCreateChildTask = useCallback(
  async (taskId: string) => {
    if (!currentProjectId) return;
    const sourceTask = tasks.find((task) => task.id === taskId);
    if (!sourceTask) return;

    const draft = createChildTaskDraft(sourceTask, tasks);
    const child = await createTask(currentProjectId, draft.parentId, draft.title, draft.sortOrder);
    selectTask(child.id);
    openInspector('details');
  },
  [createTask, currentProjectId, openInspector, selectTask, tasks]
);

const handleCreateSuccessorTask = useCallback(
  async (taskId: string) => {
    if (!currentProjectId) return;
    const sourceTask = tasks.find((task) => task.id === taskId);
    if (!sourceTask) return;

    const draft = createSuccessorTaskDraft(sourceTask, tasks);
    const successor = await createTask(currentProjectId, draft.parentId, draft.title, draft.sortOrder);
    const result = await addDependency(sourceTask.id, successor.id, currentProjectId);
    if (!result.success) {
      alert(result.message);
    }
    selectTask(successor.id);
    openInspector('details');
  },
  [addDependency, createTask, currentProjectId, openInspector, selectTask, tasks]
);
```

- [ ] **Step 4: Pass callbacks into React Flow node data**

Update `toReactFlowNodes` signature and data:

```ts
onCreateChild: (taskId: string) => void,
onCreateSuccessor: (taskId: string) => void,
```

Pass:

```ts
onCreateChild,
onCreateSuccessor,
```

- [ ] **Step 5: Add styles for visible ports and tighter action strip**

Append to `src/index.css`:

```css
.dependency-port {
  width: 12px;
  height: 12px;
  border: 2px solid var(--md-surface-container);
  background: var(--google-blue);
  box-shadow: 0 0 0 3px rgba(66,133,244,0.14);
}

.dependency-port.in {
  background: var(--google-red);
}

.dependency-port.out {
  background: var(--google-blue);
}

.task-node:hover .dependency-port {
  box-shadow: 0 0 0 5px rgba(66,133,244,0.2);
}
```

- [ ] **Step 6: Verify build**

Run:

```bash
npm run build
```

Expected: PASS with only the existing Vite chunk-size warning if any.

- [ ] **Step 7: Commit**

```bash
git add src/components/graph/GraphView.tsx src/index.css
git commit -m "feat: create tasks directly from graph nodes"
```

---

## Task 4: Clarify Relationship Visual Language

**Files:**
- Modify: `src/components/graph/GraphView.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Make graph relationship key visible in command bar**

In `GraphCommandBar`, add below the status strip:

```tsx
<div className="graph-relationship-key" aria-label="图关系类型">
  <span className="relationship-key-item decomposition"><span />拆解</span>
  <span className="relationship-key-item dependency"><span />依赖</span>
  <span className="relationship-key-item blocking"><span />阻塞</span>
</div>
```

- [ ] **Step 2: Make dependency labels explicit**

In `toReactFlowEdges`:

```ts
label: isBlocking ? '阻塞' : '依赖',
```

In `toDecompositionEdges`:

```ts
label: '拆解',
```

- [ ] **Step 3: Strengthen relationship CSS**

Append to `src/index.css`:

```css
.graph-relationship-key {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
}

.relationship-key-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 9px;
  border: 1px solid var(--panel-border);
  border-radius: 999px;
  background: var(--md-surface-container);
  font: 800 11px/14px var(--font-sans);
  color: var(--md-on-surface-variant);
}

.relationship-key-item span {
  width: 24px;
  height: 0;
  border-top: 2px solid var(--md-outline);
}

.relationship-key-item.decomposition span {
  border-top-style: dashed;
  border-color: var(--google-green);
}

.relationship-key-item.dependency span {
  border-color: var(--google-blue);
}

.relationship-key-item.blocking span {
  border-color: var(--google-red);
}
```

Update edge styles so dependency, blocking, and decomposition are unmistakable.

- [ ] **Step 4: Verify build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/graph/GraphView.tsx src/index.css
git commit -m "feat: clarify graph relationship language"
```

---

## Task 5: Version And README Maintenance

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `README.md`

- [ ] **Step 1: Bump version**

Run:

```bash
npm version 0.6.0 --no-git-tag-version
```

- [ ] **Step 2: Update README**

Update current version to `0.6.0`, update the most recent plan entry, and add:

```markdown
### 0.6.0 - Comfy Node Workbench

- Clarified graph relationship language for task decomposition, dependencies, and blocking edges.
- Added visible dependency input/output ports on graph nodes.
- Added graph-node quick actions for creating child tasks and dependency-linked successor tasks.
- Improved task-map containment and dependency edge styling for faster visual scanning.
- Preserved one task group per graph view and the top-to-bottom decomposition / left-to-right dependency model.
```

- [ ] **Step 3: Run final verification**

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
- `npm test`: PASS.
- `npm run build`: PASS. Existing Vite chunk-size warning is acceptable.

- [ ] **Step 4: Commit and push**

```bash
git add package.json package-lock.json README.md
git commit -m "docs: record v0.6.0 release"
git push origin main
```

- [ ] **Step 5: Confirm GitHub Actions**

Run:

```powershell
$headers = @{ 'User-Agent' = 'Codex' }
$runs = Invoke-RestMethod -Uri 'https://api.github.com/repos/Quaternijkon/Questack/actions/runs?branch=main&per_page=3' -Headers $headers
$runs.workflow_runs | Select-Object id, name, head_sha, status, conclusion, html_url, created_at, updated_at | Format-Table -AutoSize
```

Expected: latest run for the pushed commit completes with `conclusion=success`.

---

## Self-Review Checklist

- [ ] Task decomposition is represented as containment/region plus subtle vertical decomposition edges.
- [ ] Task dependency is represented as directional left-to-right edges and visible node ports.
- [ ] Blocking dependency remains visually distinct from ordinary dependency.
- [ ] Common node creation work can happen directly from graph nodes.
- [ ] The implementation does not change IndexedDB schema.
- [ ] Tests are written before production behavior changes.
- [ ] README and versions are maintained for v0.6.0.
