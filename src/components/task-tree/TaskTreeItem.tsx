import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
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
  const expandedTaskIds = useUIStore((s) => s.expandedTaskIds);
  const updateTask = useTaskStore((s) => s.updateTask);

  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const isLeaf = (useTaskStore.getState().getChildMap().get(task.id) ?? []).length === 0;
  const derived = derivedStates.get(task.id);
  const isSelected = selectedTaskId === task.id;

  const children = tasks
    .filter((t) => t.parentId === task.id && t.archivedAt == null)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const hasChildren = children.length > 0;
  const expanded = expandedTaskIds.has(task.id);

  const statusLabel = derived?.computedStatus ?? task.manualStatus;
  const rollupLabel = derived?.rollupStatus;

  const progressPercent =
    !isLeaf && derived && derived.descendantCount > 0
      ? Math.round((derived.completedDescendantCount / derived.descendantCount) * 100)
      : 0;

  const getStatusClass = () => {
    if (isLeaf) return statusLabel;
    return rollupLabel ?? 'todo';
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTitle(task.id);
    setEditValue(task.title || '');
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editValue.trim()) {
        updateTask(task.id, { title: editValue.trim() });
      }
      setEditingTitle(null);
    } else if (e.key === 'Escape') {
      setEditingTitle(null);
    }
  };

  const handleEditBlur = () => {
    if (editValue.trim()) {
      updateTask(task.id, { title: editValue.trim() });
    }
    setEditingTitle(null);
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
          className={`tree-toggle ${expanded ? 'expanded' : ''}`}
          type="button"
          aria-label={expanded ? '收起子任务' : '展开子任务'}
          aria-expanded={hasChildren ? expanded : undefined}
          disabled={!hasChildren}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (hasChildren) toggleTaskExpanded(task.id);
          }}
        >
          {hasChildren ? (
            expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
          ) : (
            <span className="tree-toggle-placeholder" />
          )}
        </button>
        <span className={`priority-indicator ${task.priority}`} />
        {editingTitle === task.id ? (
          <input
            className="tree-title-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleEditKeyDown}
            onBlur={handleEditBlur}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="tree-title"
            onDoubleClick={handleDoubleClick}
          >
            {task.title || '（未命名）'}
          </span>
        )}
        {!isLeaf && derived && derived.descendantCount > 0 && (
          <div className="tree-progress-bar">
            <div
              className="tree-progress-bar-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
        <div className="tree-meta">
          <span className={`status-badge ${getStatusClass()}`}>
            {isLeaf ? statusLabel : (rollupLabel ?? '...')}
          </span>
        </div>
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
