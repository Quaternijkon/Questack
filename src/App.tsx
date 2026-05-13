import { useEffect } from 'react';
import { useProjectStore } from './state/projectStore';
import { useTaskStore } from './state/taskStore';
import { useGraphStore } from './state/graphStore';
import { ProjectShell } from './components/layout/ProjectShell';

export default function App() {
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const loadTasks = useTaskStore((s) => s.loadTasks);
  const loadEdges = useGraphStore((s) => s.loadEdges);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (currentProjectId) {
      loadTasks(currentProjectId);
      loadEdges(currentProjectId);
    }
  }, [currentProjectId, loadTasks, loadEdges]);

  return <ProjectShell />;
}
