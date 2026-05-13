import { useState } from 'react';
import { useProjectStore } from '../../state/projectStore';
import { useTaskStore } from '../../state/taskStore';
import { useUIStore } from '../../state/uiStore';
import TaskTreeItem from './TaskTreeItem';
import TaskContextMenu from './TaskContextMenu';

export default function TaskTreeView() {
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const tasks = useTaskStore((s) => s.tasks);
  const createTask = useTaskStore((s) => s.createTask);
  const openInspector = useUIStore((s) => s.openInspector);
  const selectTask = useTaskStore((s) => s.selectTask);
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; taskId: string } | null>(null);

    if (!currentProjectId) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon">📁</span>
        <h3>未选择项目</h3>
        <p>请在侧边栏创建或选择一个项目。</p>
      </div>
    );
  }

  const rootTasks = tasks
    .filter((t) => t.parentId === null && t.archivedAt == null)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const handleAddRoot = async () => {
    const title = prompt('任务标题：');
    if (title?.trim()) {
      await createTask(currentProjectId, null, title.trim());
    }
  };

  const handleContextMenu = (e: React.MouseEvent, taskId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, taskId });
  };

  const handleClick = (taskId: string) => {
    selectTask(taskId);
    openInspector();
  };

  return (
    <div className="task-tree" onClick={() => setContextMenu(null)}>
      <div className="main-toolbar">
        <h2 className="toolbar-title">任务</h2>
        <button className="m3-btn-filled-tonal m3-btn-sm" onClick={handleAddRoot}>
          + 添加任务
        </button>
      </div>
      {rootTasks.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">📋</span>
          <h3>暂无任务</h3>
          <p>点击「添加任务」开始拆解目标。</p>
        </div>
      ) : (
        rootTasks.map((task) => (
          <TaskTreeItem
            key={task.id}
            task={task}
            depth={0}
            onSelect={handleClick}
            onContextMenu={handleContextMenu}
            selectedTaskId={selectedTaskId}
          />
        ))
      )}
      {contextMenu && (
        <TaskContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          taskId={contextMenu.taskId}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
