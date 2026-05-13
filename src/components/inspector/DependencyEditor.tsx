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
    return <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Select a task to edit dependencies.</div>;
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
      setError(result.message ?? 'Failed to add dependency');
    } else {
      setAddTarget('');
      setError('');
    }
  };

  const handleAddOutgoing = async () => {
    if (!addTarget || !currentProjectId) return;
    const result = await addDependency(task.id, addTarget, currentProjectId);
    if (!result.success) {
      setError(result.message ?? 'Failed to add dependency');
    } else {
      setAddTarget('');
      setError('');
    }
  };

  return (
    <div>
      <div className="form-group">
        <label>Prerequisites (blocks this task)</label>
        <ul className="dependency-list">
          {incoming.map((e) => {
            const from = tasks.find((t) => t.id === e.fromTaskId);
            return (
              <li key={e.id}>
                <span>{from?.title || e.fromTaskId}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => removeDependency(e.id)}>
                  Remove
                </button>
              </li>
            );
          })}
          {incoming.length === 0 && (
            <li style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>No prerequisites</li>
          )}
        </ul>
        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
          <select
            value={addTarget}
            onChange={(e) => setAddTarget(e.target.value)}
            style={{ flex: 1 }}
          >
            <option value="">Select task that must complete first...</option>
            {otherTasks.map((t) => (
              <option key={t.id} value={t.id}>{t.title || '(untitled)'}</option>
            ))}
          </select>
          <button className="btn btn-primary btn-sm" onClick={handleAddIncoming}>
            Add
          </button>
        </div>
      </div>

      <div className="form-group">
        <label>Blocks (depends on this task)</label>
        <ul className="dependency-list">
          {outgoing.map((e) => {
            const to = tasks.find((t) => t.id === e.toTaskId);
            return (
              <li key={e.id}>
                <span>{to?.title || e.toTaskId}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => removeDependency(e.id)}>
                  Remove
                </button>
              </li>
            );
          })}
          {outgoing.length === 0 && (
            <li style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>Doesn't block anything</li>
          )}
        </ul>
        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
          <select
            value={addTarget}
            onChange={(e) => setAddTarget(e.target.value)}
            style={{ flex: 1 }}
          >
            <option value="">Select task that depends on this...</option>
            {otherTasks.map((t) => (
              <option key={t.id} value={t.id}>{t.title || '(untitled)'}</option>
            ))}
          </select>
          <button className="btn btn-primary btn-sm" onClick={handleAddOutgoing}>
            Add
          </button>
        </div>
      </div>

      {error && <div className="blocked-reason">{error}</div>}
    </div>
  );
}
