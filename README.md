# Questack

Current version: `0.5.0`

Questack is a local-first DAG task roadmap web application. It helps users break complex goals into task structures, connect tasks with prerequisite dependencies, and see what is ready, blocked, active, or complete.

## Product Model

Questack intentionally keeps two relationships separate:

- **Task decomposition**: parent and child tasks describe how a goal is broken down.
- **Task dependency**: directed edges describe "A must finish before B can start".

The graph workspace shows one task group per view. A task group is a connected set of tasks formed by decomposition links and dependency links. Interdependent groups contain explicit dependency edges; independent groups do not. In graph view, decomposition is expressed as task-map containment regions, while explicit dependencies remain directional left-to-right edges.

## Features

- **Task Tree**: Organize goals into hierarchical task trees with unlimited nesting.
- **Task Map Graph**: Show one independent or interdependent task group per graph view with set-style containment regions.
- **Strict Graph Layout**: Top-to-bottom means task decomposition depth; left-to-right means dependency order.
- **Status-Rich Nodes**: Show todo, ready, blocked, in progress, done, and canceled states directly on task nodes.
- **DAG Dependency Graph**: Express prerequisite relationships with cycle detection, ranked candidates, inspector editing, and direct graph-node creation.
- **Ready Queue**: Auto-compute leaf tasks that are unblocked and ready to execute.
- **Roadmap View**: Use topological order to show execution sequence and blocked reasons.
- **Local-First Persistence**: Store all project data in IndexedDB through Dexie.
- **Import/Export**: Export and validate Questack JSON project data.
- **Theme Support**: Light and dark UI with Google-inspired status colors and app-level theme toggle.
- **Sample Project**: Built-in feature-tour sample data for onboarding and QA.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 19 + TypeScript + Vite |
| State | Zustand |
| Graph UI | React Flow `@xyflow/react` |
| Persistence | IndexedDB via Dexie |
| Icons | lucide-react |
| Validation | Zod |
| Testing | Vitest + React Testing Library + fake-indexeddb |
| Deployment | GitHub Pages via GitHub Actions |

## Architecture

```text
src/
  domain/         Pure business logic: models, services, graph algorithms
  repositories/   IndexedDB persistence adapters
  state/          Zustand stores connecting repositories to UI
  components/     React UI components for tree, graph, queue, inspector, layout
  tests/          Unit and component tests
docs/
  superpowers/
    plans/        Agent-readable implementation plans
```

## Getting Started

```bash
npm install
npm run dev
npm run lint
npm test
npm run build
```

Local dev URL when using the default project base:

```text
http://127.0.0.1:5173/Questack/
```

For CI parity, use npm 10 clean install before release verification:

```bash
npx -p npm@10 npm ci
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+1` | Tree View |
| `Ctrl+2` | Graph View |
| `Ctrl+3` | Ready Queue |
| `Ctrl+4` | Roadmap |
| `Ctrl+N` | New Task |
| `Ctrl+E` | Export JSON |
| `Ctrl+I` | Toggle Inspector |
| `Delete` | Delete selected task |

## Agent Plans

Agent-readable plans live in `docs/superpowers/plans/`.

Most recent implementation plan:

- [`2026-05-15-task-map-dependency-ux.md`](./docs/superpowers/plans/2026-05-15-task-map-dependency-ux.md): v0.5.0 plan for task-map decomposition visuals, task-tree expand reliability, and smoother dependency editing.

## Version History

### 0.5.0 - Task Map And Dependency Editing UX

- Added task-map set visuals for decomposition in graph view.
- Fixed task-tree expand/collapse hit target, accessibility, and reactive expansion state.
- Added ranked dependency candidates that filter duplicates, archived tasks, self-dependencies, and cycle risks.
- Split incoming and outgoing dependency editing controls in the inspector.
- Added direct graph dependency creation from node actions with source and target preview states.
- Kept one task group per graph view and preserved top-to-bottom decomposition with left-to-right dependency order.

### 0.4.0 - Planning Baseline For Task Map And Dependency UX

- Added the agent-readable v0.5.0 implementation plan for task-map decomposition visuals and dependency editing UX.
- Established README as the durable version history and release log.
- Documented the current task group graph model and CI verification commands.

### 0.3.0 - Task Group Graph Workspace

- Added task group detection for independent and interdependent task groups.
- Changed graph view to show one task group per view.
- Enforced top-to-bottom decomposition and left-to-right dependency order.
- Added graph status filters, task group switching, and node quick status actions.

### 0.2.1 - Sample Loading Fix

- Fixed project loading from IndexedDB when `archivedAt` is missing.
- Added tests for loading the feature-tour sample from the empty start screen.

### 0.2.0 - Feature Tour Sample Data

- Added a built-in Questack feature-tour sample project.
- Covered statuses, priorities, estimates, deep decomposition, ready tasks, blocked reasons, and independent task groups.

### 0.1.0 - Local-First MVP

- Implemented the local-first DAG task roadmap MVP.
- Added task tree, graph view, ready queue, roadmap, inspector, IndexedDB persistence, import/export, and core tests.

## Maintenance Rules

- Every shipped behavior change must update `README.md` Version History.
- Every release must keep `package.json` and `package-lock.json` versions in sync.
- For deployment-bound changes, run:

```bash
npx -p npm@10 npm ci
npm run lint
npm test
npm run build
```

- Push to `main` triggers GitHub Pages deployment through GitHub Actions.
