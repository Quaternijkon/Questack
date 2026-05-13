import type { Project } from '../models/project';
import type { Task } from '../models/task';
import type { DependencyEdge } from '../models/dependency';
import { createDefaultProjectSettings } from '../models/project';

interface SampleData {
  project: Project;
  tasks: Task[];
  edges: DependencyEdge[];
}

export function generateSampleData(): SampleData {
  const now = new Date().toISOString();
  const pid = crypto.randomUUID();
  let edgeIndex = 0;

  const project: Project = {
    id: pid,
    name: 'Questack 全功能演示项目',
    description: '覆盖任务树、DAG 依赖、独立任务团、Ready Queue、阻塞原因、优先级、估时、取消任务、深层拆解和图层布局的示例项目。',
    createdAt: now,
    updatedAt: now,
    settings: {
      ...createDefaultProjectSettings(),
      readyQueueSort: 'topological',
      graphDirection: 'LR',
    },
  };

  const taskId = (key: string) => `${pid}:${key}`;

  const t = (
    key: string,
    parentKey: string | null,
    title: string,
    overrides: Partial<Omit<Task, 'id' | 'projectId' | 'parentId' | 'title' | 'createdAt' | 'updatedAt'>> = {}
  ): Task => ({
    id: taskId(key),
    projectId: pid,
    parentId: parentKey ? taskId(parentKey) : null,
    title,
    manualStatus: 'todo',
    priority: 'medium',
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });

  const e = (fromKey: string, toKey: string): DependencyEdge => ({
    id: `${pid}:edge:${++edgeIndex}`,
    projectId: pid,
    fromTaskId: taskId(fromKey),
    toTaskId: taskId(toKey),
    type: 'finish_to_start',
    createdAt: now,
  });

  const tasks: Task[] = [
    // 01 产品体验设计：展示深层拆解、active、ready、blocked、critical。
    t('ux', null, '01 产品体验设计', { sortOrder: 0, priority: 'high' }),
    t('ux-goal', 'ux', '明确产品目标和演示故事', { sortOrder: 0, manualStatus: 'done', priority: 'high', estimateMinutes: 45 }),
    t('ux-persona', 'ux', '定义开发者和新用户画像', { sortOrder: 1, manualStatus: 'done', estimateMinutes: 60 }),
    t('ux-map', 'ux', '梳理首屏信息架构', { sortOrder: 2, manualStatus: 'in_progress', priority: 'high', estimateMinutes: 90 }),
    t('ux-visual', 'ux', '建立视觉系统', { sortOrder: 3, priority: 'critical', estimateMinutes: 180 }),
    t('ux-theme', 'ux-visual', '主题与色彩', { sortOrder: 0, priority: 'critical' }),
    t('ux-theme-light', 'ux-theme', '设计浅色模式 token', { sortOrder: 0, priority: 'high', estimateMinutes: 70 }),
    t('ux-theme-dark', 'ux-theme', '设计深色模式 token', { sortOrder: 1, priority: 'high', estimateMinutes: 70 }),
    t('ux-node-style', 'ux-visual', '设计图节点状态样式', { sortOrder: 1, priority: 'high', estimateMinutes: 80 }),
    t('ux-a11y', 'ux', '补齐键盘焦点与可访问名称', { sortOrder: 4, priority: 'low', estimateMinutes: 45 }),

    // 02 图层与依赖图引擎：展示图层、手动位置、父子辅助线和阻塞依赖。
    t('graph', null, '02 图层与依赖图引擎', { sortOrder: 1, priority: 'critical' }),
    t('graph-service', 'graph', '抽象图布局服务', { sortOrder: 0, manualStatus: 'done', priority: 'critical', estimateMinutes: 120 }),
    t('graph-layer', 'graph', '独立任务团图层背景', { sortOrder: 1, manualStatus: 'in_progress', priority: 'high', estimateMinutes: 150 }),
    t('graph-position', 'graph', '编辑模式手动位置保存', { sortOrder: 2, priority: 'high', estimateMinutes: 110 }),
    t('graph-edge-style', 'graph', '区分父子线和依赖边', { sortOrder: 3, priority: 'medium', estimateMinutes: 95 }),
    t('graph-blocking', 'graph', '阻塞链路高亮', { sortOrder: 4, priority: 'critical', estimateMinutes: 130 }),
    t('graph-minimap', 'graph', '大图缩放与 minimap 检查', { sortOrder: 5, priority: 'low', estimateMinutes: 60 }),

    // 03 执行工作台：展示 Ready Queue、开始/完成、稍后处理和解锁反馈。
    t('desk', null, '03 执行工作台', { sortOrder: 2, priority: 'high' }),
    t('desk-queue', 'desk', 'Ready Queue 计算与展示', { sortOrder: 0, manualStatus: 'done', priority: 'critical', estimateMinutes: 100 }),
    t('desk-sort', 'desk', '按优先级和估时排序队列', { sortOrder: 1, priority: 'medium', estimateMinutes: 65 }),
    t('desk-focus', 'desk', '专注模式任务面板', { sortOrder: 2, priority: 'high', estimateMinutes: 120 }),
    t('desk-unlock', 'desk', '完成任务后的解锁反馈', { sortOrder: 3, priority: 'high', estimateMinutes: 80 }),
    t('desk-snooze', 'desk', '稍后处理 ready 任务', { sortOrder: 4, priority: 'low', estimateMinutes: 40 }),
    t('desk-canceled', 'desk', '废弃番茄钟积分方案', { sortOrder: 5, manualStatus: 'canceled', priority: 'low', estimateMinutes: 30 }),

    // 04 数据安全与导入导出：展示本地优先、快照、导入校验。
    t('data', null, '04 数据安全与导入导出', { sortOrder: 3, priority: 'critical' }),
    t('data-export', 'data', '导出当前项目 JSON', { sortOrder: 0, manualStatus: 'done', priority: 'high', estimateMinutes: 60 }),
    t('data-import-preview', 'data', '导入前预览变更', { sortOrder: 1, priority: 'high', estimateMinutes: 90 }),
    t('data-snapshot', 'data', '导入前自动创建快照', { sortOrder: 2, priority: 'critical', estimateMinutes: 100 }),
    t('data-health', 'data', '数据健康检查面板', { sortOrder: 3, priority: 'medium', estimateMinutes: 90 }),
    t('data-repair', 'data', '修复孤立依赖边', { sortOrder: 4, priority: 'medium', estimateMinutes: 50 }),

    // 05 发布与增长验证：故意全部被阻塞，用于展示 blocked 父任务聚合。
    t('release', null, '05 发布与增长验证（当前整体阻塞）', { sortOrder: 4, priority: 'critical' }),
    t('release-e2e', 'release', '端到端验收图层和主题', { sortOrder: 0, priority: 'critical', estimateMinutes: 120 }),
    t('release-pages', 'release', 'GitHub Pages 自动部署验收', { sortOrder: 1, priority: 'high', estimateMinutes: 45 }),
    t('release-docs', 'release', '编写用户上手指南', { sortOrder: 2, priority: 'medium', estimateMinutes: 80 }),
    t('release-analytics', 'release', '记录示例项目反馈指标', { sortOrder: 3, priority: 'low', estimateMinutes: 60 }),

    // 06 独立任务团：不依赖其他任务团，专门用于验证图层分组。
    t('solo', null, '06 独立任务团：个人效率实验', { sortOrder: 5, priority: 'medium' }),
    t('solo-reading', 'solo', '阅读任务拆解方法文章', { sortOrder: 0, priority: 'low', estimateMinutes: 25 }),
    t('solo-notes', 'solo', '整理三条个人使用心得', { sortOrder: 1, priority: 'medium', estimateMinutes: 35 }),
    t('solo-review', 'solo', '每日回顾当前 ready 任务', { sortOrder: 2, manualStatus: 'in_progress', priority: 'medium', estimateMinutes: 15 }),
    t('solo-abandoned', 'solo', '放弃纸质看板同步方案', { sortOrder: 3, manualStatus: 'canceled', priority: 'low', estimateMinutes: 20 }),

    // 07 模板与 AI 草稿：展示后续能力和多条依赖链。
    t('template', null, '07 模板与 AI 草稿', { sortOrder: 6, priority: 'medium' }),
    t('template-library', 'template', '内置模板库结构', { sortOrder: 0, priority: 'medium', estimateMinutes: 100 }),
    t('template-save', 'template', '项目另存为模板', { sortOrder: 1, priority: 'medium', estimateMinutes: 90 }),
    t('template-ai-draft', 'template', 'AI 拆解任务草稿入口', { sortOrder: 2, priority: 'high', estimateMinutes: 140 }),
    t('template-ai-review', 'template', 'AI 建议人工确认流程', { sortOrder: 3, priority: 'critical', estimateMinutes: 120 }),
  ];

  const edges: DependencyEdge[] = [
    // 产品体验设计内部链路。
    e('ux-goal', 'ux-map'),
    e('ux-persona', 'ux-map'),
    e('ux-map', 'ux-theme-light'),
    e('ux-map', 'ux-theme-dark'),
    e('ux-theme-light', 'ux-node-style'),
    e('ux-theme-dark', 'ux-node-style'),

    // 图引擎内部链路。
    e('graph-service', 'graph-layer'),
    e('graph-layer', 'graph-position'),
    e('graph-service', 'graph-edge-style'),
    e('graph-position', 'graph-blocking'),
    e('graph-edge-style', 'graph-blocking'),
    e('graph-blocking', 'graph-minimap'),

    // 执行工作台内部链路。
    e('desk-queue', 'desk-sort'),
    e('desk-queue', 'desk-focus'),
    e('desk-focus', 'desk-unlock'),
    e('desk-sort', 'desk-snooze'),
    e('desk-canceled', 'desk-snooze'),

    // 数据安全内部链路。
    e('data-export', 'data-import-preview'),
    e('data-import-preview', 'data-snapshot'),
    e('data-import-preview', 'data-health'),
    e('data-health', 'data-repair'),

    // 跨任务团依赖：让图视图展示多泳道跨层连线。
    e('ux-node-style', 'graph-edge-style'),
    e('graph-position', 'release-e2e'),
    e('graph-blocking', 'release-e2e'),
    e('desk-unlock', 'release-docs'),
    e('data-snapshot', 'release-pages'),
    e('release-e2e', 'release-pages'),
    e('release-pages', 'release-analytics'),
    e('release-docs', 'release-analytics'),

    // 独立任务团只包含内部依赖，不跨出该图层。
    e('solo-reading', 'solo-notes'),

    // 模板与 AI 草稿链路。
    e('template-library', 'template-save'),
    e('template-save', 'template-ai-draft'),
    e('template-ai-draft', 'template-ai-review'),
    e('data-import-preview', 'template-library'),
    e('ux-map', 'template-ai-draft'),
  ];

  return { project, tasks, edges };
}
