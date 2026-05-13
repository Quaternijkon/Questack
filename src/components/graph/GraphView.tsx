import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
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
import { layoutTaskGraph, type GraphLayerBand } from './layoutGraph';
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
  const graphLayoutMode = useUIStore((s) => s.graphLayoutMode);
  const setGraphLayoutMode = useUIStore((s) => s.setGraphLayoutMode);
  const graphManualPositions = useUIStore((s) => s.graphManualPositions);
  const saveGraphNodePosition = useUIStore((s) => s.saveGraphNodePosition);
  const clearGraphManualPositions = useUIStore((s) => s.clearGraphManualPositions);

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

  const graphLayout = useMemo(() => {
    const manualPositions = currentProjectId
      ? graphManualPositions[currentProjectId] ?? {}
      : {};
    return layoutTaskGraph(filteredTasks, filteredEdges, { manualPositions });
  }, [filteredTasks, filteredEdges, currentProjectId, graphManualPositions]);

  const layoutedNodes = useMemo(() => {
    return toReactFlowNodes(filteredTasks, derivedStates, graphLayout.positions);
  }, [filteredTasks, derivedStates, graphLayout.positions]);

  const layoutedEdges = useMemo(() => {
    return [
      ...toDecompositionEdges(filteredTasks, filteredTaskIds),
      ...toReactFlowEdges(filteredEdges, derivedStates),
    ];
  }, [filteredTasks, filteredTaskIds, filteredEdges, derivedStates]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [rfEdges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  useEffect(() => {
    setNodes(layoutedNodes);
  }, [layoutedNodes, setNodes]);

  useEffect(() => {
    setEdges(layoutedEdges);
  }, [layoutedEdges, setEdges]);

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target || !currentProjectId) return;
      const result = await addDependency(connection.source, connection.target, currentProjectId);
      if (!result.success) {
        alert(result.message);
      }
    },
    [addDependency, currentProjectId]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      selectTask(node.id);
      openInspector('details');
    },
    [selectTask, openInspector]
  );

  const handleRestoreAutoLayout = useCallback(() => {
    if (!currentProjectId) return;
    clearGraphManualPositions(currentProjectId);
    setGraphLayoutMode('auto');
  }, [clearGraphManualPositions, currentProjectId, setGraphLayoutMode]);

  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (!currentProjectId || graphLayoutMode !== 'edit') return;
      saveGraphNodePosition(currentProjectId, node.id, node.position);
    },
    [currentProjectId, graphLayoutMode, saveGraphNodePosition]
  );

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
          上→下：任务拆解 &nbsp;|&nbsp; 左→右：前后顺序 &nbsp;|&nbsp; 背景层：独立任务团
        </span>
        <div style={{ flex: 1 }} />
        <button
          className={`m3-chip${graphLayoutMode === 'edit' ? ' selected' : ''}`}
          onClick={() => setGraphLayoutMode(graphLayoutMode === 'edit' ? 'auto' : 'edit')}
        >
          编辑位置
        </button>
        <button className="m3-btn m3-btn-filled-tonal m3-btn-sm" onClick={handleRestoreAutoLayout}>
          恢复自动布局
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
        <TaskLayerBands bands={graphLayout.layerBands} />
        <ReactFlow
          nodes={nodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onNodeDragStop={handleNodeDragStop}
          onEdgesDelete={(deletedEdges) => {
            for (const edge of deletedEdges) {
              if (edge.data?.kind === 'dependency') removeDependency(edge.id);
            }
          }}
          nodeTypes={nodeTypes}
          nodesDraggable={graphLayoutMode === 'edit'}
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
  derived: Map<string, import('../../domain/models/task').DerivedTaskState>,
  positions: Map<string, { x: number; y: number; source: 'auto' | 'manual' }>
): Node[] {
  return tasks.map((task, i) => ({
    id: task.id,
    type: 'taskNode',
    position: positions.get(task.id) ?? { x: (i % 5) * 240 + 50, y: Math.floor(i / 5) * 140 + 50 },
    data: {
      task,
      derivedState: derived.get(task.id),
      layoutSource: positions.get(task.id)?.source ?? 'auto',
    },
  }));
}

function toReactFlowEdges(
  edges: DependencyEdge[],
  derived: Map<string, import('../../domain/models/task').DerivedTaskState>
): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.fromTaskId,
    target: edge.toTaskId,
    type: 'smoothstep',
    animated: derived.get(edge.toTaskId)?.unmetDependencyIds.includes(edge.fromTaskId) ?? false,
    className: derived.get(edge.toTaskId)?.unmetDependencyIds.includes(edge.fromTaskId)
      ? 'dependency-edge blocking-edge'
      : 'dependency-edge',
    markerEnd: { type: MarkerType.ArrowClosed },
    data: { kind: 'dependency' },
  }));
}

function toDecompositionEdges(tasks: Task[], visibleTaskIds: Set<string>): Edge[] {
  return tasks
    .filter((task) => task.parentId && visibleTaskIds.has(task.parentId))
    .map((task) => ({
      id: `decomposition:${task.parentId}:${task.id}`,
      source: task.parentId!,
      target: task.id,
      type: 'smoothstep',
      animated: false,
      selectable: false,
      focusable: false,
      deletable: false,
      className: 'decomposition-edge',
      data: { kind: 'decomposition' },
    }));
}

function TaskLayerBands({ bands }: { bands: GraphLayerBand[] }) {
  if (bands.length === 0) return null;

  return (
    <div className="task-layer-band-layer">
      {bands.map((band, i) => (
        <div
          className="task-layer-band"
          key={band.id}
          style={{
            left: band.x,
            top: band.y,
            width: band.width,
            height: band.height,
          }}
        >
          <div
            className="task-layer-band-surface"
            style={{ background: RANK_COLORS[i % RANK_COLORS.length] }}
          />
          <div className="task-layer-band-label">
            {band.label} · {band.taskIds.length} 个任务
          </div>
        </div>
      ))}
    </div>
  );
}
