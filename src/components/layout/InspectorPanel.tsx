import { useUIStore } from '../../state/uiStore';
import { useTaskStore } from '../../state/taskStore';
import TaskInspector from '../inspector/TaskInspector';
import DependencyEditor from '../inspector/DependencyEditor';

export default function InspectorPanel() {
  const inspectorOpen = useUIStore((s) => s.inspectorOpen);
  const inspectorTab = useUIStore((s) => s.inspectorTab);
  const setInspectorTab = useUIStore((s) => s.setInspectorTab);
  const closeInspector = useUIStore((s) => s.closeInspector);
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);

  if (!inspectorOpen || !selectedTaskId) return null;

  return (
    <aside className="inspector-panel">
      <div className="inspector-header">
        <span className="inspector-header-title">Task Inspector</span>
        <button className="m3-icon-btn" onClick={closeInspector}>x</button>
      </div>

      <div className="inspector-tabs">
        <button
          className={`inspector-tab ${inspectorTab === 'details' ? 'active' : ''}`}
          onClick={() => setInspectorTab('details')}
        >
          Details
        </button>
        <button
          className={`inspector-tab ${inspectorTab === 'dependencies' ? 'active' : ''}`}
          onClick={() => setInspectorTab('dependencies')}
        >
          Dependencies
        </button>
      </div>

      <div className="inspector-body">
        {inspectorTab === 'details' && <TaskInspector />}
        {inspectorTab === 'dependencies' && <DependencyEditor />}
      </div>
    </aside>
  );
}
