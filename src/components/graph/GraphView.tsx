import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ViewportPortal,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Connection,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Ban,
  CheckCircle2,
  Circle,
  CircleDot,
  GitBranch,
  Layers3,
  Move,
  PlayCircle,
  RotateCcw,
  Workflow,
} from 'lucide-react';
import { useProjectStore } from '../../state/projectStore';
import { useTaskStore } from '../../state/taskStore';
import { useGraphStore } from '../../state/graphStore';
import { useUIStore, type UIStoreState } from '../../state/uiStore';
import TaskGraphNode from './GraphNode';
import { layoutTaskGraph, type GraphLayerBand } from './layoutGraph';
import { buildTaskGroups, type TaskGroup } from '../../domain/services/taskGroupService';
import { buildTaskMapRegions, type TaskMapRegion } from '../../domain/services/taskMapService';
import type { Task, DerivedTaskState, ManualTaskStatus, RollupStatus } from '../../domain/models/task';
import type { DependencyEdge } from '../../domain/models/dependency';

const nodeTypes = { taskNode: TaskGraphNode };

type DisplayStatus = 'todo' | 'ready' | 'blocked' | 'in_progress' | 'done' | 'canceled';

const GROUP_COLORS = [
  'rgba(66,133,244,0.07)',
  'rgba(52,168,83,0.07)',
  'rgba(251,188,4,0.08)',
  'rgba(234,67,53,0.065)',
];

const statusOptions: Array<{
  key: UIStoreState['graphFilter'];
  label: string;
  icon: typeof Circle;
}> = [
  { key: 'all', label: '全部', icon: Layers3 },
  { key: 'ready', label: '就绪', icon: CircleDot },
  { key: 'blocked', label: '阻塞', icon: Ban },
  { key: 'in_progress', label: '进行中', icon: PlayCircle },
  { key: 'done', label: '完成', icon: CheckCircle2 },
  { key: 'todo', label: '待办', icon: Circle },
  { key: 'canceled', label: '取消', icon: RotateCcw },
];

