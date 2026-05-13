import { useState } from 'react';
import { useProjectStore } from '../../state/projectStore';
import { useTaskStore } from '../../state/taskStore';
import { useUIStore, type ViewMode } from '../../state/uiStore';
import { useGraphStore } from '../../state/graphStore';
import { exportToJson, importFromJson } from '../../domain/services/importExportService';

export default function Sidebar() {
  const projects = useProjectStore((s) => s.projects);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const createProject = useProjectStore((s) => s.createProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const tasks = useTaskStore((s) => s.tasks);
  const edges = useGraphStore((s) => s.edges);
  const viewMode = useUIStore((s) => s.viewMode);
  const setViewMode = useUIStore((s) => s.setViewMode);

  const [importModal, setImportModal] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const handleCreate = async () => {
    const name = prompt('Enter project name:');
    if (name?.trim()) {
      await createProject(name.trim());
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Delete project "${name}"? This cannot be undone.`)) {
      await deleteProject(id);
    }
  };

  const handleExport = () => {
    const currentProject = projects.find((p) => p.id === currentProjectId);
    if (!currentProject) {
      alert('Select a project first.');
      return;
    }
    const projectTasks = tasks.filter((t) => t.projectId === currentProjectId);
    const projectEdges = edges.filter((e) => e.projectId === currentProjectId);
    const json = exportToJson([currentProject], projectTasks, projectEdges);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `questack-${currentProject.name}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    setImportModal(true);
    setImportErrors([]);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const result = importFromJson(text);

    if (!result.success) {
      setImportErrors(result.errors.map((err) => `${err.field}: ${err.message}`));
      return;
    }

    const { projects: importedProjects, tasks: importedTasks } = result.data;

    for (const project of importedProjects) {
      await useProjectStore.getState().createProject(project.name, project.description);
    }

    const loadedProjects = useProjectStore.getState().projects;
    for (const task of importedTasks) {
      const proj = loadedProjects.find((p) => p.name === importedProjects.find((ip) => ip.id === task.projectId)?.name);
      if (proj) {
        await useTaskStore.getState().createTask(proj.id, task.parentId, task.title);
      }
    }

    setImportModal(false);
    await loadProjects();
  };

  const views: { mode: ViewMode; label: string }[] = [
    { mode: 'tree', label: 'Tree' },
    { mode: 'graph', label: 'Graph' },
    { mode: 'ready-queue', label: 'Ready' },
    { mode: 'roadmap', label: 'Roadmap' },
  ];

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="sidebar-logo">Q</div>
            <span className="sidebar-headline">Questack</span>
          </div>
          <button className="m3-icon-btn" onClick={handleCreate} title="New Project">
            +
          </button>
        </div>

        <div className="sidebar-nav">
          {currentProjectId && (
            <>
              <div className="nav-section-label">Views</div>
              {views.map((v) => (
                <div
                  key={v.mode}
                  className={`nav-item ${viewMode === v.mode ? 'active' : ''}`}
                  onClick={() => setViewMode(v.mode)}
                >
                  {v.label}
                </div>
              ))}
            </>
          )}

          <div className="nav-section-label">Projects</div>
          {projects.map((p) => (
            <div
              key={p.id}
              className={`nav-item ${p.id === currentProjectId ? 'active' : ''}`}
              onClick={() => setCurrentProject(p.id)}
            >
              <span>{p.name}</span>
              <button
                className="m3-icon-btn m3-icon-btn-sm"
                style={{ fontSize: 12, marginLeft: 'auto' }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(p.id, p.name);
                }}
                title="Delete project"
              >
                x
              </button>
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <div className="sidebar-footer">
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="m3-btn m3-btn-outlined m3-btn-sm" onClick={handleExport} disabled={!currentProjectId}>
              Export
            </button>
            <button className="m3-btn m3-btn-outlined m3-btn-sm" onClick={handleImportClick}>
              Import
            </button>
          </div>
        </div>
      </aside>

      {importModal && (
        <div className="m3-dialog-overlay" onClick={() => setImportModal(false)}>
          <div className="m3-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Import Project</h2>
            <p style={{ fontSize: 13, color: 'var(--md-on-surface-variant)', marginBottom: 16 }}>
              Select a Questack JSON export file to import.
            </p>
            <input
              type="file"
              accept=".json"
              onChange={handleFileSelect}
            />
            {importErrors.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--md-error)', marginBottom: 4 }}>
                  Import Errors:
                </div>
                <ul className="import-error-list">
                  {importErrors.map((err, i) => (
                    <li key={i} className="import-error-item">{err}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="m3-dialog-actions">
              <button className="m3-btn m3-btn-outlined" onClick={() => setImportModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
