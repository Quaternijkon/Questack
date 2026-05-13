import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Task, DerivedTaskState } from '../../domain/models/task';

interface TaskNodeData {
  task: Task;
  derivedState: DerivedTaskState | undefined;
}

export default memo(function TaskGraphNode({ data }: NodeProps) {
  const { task, derivedState } = data as unknown as TaskNodeData;
  const status = derivedState?.computedStatus ?? task.manualStatus;

  return (
    <div className={`task-node ${status}`}>
      <Handle type="target" position={Position.Top} />
      <div className="node-title">{task.title || '(untitled)'}</div>
      <div className="node-meta">
        <span className={`status-badge ${status}`}>{status}</span>
        <span className={`priority-dot ${task.priority}`} />
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
});
