import { useProjectStore } from '../../state/projectStore';
import { useTaskStore } from '../../state/taskStore';
import { useGraphStore } from '../../state/graphStore';
import { useUIStore } from '../../state/uiStore';

export default function ReadyQueueView() {
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const tasks = useTaskStore((s) => s.tasks);
  const readyTasks = useGraphStore((s) => s.readyTasks);
  const selectTask = useTaskStore((s) => s.selectTask);
  const openInspector = useUIStore((s) => s.openInspector);
  const updateTaskManualStatus = useTaskStore((s) => s.updateTaskManualStatus);

  if (!currentProjectId) {
    return (
      <div className="empty-state">
        <h3>No project selected</h3>
      </div>
    );
  }

  const getTaskPath = (taskId: string) => {
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

  const handleStart = (taskId: string) => {
    updateTaskManualStatus(taskId, 'in_progress');
  };

  const handleComplete = (taskId: string) => {
    updateTaskManualStatus(taskId, 'done');
  };

  const handleSelect = (taskId: string) => {
    selectTask(taskId);
    openInspector('details');
  };

  if (readyTasks.length === 0) {
    return (
      <div className="ready-queue">
        <div className="empty-state">
          <h3>Nothing ready to do</h3>
          <p>All tasks are either blocked, in progress, or completed. Check the Roadmap or Graph view.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ready-queue">
      <div className="toolbar">
        <span className="section-title">Ready Queue ({readyTasks.length})</span>
      </div>
      {readyTasks.map((task) => (
        <div
          key={task.id}
          className="ready-task-card"
          onClick={() => handleSelect(task.id)}
          style={{ cursor: 'pointer' }}
        >
          <span className={`priority-dot ${task.priority}`} />
          <div className="task-info">
            <div className="task-path">{getTaskPath(task.id)}</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{task.title || '(untitled)'}</div>
            {task.estimateMinutes && (
              <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 2 }}>
                ~{task.estimateMinutes} min
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                handleStart(task.id);
              }}
            >
              Start
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                handleComplete(task.id);
              }}
            >
              Done
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
