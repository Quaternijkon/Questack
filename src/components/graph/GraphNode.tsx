import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Task, DerivedTaskState } from '../../domain/models/task';

interface TaskNodeData {
  task: Task;
  derivedState: DerivedTaskState | undefined;
  layoutSource?: 'auto' | 'manual';
}

export default memo(function TaskGraphNode({ data }: NodeProps) {
  const { task, derivedState, layoutSource } = data as unknown as TaskNodeData;
  const isContainer = derivedState != null && !derivedState.isLeaf;
  const status = isContainer && derivedState.rollupStatus
    ? derivedState.rollupStatus
    : derivedState?.computedStatus ?? task.manualStatus;

  return (
    <div className={`task-node status-${status}${isContainer ? ' task-node-container' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="node-header">
        <span className={`priority-indicator priority-${task.priority}`} />
        <span className="node-title">{task.title || '（未命名）'}</span>
        <span className={`status-badge status-${status}`}>{status}</span>
      </div>
      <div className="node-body">
        {isContainer && (
          <span className="node-estimate">
            {derivedState.completedDescendantCount}/{derivedState.descendantCount} 子任务
          </span>
        )}
        {task.estimateMinutes != null && (
          <span className="node-estimate">{task.estimateMinutes} 分钟</span>
        )}
        {layoutSource === 'manual' && (
          <span className="node-layout-source">手动</span>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
});
