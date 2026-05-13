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
    return <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>选择一个任务以查看详情。</div>;
  }

  const handleChange = (field: string, value: string) => {
    updateTask(task.id, { [field]: value });
  };

  return (
    <div>
      <div className="m3-form-field">
        <label className="m3-form-label">标题</label>
        <input
          value={task.title}
          onChange={(e) => handleChange('title', e.target.value)}
          placeholder="任务标题"
        />
      </div>

      <div className="m3-form-field">
        <label className="m3-form-label">描述</label>
        <textarea
          value={task.description ?? ''}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="描述此任务..."
        />
      </div>

      <div className="m3-form-field">
        <label className="m3-form-label">状态</label>
        <select
          value={task.manualStatus}
          onChange={(e) => updateTaskManualStatus(task.id, e.target.value as ManualTaskStatus)}
        >
          <option value="todo">待办</option>
          <option value="in_progress">进行中</option>
          <option value="done">已完成</option>
          <option value="canceled">已取消</option>
        </select>
      </div>

      <div className="m3-form-field">
        <label className="m3-form-label">优先级</label>
        <select
          value={task.priority}
          onChange={(e) => handleChange('priority', e.target.value as Priority)}
        >
          <option value="low">低</option>
          <option value="medium">中</option>
          <option value="high">高</option>
          <option value="critical">紧急</option>
        </select>
      </div>

      <div className="m3-form-field">
        <label className="m3-form-label">预计耗时（分钟）</label>
        <input
          type="number"
          value={task.estimateMinutes ?? ''}
          onChange={(e) => {
            const val = e.target.value ? parseInt(e.target.value) : null;
            updateTask(task.id, { estimateMinutes: val as number | null });
          }}
          placeholder="如 30"
        />
      </div>

      {derived && (
        <>
          <div className="m3-form-field">
            <label className="m3-form-label">计算状态</label>
            <div className="m3-form-helper">
              <span className={`status-badge ${derived.computedStatus}`}>{derived.computedStatus}</span>
            </div>
          </div>
          {derived.rollupStatus && (
            <div className="m3-form-field">
              <label className="m3-form-label">聚合状态</label>
              <div className="m3-form-helper">
                <span className={`status-badge ${derived.rollupStatus}`}>{derived.rollupStatus}</span>
              </div>
            </div>
          )}
          <div className="m3-form-field">
            <label className="m3-form-label">路径</label>
            <div className="m3-form-helper">
              {derived.path.length > 0
                ? tasks.filter((t) => derived.path.includes(t.id)).map((t) => t.title).join(' > ')
                : '（根任务）'}
            </div>
          </div>
          {derived.unmetDependencyIds.length > 0 && (
            <div className="roadmap-item-blocked-by">
              被阻塞：{derived.unmetDependencyIds.map((id) => {
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
