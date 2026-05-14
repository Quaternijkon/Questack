import { useState } from 'react';
import { useProjectStore } from '../../state/projectStore';
import { useTaskStore } from '../../state/taskStore';
import { useGraphStore } from '../../state/graphStore';
import { getDependencyCandidates } from '../../domain/services/dependencySuggestionService';

export default function DependencyEditor() {
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);
  const tasks = useTaskStore((s) => s.tasks);
  const edges = useGraphStore((s) => s.edges);
  const addDependency = useGraphStore((s) => s.addDependency);
  const removeDependency = useGraphStore((s) => s.removeDependency);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);

  const task = tasks.find((t) => t.id === selectedTaskId);
  const [incomingTarget, setIncomingTarget] = useState('');
  const [outgoingTarget, setOutgoingTarget] = useState('');
  const [error, setError] = useState('');

  if (!task) {
    return <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>选择一个任务以编辑依赖。</div>;
  }

  const incoming = edges.filter((e) => e.toTaskId === task.id);
  const outgoing = edges.filter((e) => e.fromTaskId === task.id);
  const taskById = new Map(tasks.map((candidate) => [candidate.id, candidate]));

  const incomingCandidates = getDependencyCandidates({
    sourceTaskId: task.id,
    direction: 'incoming',
    tasks,
    edges,
  });
  const outgoingCandidates = getDependencyCandidates({
    sourceTaskId: task.id,
    direction: 'outgoing',
    tasks,
    edges,
  });

  const handleAddIncoming = async () => {
    if (!incomingTarget || !currentProjectId) return;
    const result = await addDependency(incomingTarget, task.id, currentProjectId);
    if (!result.success) {
      setError(result.message ?? '添加依赖失败');
    } else {
      setIncomingTarget('');
      setError('');
    }
  };

  const handleAddOutgoing = async () => {
    if (!outgoingTarget || !currentProjectId) return;
    const result = await addDependency(task.id, outgoingTarget, currentProjectId);
    if (!result.success) {
      setError(result.message ?? '添加依赖失败');
    } else {
      setOutgoingTarget('');
      setError('');
    }
  };

  const taskTitle = (taskId: string) => taskById.get(taskId)?.title || '（未命名）';

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
                <button className="m3-btn-text m3-btn-sm" onClick={() => removeDependency(e.id)} type="button">
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
          <label className="m3-form-label sr-only" htmlFor="incoming-dependency-select">
            添加前置任务
          </label>
          <select
            id="incoming-dependency-select"
            value={incomingTarget}
            onChange={(e) => setIncomingTarget(e.target.value)}
            style={{ flex: 1 }}
          >
            <option value="">选择必须首先完成的任务...</option>
            {incomingCandidates.map((candidate) => (
              <option key={candidate.taskId} value={candidate.taskId}>{taskTitle(candidate.taskId)}</option>
            ))}
          </select>
          <button
            className="m3-btn-filled-tonal m3-btn-sm"
            disabled={!incomingTarget || !currentProjectId}
            onClick={handleAddIncoming}
            type="button"
          >
            添加为前置
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
                <button className="m3-btn-text m3-btn-sm" onClick={() => removeDependency(e.id)} type="button">
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
          <label className="m3-form-label sr-only" htmlFor="outgoing-dependency-select">
            添加后续任务
          </label>
          <select
            id="outgoing-dependency-select"
            value={outgoingTarget}
            onChange={(e) => setOutgoingTarget(e.target.value)}
            style={{ flex: 1 }}
          >
            <option value="">选择依赖于此任务的任务...</option>
            {outgoingCandidates.map((candidate) => (
              <option key={candidate.taskId} value={candidate.taskId}>{taskTitle(candidate.taskId)}</option>
            ))}
          </select>
          <button
            className="m3-btn-filled-tonal m3-btn-sm"
            disabled={!outgoingTarget || !currentProjectId}
            onClick={handleAddOutgoing}
            type="button"
          >
            添加为后续
          </button>
        </div>
      </div>

      {error && <div className="notice-warning">{error}</div>}
    </div>
  );
}
