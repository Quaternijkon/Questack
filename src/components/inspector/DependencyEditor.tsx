import { useState } from 'react';
import { useProjectStore } from '../../state/projectStore';
import { useTaskStore } from '../../state/taskStore';
import { useGraphStore } from '../../state/graphStore';

export default function DependencyEditor() {
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);
  const tasks = useTaskStore((s) => s.tasks);
  const edges = useGraphStore((s) => s.edges);
  const addDependency = useGraphStore((s) => s.addDependency);
  const removeDependency = useGraphStore((s) => s.removeDependency);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);

  const task = tasks.find((t) => t.id === selectedTaskId);
  const [addTarget, setAddTarget] = useState('');
  const [error, setError] = useState('');

  if (!task) {
    return <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>选择一个任务以编辑依赖。</div>;
  }

  const incoming = edges.filter((e) => e.toTaskId === task.id);
  const outgoing = edges.filter((e) => e.fromTaskId === task.id);

  const otherTasks = tasks.filter(
    (t) => t.id !== task.id && t.projectId === task.projectId && t.archivedAt == null
  );

  const handleAddIncoming = async () => {
    if (!addTarget || !currentProjectId) return;
    const result = await addDependency(addTarget, task.id, currentProjectId);
    if (!result.success) {
      setError(result.message ?? '添加依赖失败');
    } else {
      setAddTarget('');
      setError('');
    }
  };

  const handleAddOutgoing = async () => {
    if (!addTarget || !currentProjectId) return;
    const result = await addDependency(task.id, addTarget, currentProjectId);
    if (!result.success) {
      setError(result.message ?? '添加依赖失败');
    } else {
      setAddTarget('');
      setError('');
    }
  };

  return (
    <div>
      <div className="m3-form-field">
        <label className="m3-form-label">前置任务（阻塞此任务）</label>
        <ul className="dep-list">
          {incoming.map((e) => {
            const from = tasks.find((t) => t.id === e.fromTaskId);
            return (
              <li className="dep-list-item" key={e.id}>
                <span>{from?.title || e.fromTaskId}</span>
                <button className="m3-btn-text m3-btn-sm" onClick={() => removeDependency(e.id)}>
                  移除
                </button>
              </li>
            );
          })}
          {incoming.length === 0 && (
              <li className="dep-list-empty">无前置任务</li>
          )}
        </ul>
        <div className="dep-add-row">
          <select
            value={addTarget}
            onChange={(e) => setAddTarget(e.target.value)}
            style={{ flex: 1 }}
          >
            <option value="">选择必须首先完成的任务...</option>
            {otherTasks.map((t) => (
              <option key={t.id} value={t.id}>{t.title || '（未命名）'}</option>
            ))}
          </select>
          <button className="m3-btn-filled-tonal m3-btn-sm" onClick={handleAddIncoming}>
            添加
          </button>
        </div>
      </div>

      <div className="m3-form-field">
        <label className="m3-form-label">阻塞的任务（依赖于此任务）</label>
        <ul className="dep-list">
          {outgoing.map((e) => {
            const to = tasks.find((t) => t.id === e.toTaskId);
            return (
              <li className="dep-list-item" key={e.id}>
                <span>{to?.title || e.toTaskId}</span>
                <button className="m3-btn-text m3-btn-sm" onClick={() => removeDependency(e.id)}>
                  移除
                </button>
              </li>
            );
          })}
          {outgoing.length === 0 && (
              <li className="dep-list-empty">不阻塞任何任务</li>
          )}
        </ul>
        <div className="dep-add-row">
          <select
            value={addTarget}
            onChange={(e) => setAddTarget(e.target.value)}
            style={{ flex: 1 }}
          >
            <option value="">选择依赖于此任务的任务...</option>
            {otherTasks.map((t) => (
              <option key={t.id} value={t.id}>{t.title || '（未命名）'}</option>
            ))}
          </select>
          <button className="m3-btn-filled-tonal m3-btn-sm" onClick={handleAddOutgoing}>
            添加
          </button>
        </div>
      </div>

      {error && <div className="notice-warning">{error}</div>}
    </div>
  );
}
