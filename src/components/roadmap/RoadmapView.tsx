import { useMemo } from 'react';
import { useProjectStore } from '../../state/projectStore';
import { useTaskStore } from '../../state/taskStore';
import { useGraphStore } from '../../state/graphStore';
import { useUIStore } from '../../state/uiStore';

export default function RoadmapView() {
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const tasks = useTaskStore((s) => s.tasks);
  const derivedStates = useTaskStore((s) => s.derivedStates);
  const topologicalOrder = useGraphStore((s) => s.topologicalOrder);
  const blockedReasons = useGraphStore((s) => s.blockedReasons);
  const selectTask = useTaskStore((s) => s.selectTask);
  const openInspector = useUIStore((s) => s.openInspector);
  const updateTaskManualStatus = useTaskStore((s) => s.updateTaskManualStatus);

  const orderedTasks = useMemo(() => {
    if (topologicalOrder.length === 0) return tasks.filter((t) => t.archivedAt == null);
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    return topologicalOrder.map((id) => taskMap.get(id)).filter((t): t is NonNullable<typeof t> => t != null && t.archivedAt == null);
  }, [tasks, topologicalOrder]);

  if (!currentProjectId) {
    return (
      <div className="empty-state">
        <h3>No project selected</h3>
      </div>
    );
  }

  if (orderedTasks.length === 0) {
    return (
      <div className="roadmap-view">
        <div className="empty-state">
          <h3>No tasks to show</h3>
          <p>Add tasks in the Tree view first.</p>
        </div>
      </div>
    );
  }

  const getPath = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return '';
    const parts: string[] = [];
    let current: typeof task | undefined = task;
    while (current) {
      parts.unshift(current.title || '(untitled)');
      current = tasks.find((t) => t.id === current!.parentId);
    }
    return parts.join(' > ');
  };

  const handleSelect = (taskId: string) => {
    selectTask(taskId);
    openInspector('details');
  };

  const handleComplete = (taskId: string) => {
    updateTaskManualStatus(taskId, 'done');
  };

  const blockedReasonMap = new Map(blockedReasons.map((b) => [b.taskId, b]));

  return (
    <div className="roadmap-view">
      <div className="toolbar">
        <span className="section-title">Roadmap ({orderedTasks.length} tasks)</span>
      </div>
      {orderedTasks.map((task) => {
        const derived = derivedStates.get(task.id);
        const status = derived?.computedStatus ?? task.manualStatus;
        const reason = blockedReasonMap.get(task.id);

        return (
          <div
            key={task.id}
            className={`roadmap-item ${status}`}
            onClick={() => handleSelect(task.id)}
            style={{ cursor: 'pointer' }}
          >
            <span className={`priority-dot ${task.priority}`} />
            <div className="task-info">
              <div className="task-path">{getPath(task.id)}</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{task.title || '(untitled)'}</div>
              {reason && (
                <div className="blocked-reason" style={{ marginTop: 4 }}>
                  Blocked by: {reason.unmetPrerequisites.map((p) => p.title || p.id).join(', ')}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <span className={`status-badge ${status}`}>{status}</span>
              {status === 'ready' && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleComplete(task.id);
                  }}
                >
                  Done
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