export default function GraphView() {
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const tasks = useTaskStore((s) => s.tasks);
  const derivedStates = useTaskStore((s) => s.derivedStates);
  const updateTaskManualStatus = useTaskStore((s) => s.updateTaskManualStatus);
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
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const activeTasks = useMemo(
    () => tasks.filter((task) => task.archivedAt == null),
    [tasks]
  );

  const taskGroups = useMemo(
    () => buildTaskGroups(activeTasks, edges),
    [activeTasks, edges]
  );

  const selectedGroup = useMemo(
    () => taskGroups.find((group) => group.id === selectedGroupId) ?? taskGroups[0],
    [selectedGroupId, taskGroups]
  );

  const selectedGroupTaskIds = useMemo(
    () => new Set(selectedGroup?.taskIds ?? []),
    [selectedGroup]
  );

  const groupTasks = useMemo(
    () => activeTasks.filter((task) => selectedGroupTaskIds.has(task.id)),
    [activeTasks, selectedGroupTaskIds]
  );

  const groupEdges = useMemo(
    () => edges.filter((edge) => selectedGroupTaskIds.has(edge.fromTaskId) && selectedGroupTaskIds.has(edge.toTaskId)),
    [edges, selectedGroupTaskIds]
  );

  const groupStatusCounts = useMemo(
    () => countStatuses(groupTasks, derivedStates),
    [groupTasks, derivedStates]
  );

  const visibleTasks = useMemo(() => {
    if (graphFilter === 'all') return groupTasks;
    return groupTasks.filter((task) => getDisplayStatus(task, derivedStates.get(task.id)) === graphFilter);
  }, [groupTasks, derivedStates, graphFilter]);

  const visibleTaskIds = useMemo(() => new Set(visibleTasks.map((task) => task.id)), [visibleTasks]);

  const taskMapRegions = useMemo(
    () => buildTaskMapRegions(visibleTasks),
    [visibleTasks]
  );

  const visibleEdges = useMemo(
    () => groupEdges.filter((edge) => visibleTaskIds.has(edge.fromTaskId) && visibleTaskIds.has(edge.toTaskId)),
    [groupEdges, visibleTaskIds]
  );

  const handleNodeStatusChange = useCallback(
    async (taskId: string, status: ManualTaskStatus) => {
      await updateTaskManualStatus(taskId, status);
    },
    [updateTaskManualStatus]
  );

  const graphLayout = useMemo(() => {
    const manualPositions = currentProjectId && graphLayoutMode === 'edit'
      ? graphManualPositions[currentProjectId] ?? {}
      : {};
    return layoutTaskGraph(visibleTasks, visibleEdges, {
      manualPositions,
      groupId: selectedGroup?.id,
      groupLabel: selectedGroup?.label,
    });
  }, [visibleTasks, visibleEdges, currentProjectId, graphLayoutMode, graphManualPositions, selectedGroup]);

  const layoutedNodes = useMemo(() => {
    return toReactFlowNodes(visibleTasks, derivedStates, graphLayout.positions, handleNodeStatusChange);
  }, [visibleTasks, derivedStates, graphLayout.positions, handleNodeStatusChange]);

  const layoutedEdges = useMemo(() => {
    return [
      ...toDecompositionEdges(visibleTasks, visibleTaskIds),
      ...toReactFlowEdges(visibleEdges, derivedStates),
    ];
  }, [visibleTasks, visibleTaskIds, visibleEdges, derivedStates]);

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

  if (!currentProjectId) {
    return (
      <div className="empty-state">
        <h3>未选择项目</h3>
      </div>
    );
  }

  if (!selectedGroup) {
    return (
      <div className="graph-container">
        <div className="empty-state">
          <h3>暂无任务团</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="graph-container">
      <GraphCommandBar
        taskGroups={taskGroups}
        selectedGroup={selectedGroup}
        selectedGroupId={selectedGroup.id}
        onSelectGroup={setSelectedGroupId}
        graphLayoutMode={graphLayoutMode}
        onToggleLayoutMode={() => setGraphLayoutMode(graphLayoutMode === 'edit' ? 'auto' : 'edit')}
        onRestoreAutoLayout={handleRestoreAutoLayout}
        statusCounts={groupStatusCounts}
        graphFilter={graphFilter}
        onFilterChange={setGraphFilter}
      />

      <div className="graph-canvas-shell">
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
          fitViewOptions={{ padding: 0.22 }}
          deleteKeyCode={['Backspace', 'Delete']}
          multiSelectionKeyCode="Shift"
          defaultEdgeOptions={{ type: 'smoothstep', animated: false }}
          minZoom={0.1}
          maxZoom={2}
        >
          <ViewportPortal>
            <TaskLayerBands bands={graphLayout.layerBands} />
            <TaskMapRegions
              regions={taskMapRegions}
              positions={graphLayout.positions}
              tasks={visibleTasks}
            />
          </ViewportPortal>
          <Background />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              const task = groupTasks.find((candidate) => candidate.id === node.id);
              return statusColor(task ? getDisplayStatus(task, derivedStates.get(node.id)) : 'todo');
            }}
            maskColor="rgba(15,23,42,0.36)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}

function GraphCommandBar({
  taskGroups,
  selectedGroup,
  selectedGroupId,
  onSelectGroup,
  graphLayoutMode,
  onToggleLayoutMode,
  onRestoreAutoLayout,
  statusCounts,
  graphFilter,
  onFilterChange,
}: {
  taskGroups: TaskGroup[];
  selectedGroup: TaskGroup;
  selectedGroupId: string;
  onSelectGroup: (groupId: string) => void;
  graphLayoutMode: 'auto' | 'edit';
  onToggleLayoutMode: () => void;
  onRestoreAutoLayout: () => void;
  statusCounts: Record<DisplayStatus, number>;
  graphFilter: UIStoreState['graphFilter'];
  onFilterChange: (filter: UIStoreState['graphFilter']) => void;
}) {
  return (
    <div className="graph-command-bar">
      <div className="graph-command-row">
        <div className="graph-group-heading">
          <Workflow size={18} />
          <div>
            <div className="graph-group-title">{selectedGroup.label}</div>
            <div className="graph-group-meta">
              {selectedGroup.kind === 'interdependent' ? '互依任务团' : '独立任务团'} · {selectedGroup.taskIds.length} 个任务 · {selectedGroup.dependencyEdgeIds.length} 条依赖
            </div>
          </div>
        </div>
        <div className="graph-command-actions">
          <button
            className={`m3-chip graph-mode-chip${graphLayoutMode === 'edit' ? ' selected' : ''}`}
            onClick={onToggleLayoutMode}
            type="button"
          >
            <Move size={14} />
            {graphLayoutMode === 'edit' ? '编辑位置' : '自动布局'}
          </button>
          <button className="m3-btn m3-btn-filled-tonal m3-btn-sm" onClick={onRestoreAutoLayout} type="button">
            <RotateCcw size={14} />
            恢复布局
          </button>
        </div>
      </div>

      <div className="graph-task-group-strip">
        {taskGroups.map((group, index) => (
          <button
            key={group.id}
            className={`task-group-tab${group.id === selectedGroupId ? ' selected' : ''}`}
            onClick={() => onSelectGroup(group.id)}
            type="button"
          >
            <GitBranch size={14} />
            <span className="task-group-tab-title">{group.label}</span>
            <span className={`task-group-kind ${group.kind}`}>{group.kind === 'interdependent' ? '互依' : '独立'}</span>
            <span className="task-group-index">{index + 1}</span>
          </button>
        ))}
      </div>

      <div className="graph-status-strip">
        {statusOptions.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`status-filter-chip status-${key}${graphFilter === key ? ' selected' : ''}`}
            onClick={() => onFilterChange(key)}
            type="button"
          >
            <Icon size={13} />
            <span>{label}</span>
            <strong>{key === 'all' ? sumStatusCounts(statusCounts) : statusCounts[key as DisplayStatus] ?? 0}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

function toReactFlowNodes(
  tasks: Task[],
  derived: Map<string, DerivedTaskState>,
  positions: Map<string, { x: number; y: number; source: 'auto' | 'manual' }>,
  onSetStatus: (taskId: string, status: ManualTaskStatus) => void
): Node[] {
  return tasks.map((task, index) => {
    const derivedState = derived.get(task.id);
    return {
      id: task.id,
      type: 'taskNode',
      position: positions.get(task.id) ?? { x: (index % 5) * 240 + 50, y: Math.floor(index / 5) * 140 + 50 },
      data: {
        task,
        derivedState,
        status: getDisplayStatus(task, derivedState),
        layoutSource: positions.get(task.id)?.source ?? 'auto',
        onSetStatus,
      },
    };
  });
}

function toReactFlowEdges(
  edges: DependencyEdge[],
  derived: Map<string, DerivedTaskState>
): Edge[] {
  return edges.map((edge) => {
    const isBlocking = derived.get(edge.toTaskId)?.unmetDependencyIds.includes(edge.fromTaskId) ?? false;
    return {
      id: edge.id,
      source: edge.fromTaskId,
      target: edge.toTaskId,
      type: 'smoothstep',
      animated: isBlocking,
      label: isBlocking ? '阻塞' : undefined,
      className: isBlocking
        ? 'dependency-edge blocking-edge'
        : 'dependency-edge',
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { kind: 'dependency' },
    };
  });
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
      label: undefined,
      className: 'decomposition-edge',
      data: { kind: 'decomposition' },
    }));
}

