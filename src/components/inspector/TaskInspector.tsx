import { useTaskStore } from '../../state/taskStore';
import type { ManualTaskStatus, Priority } from '../../domain/models/task';

export default function TaskInspector() {
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);
  const tasks = useTaskStore((s) => s.tasks);
  const derivedStates = useTaskStore((s) => s.derivedStates);
  const updateTask = useTaskStore((s) => s.updateTask);
  const updateTaskManualStatus = useTaskStore((s) => s.updateTaskManualStatus);

  const task = tasks.find((t) => t.id === selectedTaskId);
  const derived = selectedTaskId ? derivedStates.get(selectedTaskId) : undefined;

  if (!task) {
    return <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Select a task to inspect.</div>;
  }

  const handleChange = (field: string, value: string) => {
    updateTask(task.id, { [field]: value });
  };

  return (
    <div>
      <div className="m3-form-field">
        <label className="m3-form-label">Title</label>
        <input
          value={task.title}
          onChange={(e) => handleChange('title', e.target.value)}
          placeholder="Task title"
        />
      </div>

      <div className="m3-form-field">
        <label className="m3-form-label">Description</label>
        <textarea
          value={task.description ?? ''}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Describe this task..."
        />
      </div>

      <div className="m3-form-field">
        <label className="m3-form-label">Status</label>
        <select
          value={task.manualStatus}
          onChange={(e) => updateTaskManualStatus(task.id, e.target.value as ManualTaskStatus)}
        >
          <option value="todo">Todo</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
          <option value="canceled">Canceled</option>
        </select>
      </div>

      <div className="m3-form-field">
        <label className="m3-form-label">Priority</label>
        <select
          value={task.priority}
          onChange={(e) => handleChange('priority', e.target.value as Priority)}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      <div className="m3-form-field">
        <label className="m3-form-label">Estimated Minutes</label>
        <input
          type="number"
          value={task.estimateMinutes ?? ''}
          onChange={(e) => {
            const val = e.target.value ? parseInt(e.target.value) : null;
            updateTask(task.id, { estimateMinutes: val as number | null });
          }}
          placeholder="e.g. 30"
        />
      </div>

      {derived && (
        <>
          <div className="m3-form-field">
            <label className="m3-form-label">Computed Status</label>
            <div className="m3-form-helper">
              <span className={`status-badge ${derived.computedStatus}`}>{derived.computedStatus}</span>
            </div>
          </div>
          {derived.rollupStatus && (
            <div className="m3-form-field">
              <label className="m3-form-label">Rollup Status</label>
              <div className="m3-form-helper">
                <span className={`status-badge ${derived.rollupStatus}`}>{derived.rollupStatus}</span>
              </div>
            </div>
          )}
          <div className="m3-form-field">
            <label className="m3-form-label">Path</label>
            <div className="m3-form-helper">
              {derived.path.length > 0
                ? tasks.filter((t) => derived.path.includes(t.id)).map((t) => t.title).join(' > ')
                : '(root)'}
            </div>
          </div>
          {derived.unmetDependencyIds.length > 0 && (
            <div className="roadmap-item-blocked-by">
              Blocked by: {derived.unmetDependencyIds.map((id) => {
                const t = tasks.find((t) => t.id === id);
                return t?.title || id;
              }).join(', ')}
            </div>
          )}
        </>
      )}
    </div>
  );
}
