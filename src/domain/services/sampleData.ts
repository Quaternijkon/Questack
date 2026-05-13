import type { Project } from '../models/project';
import type { Task } from '../models/task';
import type { DependencyEdge } from '../models/dependency';
import { createDefaultProjectSettings } from '../models/project';

interface SampleData {
  project: Project;
  tasks: Omit<Task, 'id'>[];
  edges: Omit<DependencyEdge, 'id'>[];
}

export function generateSampleData(): SampleData {
  const now = new Date().toISOString();
  const pid = crypto.randomUUID();

  const project: Project = {
    id: pid,
    name: '开发个人网站',
    description: '从零搭建一个展示个人作品和博客的网站',
    createdAt: now,
    updatedAt: now,
    settings: createDefaultProjectSettings(),
  };

  const t = (id: string, parentId: string | null, title: string, overrides: Partial<Omit<Task, 'id' | 'projectId' | 'parentId' | 'title' | 'createdAt' | 'updatedAt'>> = {}) => ({
    projectId: pid,
    id,
    parentId,
    title,
    manualStatus: 'todo' as const,
    priority: 'medium' as const,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });

  const tasks: Omit<Task, 'id'>[] = [
    // Phase 1: 需求与设计
    t('t1', null, '需求整理与设计', { sortOrder: 0 }),
    t('t2', 't1', '确定网站目标和受众', { sortOrder: 0, manualStatus: 'done' }),
    t('t3', 't1', '梳理功能清单', { sortOrder: 1, manualStatus: 'done' }),
    t('t4', 't1', '画线框图', { sortOrder: 2, manualStatus: 'in_progress', estimateMinutes: 120 }),
    t('t5', 't1', '设计视觉稿', { sortOrder: 3, priority: 'high', estimateMinutes: 180 }),
    t('t6', 't1', '设计评审', { sortOrder: 4, priority: 'critical' }),

    // Phase 2: 前端开发
    t('t7', null, '前端开发', { sortOrder: 1 }),
    t('t8', 't7', '搭建项目脚手架', { sortOrder: 0, manualStatus: 'done' }),
    t('t9', 't7', '实现首页', { sortOrder: 1, estimateMinutes: 240 }),
    t('t10', 't7', '实现作品集页面', { sortOrder: 2, estimateMinutes: 180 }),
    t('t11', 't7', '实现博客系统', { sortOrder: 3, priority: 'high', estimateMinutes: 300 }),
    t('t12', 't7', '响应式适配', { sortOrder: 4, estimateMinutes: 120 }),

    // Phase 3: 后端与部署
    t('t13', null, '后端与部署', { sortOrder: 2 }),
    t('t14', 't13', '配置域名和服务器', { sortOrder: 0, manualStatus: 'done' }),
    t('t15', 't13', '部署前端静态资源', { sortOrder: 1 }),
    t('t16', 't13', '配置 CI/CD 自动部署', { sortOrder: 2, estimateMinutes: 90 }),
    t('t17', 't13', 'SEO 优化', { sortOrder: 3, priority: 'low', estimateMinutes: 60 }),
    t('t18', 't13', '上线前检查', { sortOrder: 4, priority: 'high' }),

    // Phase 4: 测试与上线
    t('t19', null, '测试与上线', { sortOrder: 3 }),
    t('t20', 't19', '浏览器兼容测试', { sortOrder: 0, estimateMinutes: 120 }),
    t('t21', 't19', '性能优化', { sortOrder: 1, estimateMinutes: 90 }),
    t('t22', 't19', '用户验收测试', { sortOrder: 2, priority: 'critical', estimateMinutes: 60 }),
    t('t23', 't19', '正式发布', { sortOrder: 3, priority: 'high' }),
  ];

  const e = (fromTaskId: string, toTaskId: string): Omit<DependencyEdge, 'id'> => ({
    projectId: pid,
    fromTaskId,
    toTaskId,
    type: 'finish_to_start',
    createdAt: now,
  });

  const edges: Omit<DependencyEdge, 'id'>[] = [
    // Phase 1 internal
    e('t2', 't4'),
    e('t3', 't4'),
    e('t4', 't5'),
    e('t5', 't6'),

    // Phase 1 → Phase 2
    e('t6', 't9'),
    e('t6', 't10'),
    e('t6', 't11'),

    // Phase 2 internal
    e('t8', 't9'),
    e('t9', 't10'),
    e('t10', 't12'),
    e('t9', 't11'),

    // Phase 2 → Phase 3
    e('t12', 't15'),
    e('t11', 't15'),

    // Phase 3 internal
    e('t14', 't15'),
    e('t15', 't16'),
    e('t16', 't17'),

    // Phase 3 → Phase 4
    e('t15', 't20'),
    e('t16', 't21'),
    e('t17', 't22'),

    // Phase 4 internal
    e('t20', 't22'),
    e('t21', 't22'),
    e('t22', 't23'),
  ];

  return { project, tasks, edges };
}
