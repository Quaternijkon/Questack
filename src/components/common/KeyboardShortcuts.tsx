import { useEffect, useCallback } from 'react';
import { useProjectStore } from '../../state/projectStore';
import { useTaskStore } from '../../state/taskStore';
import { useUIStore } from '../../state/uiStore';
import { useGraphStore } from '../../state/graphStore';
import { exportToJson } from '../../domain/services/importExportService';

export default function KeyboardShortcuts() {
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const createTask = useTaskStore((s) => s.createTask);
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const setViewMode = useUIStore((s) => s.setViewMode);
  const toggleInspector = useUIStore((s) => s.toggleInspector);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'n':
            e.preventDefault();
            if (currentProjectId) {
              const title = prompt('任务标题：');
              if (title?.trim()) createTask(currentProjectId, null, title.trim());
            }
            break;
          case '1': e.preventDefault(); setViewMode('tree'); break;
          case '2': e.preventDefault(); setViewMode('graph'); break;
          case '3': e.preventDefault(); setViewMode('ready-queue'); break;
          case '4': e.preventDefault(); setViewMode('roadmap'); break;
          case 'i': e.preventDefault(); toggleInspector(); break;
          case 'e':
            e.preventDefault();
            handleExport();
            break;
        }
      }

      if (e.key === 'Delete' && selectedTaskId && target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (confirm('确认删除选中的任务及其所有子任务？')) {
          deleteTask(selectedTaskId);
        }
      }
    },
    [currentProjectId, createTask, selectedTaskId, deleteTask, setViewMode, toggleInspector]
  );

  const handleExport = () => {
    const projects = useProjectStore.getState().projects;
    const pId = useProjectStore.getState().currentProjectId;
    const tasks = useTaskStore.getState().tasks;
    const edges = useGraphStore.getState().edges;
    const project = projects.find((p) => p.id === pId);
    if (!project) return;
    const projectTasks = tasks.filter((t) => t.projectId === pId);
    const projectEdges = edges.filter((e) => e.projectId === pId);
    const json = exportToJson([project], projectTasks, projectEdges);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `questack-${project.name}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return null;
}
