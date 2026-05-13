import { useEffect, useRef } from 'react';
import { useProjectStore } from '../../state/projectStore';
import { useTaskStore } from '../../state/taskStore';
import { useUIStore } from '../../state/uiStore';

interface TaskContextMenuProps {
  x: number;
  y: number;
  taskId: string;
  onClose: () => void;
}

export default function TaskContextMenu({ x, y, taskId, onClose }: TaskContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const tasks = useTaskStore((s) => s.tasks);
  const createTask = useTaskStore((s) => s.createTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const selectTask = useTaskStore((s) => s.selectTask);
  const openInspector = useUIStore((s) => s.openInspector);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);

  const task = tasks.find((t) => t.id === taskId);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleAddChild = async () => {
    if (!currentProjectId) return;
    const title = prompt('子任务标题：');
    if (title?.trim()) {
      await createTask(currentProjectId, taskId, title.trim());
      }
    onClose();
  };

  const handleAddSibling = async () => {
    if (!currentProjectId || !task) return;
    const title = prompt('同级任务标题：');
    if (title?.trim()) {
      await createTask(currentProjectId, task.parentId, title.trim());
    }
    onClose();
  };

  const handleDelete = async () => {
    if (confirm('确认删除此任务及其所有子任务？此操作不可撤销。')) {
      await deleteTask(taskId);
    }
    onClose();
  };

  const handleInspect = () => {
    selectTask(taskId);
    openInspector('details');
    onClose();
  };

  const handleViewDeps = () => {
    selectTask(taskId);
    openInspector('dependencies');
    onClose();
  };

  return (
    <div
      ref={ref}
      className="m3-menu"
      style={{ left: x, top: y }}
    >
      <button className="m3-menu-item" onClick={handleInspect}>
        查看详情
      </button>
      <button className="m3-menu-item" onClick={handleViewDeps}>
        查看依赖
      </button>
      <button className="m3-menu-item" onClick={handleAddChild}>
        添加子任务
      </button>
      <button className="m3-menu-item" onClick={handleAddSibling}>
        添加同级任务
      </button>
      <div className="m3-divider" />
      <button className="m3-menu-item destructive" onClick={handleDelete}>
        删除
      </button>
    </div>
  );
}
