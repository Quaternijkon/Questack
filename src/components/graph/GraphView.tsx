import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useProjectStore } from '../../state/projectStore';
import { useTaskStore } from '../../state/taskStore';
import { useGraphStore } from '../../state/graphStore';
import { useUIStore, type UIStoreState } from '../../state/uiStore';
import TaskGraphNode from './GraphNode';
import { layoutGraph } from './layoutGraph';
import type { Task } from '../../domain/models/task';
import type { DependencyEdge } from '../../domain/models/dependency';

const nodeTypes = { taskNode: TaskGraphNode };

export default function GraphView() {
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const tasks = useTaskStore((s) => s.tasks);
  const derivedStates = useTaskStore((s) => s.derivedStates);
  const edges = useGraphStore((s) => s.edges);
  const addDependency = useGraphStore((s) => s.addDependency);
  const removeDependency = useGraphStore((s) => s.removeDependency);
  const selectTask = useTaskStore((s) => s.selectTask);
  const openInspector = useUIStore((s) => s.openInspector);
  const graphFilter = useUIStore((s) => s.graphFilter);
  const setGraphFilter = useUIStore((s) => s.setGraphFilter);

  const activeTasks = useMemo(
    () => tasks.filter((t) => t.archivedAt == null),
    [tasks]
  );

  const filteredTasks = useMemo(() => {
    if (graphFilter === 'all') return activeTasks;
    return activeTasks.filter((t) => {
      const derived = derivedStates.get(t.id);
      if (!derived) return false;
      return derived.computedStatus === graphFilter;
    });
  }, [activeTasks, derivedStates, graphFilter]);

  const filteredTaskIds = useMemo(() => new Set(filteredTasks.map((t) => t.id)), [filteredTasks]);

  const filteredEdges = useMemo(
    () => edges.filter((e) => filteredTaskIds.has(e.fromTaskId) && filteredTaskIds.has(e.toTaskId)),
    [edges, filteredTaskIds]
  );

  const layoutedNodes = useMemo(() => {
    return toReactFlowNodes(filteredTasks, derivedStates);
  }, [filteredTasks, derivedStates]);

  const layoutedEdges = useMemo(() => {
    return toReactFlowEdges(filteredEdges);
  }, [filteredEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [rfEdges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  const hasLaidOut = useRef(false);
  useEffect(() => {
    if (filteredTasks.length > 0 && !hasLaidOut.current) {
      const timer = setTimeout(() => {
        const layouted = layoutGraph(filteredTasks, filteredEdges, 'TB');
        setNodes((nds) =>
          nds.map((n) => {
            const pos = layouted.get(n.id);
            return pos ? { ...n, position: pos } : n;
          })
        );
        hasLaidOut.current = true;
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [filteredTasks.length]);

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target || !currentProjectId) return;
      const result = await addDependency(connection.source, connection.target, currentProjectId);
      if (result.success) {
        setEdges((eds) => addEdge({ ...connection, type: 'smoothstep' }, eds));
      } else {
        alert(result.message);
      }
    },
    [addDependency, currentProjectId, setEdges]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      selectTask(node.id);
      openInspector('details');
    },
    [selectTask, openInspector]
  );

  const handleLayout = useCallback(() => {
    const layouted = layoutGraph(filteredTasks, filteredEdges, 'TB');
    setNodes((nds) =>
      nds.map((n) => {
        const pos = layouted.get(n.id);
        if (pos) {
          return { ...n, position: { x: pos.x, y: pos.y } };
        }
        return n;
      })
    );
  }, [filteredTasks, filteredEdges, setNodes]);

  const filters: { key: UIStoreState['graphFilter']; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'ready', label: 'Ready' },
    { key: 'blocked', label: 'Blocked' },
    { key: 'in_progress', label: 'Active' },
    { key: 'done', label: 'Done' },
  ];

  if (!currentProjectId) {
    return (
      <div className="empty-state">
        <h3>No project selected</h3>
      </div>
    );
  }

  return (
    <div className="graph-container" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="main-toolbar">
        <button className="m3-btn m3-btn-filled-tonal m3-btn-sm" onClick={handleLayout}>
          Auto Layout
        </button>
        {filters.map((f) => (
          <button
            key={f.key}
            className={`m3-chip${graphFilter === f.key ? ' selected' : ''}`}
            onClick={() => setGraphFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgesDelete={(deletedEdges) => {
            for (const edge of deletedEdges) {
              removeDependency(edge.id);
            }
          }}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode={['Backspace', 'Delete']}
          multiSelectionKeyCode="Shift"
          defaultEdgeOptions={{ type: 'smoothstep', animated: false }}
        >
          <Background />
          <Controls />
          <MiniMap
            nodeColor={(n) => {
              const derived = derivedStates.get(n.id);
              if (derived?.computedStatus === 'ready') return '#00cec9';
              if (derived?.computedStatus === 'blocked') return '#ff6b6b';
              if (derived?.computedStatus === 'done') return '#6c5ce7';
              return '#2a2a3a';
            }}
            maskColor="rgba(0,0,0,0.5)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}

function toReactFlowNodes(
  tasks: Task[],
  derived: Map<string, import('../../domain/models/task').DerivedTaskState>
): Node[] {
  return tasks.map((task, i) => ({
    id: task.id,
    type: 'taskNode',
    position: { x: (i % 5) * 200 + 50, y: Math.floor(i / 5) * 120 + 50 },
    data: {
      task,
      derivedState: derived.get(task.id),
    },
  }));
}

function toReactFlowEdges(edges: DependencyEdge[]): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.fromTaskId,
    target: edge.toTaskId,
    type: 'smoothstep',
    animated: false,
  }));
}
