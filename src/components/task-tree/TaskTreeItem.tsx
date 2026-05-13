import { useTaskStore } from '../../state/taskStore';
import { useUIStore } from '../../state/uiStore';

interface TaskTreeItemProps {
  task: import('../../domain/models/task').Task;
  depth: number;
  onSelect: (taskId: string) => void;
  onContextMenu: (e: React.MouseEvent, taskId: string) => void;
  selectedTaskId: string | null;
}

export default function TaskTreeItem({
  task,
  depth,
  onSelect,
  onContextMenu,
  selectedTaskId,
}: TaskTreeItemProps) {
  const tasks = useTaskStore((s) => s.tasks);
  const derivedStates = useTaskStore((s) => s.derivedStates);
  const toggleTaskExpanded = useUIStore((s) => s.toggleTaskExpanded);
  const isExpanded = useUIStore((s) => s.isTaskExpanded);

  const isLeaf = (useTaskStore.getState().getChildMap().get(task.id) ?? []).length === 0;
  const derived = derivedStates.get(task.id);
  const isSelected = selectedTaskId === task.id;

  const children = tasks
    .filter((t) => t.parentId === task.id && t.archivedAt == null)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const hasChildren = children.length > 0;
  const expanded = isExpanded(task.id);

  const statusLabel = derived?.computedStatus ?? task.manualStatus;
  const rollupLabel = derived?.rollupStatus;

  const getStatusClass = () => {
    if (isLeaf) return statusLabel;
    return rollupLabel ?? 'todo';
  };

  return (
    <>
      <div
        className={`task-tree-item ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: 8 + depth * 20 }}
        onClick={() => onSelect(task.id)}
        onContextMenu={(e) => onContextMenu(e, task.id)}
      >
        <button
          className="toggle-btn"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) toggleTaskExpanded(task.id);
          }}
          style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
        >
          {expanded ? 'v' : '>'}
        </button>
        <span className={`priority-dot ${task.priority}`} />
        <span className="task-title">{task.title || '(untitled)'}</span>
        <span className={`status-badge ${getStatusClass()}`}>
          {isLeaf ? statusLabel : (rollupLabel ?? '...')}
        </span>
      </div>
      {hasChildren && expanded &&
        children.map((child) => (
          <TaskTreeItem
            key={child.id}
            task={child}
            depth={depth + 1}
            onSelect={onSelect}
            onContextMenu={onContextMenu}
            selectedTaskId={selectedTaskId}
          />
        ))}
    </>
  );
}
