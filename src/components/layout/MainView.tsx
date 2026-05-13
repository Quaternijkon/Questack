import { useUIStore } from '../../state/uiStore';
import TaskTreeView from '../task-tree/TaskTreeView';
import GraphView from '../graph/GraphView';
import ReadyQueueView from '../ready-queue/ReadyQueueView';
import RoadmapView from '../roadmap/RoadmapView';

export default function MainView() {
  const viewMode = useUIStore((s) => s.viewMode);

  return (
    <main className="main-content">
      <div className="view-container">
        {viewMode === 'tree' && <TaskTreeView />}
        {viewMode === 'graph' && <GraphView />}
        {viewMode === 'ready-queue' && <ReadyQueueView />}
        {viewMode === 'roadmap' && <RoadmapView />}
      </div>
    </main>
  );
}
