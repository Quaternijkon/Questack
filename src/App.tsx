import { useEffect } from 'react';
import { useProjectStore } from './state/projectStore';
import { useTaskStore } from './state/taskStore';
import { useGraphStore } from './state/graphStore';
import { useUIStore } from './state/uiStore';
import { ProjectShell } from './components/layout/ProjectShell';
import KeyboardShortcuts from './components/common/KeyboardShortcuts';

export default function App() {
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const loadTasks = useTaskStore((s) => s.loadTasks);
  const loadEdges = useGraphStore((s) => s.loadEdges);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const themeMode = useUIStore((s) => s.themeMode);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (currentProjectId) {
      loadTasks(currentProjectId);
      loadEdges(currentProjectId);
    }
  }, [currentProjectId, loadTasks, loadEdges]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    document.documentElement.style.colorScheme = themeMode;
  }, [themeMode]);

  return (
    <>
      <KeyboardShortcuts />
      <ProjectShell />
    </>
  );
}
