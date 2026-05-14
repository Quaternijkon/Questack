import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Check, Play, RotateCcw } from 'lucide-react';
import type { Task, DerivedTaskState, ManualTaskStatus } from '../../domain/models/task';

type DisplayStatus = 'todo' | 'ready' | 'blocked' | 'in_progress' | 'done' | 'canceled';

interface TaskNodeData {
  task: Task;
  derivedState: DerivedTaskState | undefined;
  status: DisplayStatus;
  layoutSource?: 'auto' | 'manual';
  onSetStatus?: (taskId: string, status: ManualTaskStatus) => void;
}

const statusLabels: Record<DisplayStatus, string> = {
  todo: '待办',
  ready: '就绪',
  blocked: '阻塞',
  in_progress: '进行中',
  done: '完成',
  canceled: '取消',
};

export default memo(function TaskGraphNode({ data }: NodeProps) {
  const { task, derivedState, status, layoutSource, onSetStatus } = data as unknown as TaskNodeData;
  const isContainer = derivedState != null && !derivedState.isLeaf;
  const unmetCount = derivedState?.unmetDependencyIds.length ?? 0;

  const setStatus = (nextStatus: ManualTaskStatus) => (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onSetStatus?.(task.id, nextStatus);
  };

  return (
    <div className={`task-node status-${status}${isContainer ? ' task-node-container' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="node-header">
        <span className={`priority-indicator priority-${task.priority}`} />
        <span className="node-title">{task.title || '(Untitled)'}</span>
        <span className={`status-badge status-${status}`}>{statusLabels[status]}</span>
      </div>
      <div className="node-body">
        {isContainer && derivedState && (
          <span className="node-estimate">
            {derivedState.completedDescendantCount}/{derivedState.descendantCount} 子任务
          </span>
        )}
        {!isContainer && unmetCount > 0 && (
          <span className="node-blocker-count">{unmetCount} 个阻塞</span>
        )}
        {task.estimateMinutes != null && (
          <span className="node-estimate">{task.estimateMinutes} 分钟</span>
        )}
        {layoutSource === 'manual' && (
          <span className="node-layout-source">手动</span>
        )}
      </div>
      <div className="node-actions nodrag nopan">
        {task.manualStatus !== 'in_progress' && task.manualStatus !== 'done' && (
          <button className="node-action-btn" onClick={setStatus('in_progress')} type="button" title="标记为进行中">
            <Play size={12} />
          </button>
        )}
        {task.manualStatus !== 'done' && (
          <button className="node-action-btn" onClick={setStatus('done')} type="button" title="标记为完成">
            <Check size={13} />
          </button>
        )}
        {task.manualStatus !== 'todo' && (
          <button className="node-action-btn" onClick={setStatus('todo')} type="button" title="重新打开">
            <RotateCcw size={12} />
          </button>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
});
