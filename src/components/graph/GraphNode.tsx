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
    <div className={`task-node status-${status}`}>
      <Handle type="target" position={Position.Left} />
      <div className="node-header">
        <span className={`priority-indicator priority-${task.priority}`} />
        <span className="node-title">{task.title || '（未命名）'}</span>
        <span className={`status-badge status-${status}`}>{status}</span>
      </div>
      <div className="node-body">
        {task.estimateMinutes != null && (
          <span className="node-estimate">{task.estimateMinutes} 分钟</span>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
});