function TaskMapRegions({
  regions,
  positions,
  tasks,
}: {
  regions: TaskMapRegion[];
  positions: Map<string, { x: number; y: number; source?: 'auto' | 'manual' }>;
  tasks: Task[];
}) {
  if (regions.length === 0) return null;

  const taskById = new Map(tasks.map((task) => [task.id, task]));

  return (
    <div className="task-map-region-layer">
      {regions.map((region) => {
        const bounds = getRegionBounds(region.descendantTaskIds, positions);
        if (!bounds) return null;
        const task = taskById.get(region.taskId);

        return (
          <div
            className={`task-map-region depth-${Math.min(region.depth, 4)}`}
            key={region.taskId}
            style={{
              left: bounds.x - 28,
              top: bounds.y - 44,
              width: bounds.width + 56,
              height: bounds.height + 80,
            }}
          >
            <div className="task-map-region-title">
              {task?.title || '未命名任务集'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getRegionBounds(
  taskIds: string[],
  positions: Map<string, { x: number; y: number; source?: 'auto' | 'manual' }>
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

function TaskLayerBands({ bands }: { bands: GraphLayerBand[] }) {
  if (bands.length === 0) return null;

  return (
    <div className="task-layer-band-layer">
      {bands.map((band, index) => (
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
            style={{ background: GROUP_COLORS[index % GROUP_COLORS.length] }}
          />
          <div className="task-layer-band-label">
            {band.label} · {band.taskIds.length} 个任务
          </div>
        </div>
      ))}
    </div>
  );
}

function getDisplayStatus(task: Task, derivedState: DerivedTaskState | undefined): DisplayStatus {
  const isContainer = derivedState != null && !derivedState.isLeaf;
  const rawStatus: RollupStatus | DerivedTaskState['computedStatus'] | Task['manualStatus'] =
    isContainer && derivedState.rollupStatus
      ? derivedState.rollupStatus
      : derivedState?.computedStatus ?? task.manualStatus;

  if (rawStatus === 'active') return 'in_progress';
  return rawStatus;
}

function countStatuses(tasks: Task[], derivedStates: Map<string, DerivedTaskState>): Record<DisplayStatus, number> {
  const counts: Record<DisplayStatus, number> = {
    todo: 0,
    ready: 0,
    blocked: 0,
    in_progress: 0,
    done: 0,
    canceled: 0,
  };

  for (const task of tasks) {
    counts[getDisplayStatus(task, derivedStates.get(task.id))] += 1;
  }

  return counts;
}

function sumStatusCounts(counts: Record<DisplayStatus, number>) {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

function statusColor(status: DisplayStatus) {
  switch (status) {
    case 'ready':
      return 'var(--google-green)';
    case 'blocked':
      return 'var(--google-red)';
    case 'in_progress':
      return 'var(--google-blue)';
    case 'done':
      return 'var(--google-green)';
    case 'canceled':
      return 'var(--md-outline)';
    case 'todo':
    default:
      return 'var(--google-yellow)';
  }
}
