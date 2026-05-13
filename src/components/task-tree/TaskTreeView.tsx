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
        <h3>No project selected</h3>
        <p>Create or select a project from the sidebar.</p>
      </div>
    );
  }

  const rootTasks = tasks
    .filter((t) => t.parentId === null && t.archivedAt == null)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const handleAddRoot = async () => {
    const title = prompt('Task title:');
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
      <div className="toolbar">
        <button className="btn btn-primary btn-sm" onClick={handleAddRoot}>
          + Add Task
        </button>
      </div>
      {rootTasks.length === 0 ? (
        <div className="empty-state">
          <h3>No tasks yet</h3>
          <p>Click "Add Task" to start breaking down your goal.</p>
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
