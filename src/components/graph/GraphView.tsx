import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const RANK_COLORS = [
  'rgba(122,211,211,0.06)',
  'rgba(208,188,255,0.06)',
  'rgba(204,194,220,0.06)',
  'rgba(255,183,77,0.06)',
  'rgba(122,211,211,0.06)',
  'rgba(208,188,255,0.06)',
];

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

  const [rankBands, setRankBands] = useState<{ x: number; y: number; width: number; height: number; label: string }[]>([]);

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

  const applyLayout = useCallback((direction: 'LR' | 'TB' = 'LR') => {
    if (filteredTasks.length === 0) return;
    const layouted = layoutGraph(filteredTasks, filteredEdges, direction);
    setNodes((nds) => {
      const next = nds.map((n) => {
        const pos = layouted.get(n.id);
        return pos ? { ...n, position: pos } : n;
      });
      computeRankBands(layouted, next);
      return next;
    });
  }, [filteredTasks, filteredEdges, setNodes]);

  const computeRankBands = (
    _layout: Map<string, { x: number; y: number }>,
    nds: Node[]
  ) => {
    const byX = new Map<number, { minY: number; maxY: number; count: number }>();
    for (const n of nds) {
      const rx = Math.round(n.position.x / 240) * 240;
      const existing = byX.get(rx);
      if (existing) {
        existing.minY = Math.min(existing.minY, n.position.y);
        existing.maxY = Math.max(existing.maxY, n.position.y + 80);
        existing.count++;
      } else {
        byX.set(rx, { minY: n.position.y, maxY: n.position.y + 80, count: 1 });
      }
    }
    const sortedX = [...byX.keys()].sort((a, b) => a - b);
    const bands = sortedX.map((x, i) => {
      const info = byX.get(x)!;
      return {
        x: x - 20,
        y: info.minY - 40,
        width: 280,
        height: info.maxY - info.minY + 80,
        label: `第 ${i + 1} 层 — ${info.count} 个任务`,
      };
    });
    setRankBands(bands);
  };

  const hasLaidOut = useRef(false);
  useEffect(() => {
    if (filteredTasks.length > 0 && !hasLaidOut.current) {
      const timer = setTimeout(() => {
        applyLayout('LR');
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

  const handleRelayout = useCallback(() => {
    hasLaidOut.current = false;
    applyLayout('LR');
    hasLaidOut.current = true;
  }, [applyLayout]);

  const filters: { key: UIStoreState['graphFilter']; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'ready', label: '可执行' },
    { key: 'blocked', label: '已阻塞' },
    { key: 'in_progress', label: '进行中' },
    { key: 'done', label: '已完成' },
  ];

  if (!currentProjectId) {
    return (
      <div className="empty-state">
        <h3>未选择项目</h3>
      </div>
    );
  }

  return (
    <div className="graph-container" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="main-toolbar">
        <span className="toolbar-title" style={{ fontSize: 12, color: 'var(--md-on-surface-variant)' }}>
          左→右：先后顺序 &nbsp;|&nbsp; 同层：可并行
        </span>
        <div style={{ flex: 1 }} />
        <button className="m3-btn m3-btn-filled-tonal m3-btn-sm" onClick={handleRelayout}>
          自动布局
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
      <div style={{ flex: 1, position: 'relative' }}>
        {rankBands.length > 0 && (
          <div className="rank-band-layer" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
            {rankBands.map((band, i) => (
              <div key={i} style={{ position: 'absolute', left: band.x, top: band.y, width: band.width, height: band.height }}>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: RANK_COLORS[i % RANK_COLORS.length],
                    borderLeft: '1px solid var(--md-outline-variant)',
                    borderRight: '1px solid var(--md-outline-variant)',
                    borderRadius: 'var(--shape-corner-md)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: -20,
                    left: 8,
                    fontSize: 11,
                    color: 'var(--md-on-surface-variant)',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {band.label}
                </div>
              </div>
            ))}
          </div>
        )}
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
          fitViewOptions={{ padding: 0.2 }}
          deleteKeyCode={['Backspace', 'Delete']}
          multiSelectionKeyCode="Shift"
          defaultEdgeOptions={{ type: 'smoothstep', animated: false }}
          minZoom={0.1}
          maxZoom={2}
        >
          <Background />
          <Controls />
          <MiniMap
            nodeColor={(n) => {
              const derived = derivedStates.get(n.id);
              if (derived?.computedStatus === 'ready') return 'var(--md-tertiary)';
              if (derived?.computedStatus === 'blocked') return 'var(--md-error)';
              if (derived?.computedStatus === 'done') return 'var(--md-primary)';
              return 'var(--md-outline-variant)';
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
