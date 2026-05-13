import { useProjectStore } from '../../state/projectStore';
import Sidebar from './Sidebar';
import MainView from './MainView';
import InspectorPanel from './InspectorPanel';

export function ProjectShell() {
  const projects = useProjectStore((s) => s.projects);

  if (projects.length === 0) {
    return (
      <div className="app-layout" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <EmptyStart />
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <MainView />
      <InspectorPanel />
    </div>
  );
}

function EmptyStart() {
  const createProject = useProjectStore((s) => s.createProject);

  const handleCreate = async () => {
    const name = prompt('Enter project name:');
    if (name?.trim()) {
      await createProject(name.trim());
    }
  };

  return (
    <div className="empty-state">
      <h3>Welcome to Questack</h3>
      <p>Break complex goals into task trees with dependency DAGs. Create your first project to get started.</p>
      <button className="btn btn-primary" onClick={handleCreate}>
        Create Project
      </button>
    </div>
  );
}
