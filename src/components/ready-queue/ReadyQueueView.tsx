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
        <div className="queue-empty">
          <span className="queue-empty-icon">check_circle</span>
          <h3>Nothing ready to do</h3>
          <p>All tasks are either blocked, in progress, or completed. Check the Roadmap or Graph view.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ready-queue">
      <div className="queue-header">
        <span className="toolbar-title">Ready Queue ({readyTasks.length})</span>
      </div>
      {readyTasks.map((task) => (
        <div
          key={task.id}
          className="queue-card"
          onClick={() => handleSelect(task.id)}
          style={{ cursor: 'pointer' }}
        >
          <span className={`priority-indicator priority-${task.priority}`} />
          <div className="queue-card-main">
            <div className="queue-card-path">{getTaskPath(task.id)}</div>
            <div className="queue-card-title">{task.title || '(untitled)'}</div>
            {task.estimateMinutes && (
              <div className="queue-card-meta">
                ~{task.estimateMinutes} min
              </div>
            )}
          </div>
          <div className="queue-card-actions">
            <button
              className="m3-btn-filled-tonal m3-btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                handleStart(task.id);
              }}
            >
              Start
            </button>
            <button
              className="m3-btn-outlined m3-btn-sm"
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
