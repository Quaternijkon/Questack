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
    const name = prompt('输入项目名称：');
    if (name?.trim()) {
      await createProject(name.trim());
    }
  };

  return (
    <div className="empty-state">
      <div className="empty-state-icon">Q</div>
      <h3>欢迎使用 Questack</h3>
      <p>将复杂目标拆解为带依赖关系图的任务树。创建您的第一个项目以开始使用。</p>
      <button className="m3-btn m3-btn-filled" onClick={handleCreate}>
        创建项目
      </button>
    </div>
  );
}
