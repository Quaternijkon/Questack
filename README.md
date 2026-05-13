# Questack

A local-first DAG task roadmap web application. Break complex goals into task trees with dependency graphs, and let the system tell you exactly what to work on next.

## Features

- **Infinite Task Tree**: Organize goals into hierarchical task trees with unlimited nesting
- **DAG Dependency Graph**: Express "A must complete before B" relationships with full cycle detection
- **Ready Queue**: System auto-computes which leaf tasks are unblocked and ready to execute
- **Roadmap View**: Topological sort generates execution order; blocked tasks show exact reasons
- **Graph Visualization**: React Flow canvas with dagre auto-layout, drag-to-connect edges
- **Material Design 3**: Dark theme with M3 color tokens, elevation, typography, and motion
- **Offline-First**: All data persisted in IndexedDB (via Dexie); works entirely offline
- **Import/Export**: Full JSON export/import with validation (cycle detection, cross-project checks)
- **Keyboard Shortcuts**: Ctrl+1-4 for views, Ctrl+N for new task, Ctrl+E for export

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript + Vite |
| State | Zustand |
| Graph Viz | React Flow (@xyflow/react) + dagre auto-layout |
| Persistence | IndexedDB via Dexie |
| Testing | Vitest (38 unit tests) |
| Deployment | GitHub Pages (automatic via Actions) |

## Architecture

```
src/
  domain/         Pure business logic (models, services, algorithms)
  repositories/   Data persistence abstraction (IndexedDB via Dexie)
  state/          Zustand stores connecting repositories to UI
  components/     React UI components (tree, graph, queue, inspector)
  tests/          Unit tests for core algorithms
```

## Getting Started

```bash
npm install
npm run dev      # Start dev server
npm run build    # Production build
npm test         # Run 38 unit tests
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

## Project Status

MVP complete. All core features implemented per the [engineering plan](./dag-task-roadmap-webapp-plan.md).
