import { beforeEach, describe, expect, it } from 'vitest';
import { useUIStore } from '../../state/uiStore';

describe('useUIStore graph layout state', () => {
  beforeEach(() => {
    localStorage.clear();
    useUIStore.setState({
      graphLayoutMode: 'auto',
      graphManualPositions: {},
    });
  });

  it('stores manual graph node positions by project and task', () => {
    useUIStore.getState().saveGraphNodePosition('project-1', 'task-1', { x: 240, y: 160 });

    expect(useUIStore.getState().getGraphManualPositions('project-1')).toEqual({
      'task-1': { x: 240, y: 160 },
    });
    expect(JSON.parse(localStorage.getItem('questack:graphManualPositions') ?? '{}')).toEqual({
      'project-1': {
        'task-1': { x: 240, y: 160 },
      },
    });
  });

  it('clears manual graph node positions for one project', () => {
    useUIStore.getState().saveGraphNodePosition('project-1', 'task-1', { x: 240, y: 160 });
    useUIStore.getState().saveGraphNodePosition('project-2', 'task-2', { x: 480, y: 320 });

    useUIStore.getState().clearGraphManualPositions('project-1');

    expect(useUIStore.getState().getGraphManualPositions('project-1')).toEqual({});
    expect(useUIStore.getState().getGraphManualPositions('project-2')).toEqual({
      'task-2': { x: 480, y: 320 },
    });
  });
});
