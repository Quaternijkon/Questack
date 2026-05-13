# Questack MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first DAG task roadmap web app (Questack) per the spec in `dag-task-roadmap-webapp-plan.md`.

**Architecture:** React + TypeScript + Vite SPA with Zustand state management, React Flow (@xyflow/react) for DAG visualization, dagre for auto-layout, Dexie (IndexedDB wrapper) for persistence, Zod for validation. Strictly layered: domain/services -> repositories -> state -> components.

**Tech Stack:** React 18, TypeScript, Vite, Zustand, React Flow (@xyflow/react), dagre, Dexie, Zod, Vitest, React Testing Library

---

## Phase 0: Project Scaffolding

### Task 0.1: Initialize Vite + React + TypeScript project

**Files:**
- Create: All project scaffolding files via `npm create vite@latest`

- [ ] **Step 1: Scaffold project**
```bash
cd D:\project\Questack
npm create vite@latest . -- --template react-ts
```

- [ ] **Step 2: Install dependencies**
```bash
npm install zustand @xyflow/react dagre @types/dagre dexie zod uuid
npm install -D @types/uuid vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Verify project runs**
```bash
npm run dev
npm run build
```

### Task 0.2: Create directory structure

Create all directories per spec Section 8:
- src/domain/models/
- src/domain/services/
- src/domain/validators/
- src/repositories/indexedDb/
- src/state/
- src/components/task-tree/
- src/components/graph/
- src/components/ready-queue/
- src/components/inspector/
- src/components/common/
- src/components/layout/
- src/tests/unit/
- src/tests/integration/

---

## Phase 1: Domain Models & Services

### Task 1.1: Define data models
Create: src/domain/models/project.ts, task.ts, dependency.ts
(Exact interfaces from spec Sections 4.1-4.4)

### Task 1.2: Implement graph service (cycle detection, topological sort)
Create: src/domain/services/graphService.ts
(Exact algorithms from spec Sections 6.1-6.6)

### Task 1.3: Implement ready queue service
Create: src/domain/services/readyQueueService.ts
(computeReadyTasks, computeBlockedReasons, computeRollupStatus)

### Task 1.4: Implement task tree service
Create: src/domain/services/taskTreeService.ts
(buildChildMap, getPath, getDescendants, validate tree operations)

### Task 1.5: Implement import/export service
Create: src/domain/services/importExportService.ts
(JSON export/import with Zod validation)

---

## Phase 2: Persistence Layer

### Task 2.1: IndexedDB setup with Dexie
Create: src/repositories/indexedDb/db.ts

### Task 2.2: Repositories
Create:
- src/repositories/ProjectRepository.ts
- src/repositories/TaskRepository.ts
- src/repositories/DependencyRepository.ts
Create:
- src/repositories/indexedDb/IndexedDbProjectRepository.ts
- src/repositories/indexedDb/IndexedDbTaskRepository.ts
- src/repositories/indexedDb/IndexedDbDependencyRepository.ts

---

## Phase 3: State Management (Zustand)

### Task 3.1: Project store
Create: src/state/projectStore.ts

### Task 3.2: Task store
Create: src/state/taskStore.ts

### Task 3.3: Graph store
Create: src/state/graphStore.ts

### Task 3.4: UI store
Create: src/state/uiStore.ts

---

## Phase 4: Core UI Components

### Task 4.1: App shell, routing, layout
Create: src/App.tsx, src/components/layout/ProjectShell.tsx, Sidebar.tsx, MainView.tsx, InspectorPanel.tsx

### Task 4.2: Task Tree View
Create: src/components/task-tree/TaskTreeView.tsx, TaskTreeItem.tsx, TaskContextMenu.tsx

### Task 4.3: Task Inspector
Create: src/components/inspector/TaskInspector.tsx, DependencyEditor.tsx

### Task 4.4: Ready Queue View
Create: src/components/ready-queue/ReadyQueueView.tsx

### Task 4.5: Graph View (DAG visualization)
Create: src/components/graph/GraphView.tsx, GraphNode.tsx, GraphEdge.tsx, layoutGraph.ts

### Task 4.6: Roadmap View
Create: src/components/roadmap/RoadmapView.tsx

---

## Phase 5: Import/Export & Data Health

### Task 5.1: Import/Export UI
Add import/export buttons, file picker, validation display

### Task 5.2: Data health check panel
Create data validation UI component

---

## Phase 6: Tests

### Task 6.1: Unit tests for graph service
Create: src/tests/unit/graphService.test.ts

### Task 6.2: Unit tests for ready queue service
Create: src/tests/unit/readyQueueService.test.ts

### Task 6.3: Unit tests for import/export
Create: src/tests/unit/importExportService.test.ts

---

## Phase 7: GitHub Sync

### Task 7.1: Initialize git, add remote, push
```bash
git init
git add .
git commit -m "feat: Questack MVP - DAG task roadmap webapp"
git remote add origin https://github.com/Quaternijkon/Questack.git
git push -u origin main
```
