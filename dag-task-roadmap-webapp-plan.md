# DAG 任务路线图 Web 应用工程计划书

> 面向 coding agent 的实现参考文档。目标是把“我要做成某件事”拆成可无限细分的任务树，并通过先序依赖自动生成 DAG 路线图，实时告诉用户当前可执行任务、阻塞原因和后续路径。

---

## 1. 产品定位

### 1.1 一句话定义

一个把复杂目标拆解成“游戏任务树 + 先序依赖 DAG”的个人规划工具：用户可以不断细分目标任务，给任务之间建立依赖关系，系统自动计算当前可做任务、阻塞任务、路线图和执行顺序。

### 1.2 核心价值

1. **拆解复杂目标**：把“做成某件事”拆成树状任务结构，支持任意深度。
2. **表达真实依赖**：任务之间不只存在父子关系，还存在“必须先做 A 才能做 B”的先序关系。
3. **自动生成路线图**：把依赖边转化为 DAG，并通过拓扑排序生成执行路径。
4. **自动识别当前任务**：系统实时计算哪些任务已经 Ready，哪些被 Blocked，以及具体被哪些前置任务阻塞。
5. **降低执行焦虑**：用户不需要反复判断下一步做什么，只需要处理 Ready Queue。

### 1.3 MVP 边界

MVP 先实现**单用户、本地优先、浏览器内持久化**版本。暂不实现团队协作、账号系统、服务端同步、AI 自动拆解。架构上预留 Repository 层，后续可以迁移到服务端数据库。

### 1.4 当前实现状态快照（2026-05-14）

当前仓库已经从“待实现 MVP”推进到“核心 MVP 可用”的阶段。后续计划书不应继续只围绕基础搭建展开，而应把重点转向**产品能力深化、交互体验补齐、视觉系统精修和可持续扩展**。

| 模块 | 当前状态 | 下一阶段重点 |
|---|---|---|
| 技术底座 | React 19 + TypeScript + Vite、Zustand、Dexie、React Flow、dagre、Zod、Vitest 已落地 | 保持本地优先架构，补齐更严格的数据迁移、快照和恢复能力 |
| 核心视图 | 任务树、依赖图、待办队列、路线图、右侧 Inspector 已实现 | 从“能看”升级到“能引导用户完成关键工作流” |
| 图能力 | 支持依赖边、环检测、拓扑排序、自动布局、状态过滤、层级背景提示 | 增强大图可读性、路径高亮、子图聚焦、依赖解释和建边前预判 |
| 执行能力 | Ready Queue 可以显示当前可做任务，并支持开始/完成 | 增加专注模式、时间预算筛选、完成后解锁反馈、稍后处理和批量操作 |
| 数据能力 | IndexedDB 本地持久化、JSON 导出/导入校验已有基础 | 导入应完整恢复任务字段、依赖边、状态、估时和层级映射，并在导入前创建快照 |
| 交互体验 | 目前大量创建、删除、错误提示仍依赖 `prompt`、`alert`、`confirm` | 替换为应用内对话框、Snackbar、撤销、空状态引导和命令面板 |
| 视觉设计 | Material Design 3 暗色主题、状态色、卡片、芯片、图节点样式已建立 | 建立更完整的 Questack 品牌视觉：图标体系、浅色主题、响应式布局、页面密度和动效规范 |
| 工程质量 | README 标注 38 个单元测试，CI/CD 和 GitHub Pages 部署方案已写入计划 | 下一阶段新增组件测试、E2E 关键路径测试、无障碍和响应式回归测试 |

---

## 2. 关键概念模型

### 2.1 两套关系必须分离

本产品不能把“任务拆分”和“任务依赖”混成一种关系。应拆成两套模型：

| 关系 | 含义 | 数据结构 | 是否必须无环 | 主要用途 |
|---|---|---|---|---|
| 父子关系 | A 被拆成 A1、A2、A3 | Task.parentId | 树结构天然无环 | 组织、展示、聚合进度 |
| 依赖关系 | A 完成后才能做 B | DependencyEdge.fromTaskId -> toTaskId | 必须是 DAG | 计算执行顺序、阻塞状态 |

### 2.2 节点类型

任务节点分为两类：

1. **Container Task / 容器任务**：有子任务，主要用于组织结构，完成状态由子任务聚合得出。
2. **Executable Task / 可执行任务**：没有子任务，是真正进入 Ready Queue 的叶子任务。

默认规则：只有叶子任务进入“现在可做”列表。父任务只作为阶段、目标或任务组展示。

### 2.3 任务状态

建议把用户手动状态和系统计算状态分开，避免“用户设为 todo，但系统判断 blocked”这类状态冲突。

#### 手动状态 `manualStatus`

| 状态 | 说明 |
|---|---|
| `todo` | 尚未开始 |
| `in_progress` | 正在进行 |
| `done` | 已完成 |
| `canceled` | 已取消，不再参与阻塞判断 |

#### 计算状态 `computedStatus`

| 状态 | 计算规则 |
|---|---|
| `ready` | 未完成、未取消，且所有前置依赖均已完成或取消 |
| `blocked` | 未完成、未取消，且存在未完成的前置依赖 |
| `active` | 手动状态为 `in_progress`，且不被依赖阻塞 |
| `done` | 手动状态为 `done` |
| `canceled` | 手动状态为 `canceled` |

### 2.4 父任务聚合状态

父任务不直接依赖单一手动状态，使用 `rollupStatus` 聚合：

| 子任务状态组合 | 父任务聚合状态 |
|---|---|
| 所有子任务 done/canceled | `done` |
| 任意子任务 in_progress/active | `in_progress` |
| 所有未完成叶子任务均 blocked | `blocked` |
| 存在 ready 叶子任务 | `ready` |
| 否则 | `todo` |

### 2.5 展示语义中的阻塞规则

产品在图视图和路线图中必须把两种阻塞关系同时表达清楚：

1. **子任务阻塞父任务**：父任务是容器任务时，它的完成状态由子任务聚合。只要存在未完成、未取消的子任务或后代任务，父任务就不能被视为真正完成；如果所有可执行后代都被阻塞，父任务的聚合状态也应体现为 blocked。
2. **前序任务阻塞后序任务**：依赖边 `A -> B` 表示 A 是 B 的前置任务。A 未完成且未取消时，B 必须显示为 blocked，并能说明“被 A 阻塞”。
3. **父子关系不是依赖边，但会影响可完成性**：父子关系表达拆解结构，依赖关系表达先后顺序。UI 可以用不同视觉元素表现“子任务阻塞父任务”的聚合关系，但不能把它伪装成普通 dependency edge。
4. **容器任务可见但不可误导执行**：父任务可以在图中作为阶段/任务团节点显示，但 Ready Queue 默认仍只放叶子任务；父任务的状态必须来自子任务完成度和阻塞状态。

---

## 3. 推荐技术栈

### 3.1 MVP 推荐栈

| 层 | 推荐方案 | 原因 |
|---|---|---|
| 前端框架 | React + TypeScript + Vite | 快速搭建 SPA，适合本地优先应用 |
| 状态管理 | Zustand 或 Redux Toolkit | 任务图状态集中管理；MVP 推荐 Zustand，代码少 |
| 图可视化 | React Flow `@xyflow/react` | 原生节点/边模型，适合交互式 DAG 编辑器 |
| DAG 自动布局 | `dagre` 或 `elkjs` | 支持有向图层级布局；MVP 可先用 dagre |
| 本地持久化 | IndexedDB，建议通过 Dexie 封装 | 浏览器端结构化数据持久化，适合离线/本地优先 |
| 表单校验 | Zod | TypeScript schema 与运行时校验统一 |
| 测试 | Vitest + React Testing Library + Playwright | 单元、组件、E2E 分层测试 |
| 打包部署 | 静态站点部署，例如 GitHub Pages、Vercel、Netlify | MVP 无服务端，部署简单 |

### 3.2 后续服务端版本

二期可以升级为：

| 层 | 建议 |
|---|---|
| Web 框架 | Next.js 或 Remix |
| 数据库 | PostgreSQL |
| ORM | Prisma 或 Drizzle |
| 实时同步 | WebSocket / Server-Sent Events / Liveblocks / Yjs |
| 鉴权 | Auth.js / Clerk / Supabase Auth |

关键要求：无论本地版还是服务端版，业务层都应通过 `TaskRepository`、`ProjectRepository`、`GraphRepository` 抽象访问数据，避免 UI 直接依赖 IndexedDB 或 SQL。

---

## 4. 数据模型设计

### 4.1 Project

```ts
export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  settings: ProjectSettings;
}

export interface ProjectSettings {
  readyQueueSort: 'topological' | 'priority' | 'createdAt' | 'manualOrder';
  graphDirection: 'TB' | 'LR'; // top-bottom or left-right
  allowParentDependency: boolean;
  allowAncestorDependency: boolean;
}
```

### 4.2 Task

```ts
export type ManualTaskStatus = 'todo' | 'in_progress' | 'done' | 'canceled';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface Task {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  description?: string;
  manualStatus: ManualTaskStatus;
  priority: Priority;
  sortOrder: number;
  estimateMinutes?: number | null;
  dueAt?: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
}
```

### 4.3 DependencyEdge

```ts
export interface DependencyEdge {
  id: string;
  projectId: string;
  fromTaskId: string; // predecessor / prerequisite
  toTaskId: string;   // successor / dependent task
  type: 'finish_to_start';
  createdAt: string;
}
```

### 4.4 DerivedTaskState

派生状态不建议长期存储为真值，优先在内存中计算；如节点很多，可缓存并在数据变更后失效。

```ts
export interface DerivedTaskState {
  taskId: string;
  isLeaf: boolean;
  depth: number;
  path: string[];
  computedStatus: 'ready' | 'blocked' | 'active' | 'done' | 'canceled';
  rollupStatus?: 'todo' | 'ready' | 'in_progress' | 'blocked' | 'done' | 'canceled';
  unmetDependencyIds: string[];
  descendantCount: number;
  completedDescendantCount: number;
}
```

### 4.5 导入导出 JSON 格式

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-05-13T00:00:00.000Z",
  "projects": [],
  "tasks": [],
  "dependencyEdges": []
}
```

导入时必须进行完整校验：

1. ID 唯一。
2. 所有 `projectId`、`parentId`、`fromTaskId`、`toTaskId` 均能解析。
3. 父子关系无环。
4. 依赖关系无环。
5. 不允许跨项目依赖，除非后续明确设计跨项目功能。
6. 发现冗余依赖边时给出 warning，不必强制失败。

---

## 5. 核心业务规则

### 5.1 拆分任务

当用户把一个叶子任务拆成子任务时：

1. 原任务变成 Container Task。
2. 新建子任务的 `parentId` 指向原任务。
3. 原任务不能再直接出现在 Ready Queue 中。
4. 原任务的完成状态由子任务聚合。
5. 如果原任务原本已有依赖关系：
   - 入边仍指向父任务时，可以理解为“整个任务组开始前需要完成这些前置任务”。
   - 出边仍从父任务指出时，可以理解为“整个任务组完成后才能解锁后续任务”。
   - MVP 为降低复杂度，建议默认禁止父任务参与新依赖；已有父任务依赖在图上展示为 group-level dependency。

### 5.2 建立依赖

用户操作语义：

> “任务 A 必须先于任务 B 完成” 等价于建立边 `A -> B`。

建立依赖时必须校验：

1. `fromTaskId !== toTaskId`。
2. 两个任务属于同一 project。
3. 新增边后不能产生环。
4. 默认禁止祖先和后代之间建立依赖，例如父任务依赖子任务、子任务依赖父任务。
5. 如果 `A` 已经可通过其他路径到达 `B`，则 `A -> B` 是冗余边；MVP 可以允许，但 UI 应提示“该依赖已被间接表达”。

### 5.3 删除任务

删除任务时不要直接硬删，建议采用软删除或归档：

1. 删除一个任务时，默认删除/归档整个子树。
2. 删除任务后，所有相关依赖边应自动删除。
3. 如果只是取消任务，应将状态设为 `canceled`，依赖判断中视为已不再阻塞。

### 5.4 移动任务

移动任务到新的父任务下时：

1. 不允许移动到自己的后代下面。
2. 移动不改变依赖边。
3. 移动后重新计算深度、路径、父任务 rollup 状态。
4. 如果依赖边因此变成祖先/后代依赖，应提示用户修复。

### 5.5 标记完成

标记叶子任务完成后：

1. 重新计算该任务的后继节点状态。
2. 更新所有祖先任务的 rollup 状态。
3. 将新解锁的任务加入 Ready Queue。
4. 如果某个父任务下所有子任务完成，则父任务自动显示为完成。

---

## 6. DAG 与算法设计

### 6.1 图构建

输入：当前 project 下所有未归档任务和依赖边。

输出：

```ts
export interface TaskGraph {
  nodes: Task[];
  edges: DependencyEdge[];
  adjacency: Map<string, string[]>;
  reverseAdjacency: Map<string, string[]>;
}
```

构建步骤：

1. 过滤 `archivedAt != null` 的任务。
2. 删除引用不存在任务的脏边。
3. 构建 `adjacency` 和 `reverseAdjacency`。
4. 运行 cycle check。
5. 输出图结构。

### 6.2 新增依赖前的环检测

判断添加 `A -> B` 是否会成环：只需检查当前图中是否已经存在从 `B` 到 `A` 的路径。

```ts
export function wouldCreateCycle(
  fromTaskId: string,
  toTaskId: string,
  adjacency: Map<string, string[]>
): boolean {
  if (fromTaskId === toTaskId) return true;

  const visited = new Set<string>();
  const stack = [toTaskId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === fromTaskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const next of adjacency.get(current) ?? []) {
      stack.push(next);
    }
  }

  return false;
}
```

### 6.3 拓扑排序

使用 Kahn 算法生成执行顺序：

```ts
export function topologicalSort(nodes: Task[], edges: DependencyEdge[]): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    adjacency.get(edge.fromTaskId)!.push(edge.toTaskId);
    inDegree.set(edge.toTaskId, (inDegree.get(edge.toTaskId) ?? 0) + 1);
  }

  const queue = [...inDegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([id]) => id);

  const result: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    result.push(id);

    for (const next of adjacency.get(id) ?? []) {
      const degree = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, degree);
      if (degree === 0) queue.push(next);
    }
  }

  if (result.length !== nodes.length) {
    throw new Error('Dependency graph contains a cycle');
  }

  return result;
}
```

### 6.4 当前可做任务计算

Ready Queue 只放叶子任务。

```ts
export function computeReadyTasks(
  tasks: Task[],
  edges: DependencyEdge[],
  childMap: Map<string, Task[]>
): Task[] {
  const taskById = new Map(tasks.map(task => [task.id, task]));
  const incoming = new Map<string, DependencyEdge[]>();

  for (const edge of edges) {
    if (!incoming.has(edge.toTaskId)) incoming.set(edge.toTaskId, []);
    incoming.get(edge.toTaskId)!.push(edge);
  }

  return tasks.filter(task => {
    const isLeaf = (childMap.get(task.id) ?? []).length === 0;
    if (!isLeaf) return false;
    if (task.manualStatus === 'done' || task.manualStatus === 'canceled') return false;

    const prerequisites = incoming.get(task.id) ?? [];
    return prerequisites.every(edge => {
      const predecessor = taskById.get(edge.fromTaskId);
      return !predecessor || predecessor.manualStatus === 'done' || predecessor.manualStatus === 'canceled';
    });
  });
}
```

### 6.5 阻塞原因计算

每个 blocked task 应展示具体阻塞原因：

```ts
export interface BlockReason {
  taskId: string;
  unmetPrerequisites: Task[];
}
```

显示格式示例：

> “写前端图视图” 被以下任务阻塞：`确定数据模型`、`完成图算法服务`。

### 6.6 冗余边检测

添加 `A -> B` 前，如果当前已经存在路径 `A -> ... -> B`，则该边是冗余边。可以允许用户添加，但建议 UI 给出提示：

> “A 已经通过其他任务链路先于 B，该依赖不是必须的。”

---

## 7. 前端信息架构

### 7.1 页面结构

```text
App
└── ProjectShell
    ├── Sidebar
    │   ├── ProjectList
    │   └── ViewSwitcher
    ├── MainView
    │   ├── TaskTreeView
    │   ├── GraphView
    │   ├── ReadyQueueView
    │   └── RoadmapView
    └── InspectorPanel
        ├── TaskDetailForm
        ├── DependencyEditor
        └── ActivityLog
```

### 7.2 主要视图

#### Task Tree View

用途：拆分、编辑、移动任务。

功能：

1. 新增同级任务。
2. 新增子任务。
3. 折叠/展开子树。
4. 拖拽排序。
5. 显示 rollup 进度。
6. 右键菜单：拆分、复制、移动、归档、导出子树。

#### Graph View

用途：在同一画布中查看任务拆解结构和依赖 DAG，并在编辑模式下调整依赖与位置。

功能：

1. 节点展示任务标题、状态、优先级、完成进度。
2. 边表示先序依赖。
3. 支持从节点拖出连线建立依赖。
4. 建边前调用 cycle check。
5. 支持基础自动布局：独立无依赖的任务团分到不同视觉图层；同一任务团内从上到下表达任务拆解层级，从左到右表达依赖先后顺序。
6. 支持编辑模式：用户可以任意拖动任务节点位置，并将手动布局保存为项目视图配置。
7. 默认所有未归档任务都显示在同一视图中；筛选、聚焦和折叠只能作为降噪辅助，不应让用户误以为任务被移出图。
8. 支持按子树、状态、优先级过滤。
9. 支持点击节点打开右侧任务详情。
10. 父子关系、依赖关系、阻塞关系必须使用不同颜色、线型、箭头或背景层表达，避免用户混淆“拆解”和“前后依赖”。

#### Ready Queue View

用途：告诉用户“现在可以做什么”。

字段：

1. 任务标题。
2. 所属路径，例如 `项目 > 阶段一 > 子任务 A`。
3. 优先级。
4. 预计耗时。
5. 依赖已满足标记。
6. 快捷操作：开始、完成、稍后、拆分。

#### Roadmap View

用途：按照拓扑顺序展示路线图。

展示方式：

1. 阶段泳道。
2. 当前 ready 节点高亮。
3. blocked 节点灰色显示。
4. 已完成节点折叠。
5. 可选展示关键路径。

### 7.3 交互原则

1. 用户在树中组织任务，在图中组织依赖。
2. 系统永远不要让用户成功保存一个有环依赖图。
3. 用户每次完成任务后，Ready Queue 应立即刷新。
4. 图中任何 blocked 节点必须能解释为什么 blocked。
5. 不要让父任务和子任务依赖关系变成隐式魔法；所有自动传播规则必须可解释。
6. 图视图的基础坐标语义必须稳定：纵向表示拆解深度，横向表示先后顺序。
7. 所有任务默认在同一张画布可见；即使按任务团分层，也是在同一视图内通过背景图层或泳道区分。
8. 编辑模式下用户拖动的是展示位置，不应改变任务父子关系或依赖关系；结构改变必须通过明确的“移动任务”或“建立依赖”操作完成。

### 7.4 基础图层展示规则

图视图的“最基本设计”应遵守以下规则：

1. **任务团定义**：一个任务团由一个顶层任务、它的全部后代任务，以及这些任务之间的内部依赖构成。如果某个任务团与其他任务团之间不存在依赖边，则它是独立无依赖任务团。
2. **独立任务团单独图层**：每个独立无依赖任务团使用独立的视觉图层或泳道展示。图层之间用背景色、边框、标题条或分隔线区分，但仍处在同一张画布里。
3. **纵向拆解**：同一任务团内，父任务在上，子任务在下，后代任务按深度继续向下展开。用户应能通过纵向位置直观看出任务是如何被拆解的。
4. **横向依赖**：同一任务团内，前置任务在左，后续任务在右。依赖边 `A -> B` 必须让 A 的视觉位置不晚于 B。
5. **并行任务**：没有直接或间接依赖关系的同层任务可以位于相近的横向层级，通过纵向或轻微错位避免重叠。
6. **跨任务团依赖**：一旦两个任务团之间建立依赖，它们不再是完全独立任务团。布局应显示跨层依赖线，并在必要时把两个任务团对齐到相同的先后顺序坐标系中。
7. **图层标签**：每个任务团图层应显示任务团名称、ready 数、blocked 数、完成进度和关键阻塞摘要。

### 7.5 关系视觉编码

任务之间至少存在三类需要被区分的关系：

| 关系 | 含义 | 建议视觉表达 | 交互说明 |
|---|---|---|---|
| 父子拆解 | A 被拆成 A1、A2 | 垂直缩进、淡色树线、容器背景、任务团图层 | 点击父任务可高亮全部后代 |
| 先序依赖 | A 必须先于 B 完成 | 有向箭头、实线、从左到右、依赖色 | 悬停边时显示“完成 A 后解锁 B” |
| 阻塞状态 | B 当前被 A 或子任务阻塞 | blocked 节点红/琥珀强调、阻塞边高亮、原因提示 | 点击 blocked 状态可展开阻塞原因 |
| 聚合完成 | 子任务决定父任务完成度 | 父节点进度环或进度条、子任务完成比例 | 悬停父任务显示未完成子任务 |
| 手动布局 | 用户调整过位置 | 节点角标或工具条状态提示 | 提供“恢复自动布局” |

视觉编码原则：

1. 父子拆解线不得使用与依赖边相同的样式。
2. 依赖边必须有明确方向，不能只靠位置暗示。
3. blocked 的原因应同时通过颜色和文本/tooltip 表达，不能只依赖颜色。
4. ready、blocked、active、done、canceled 的状态色应与图节点、路线图、Ready Queue 保持一致。

---

## 8. 工程目录建议

```text
src/
  app/
    App.tsx
    routes.tsx
  components/
    task-tree/
      TaskTreeView.tsx
      TaskTreeItem.tsx
      TaskContextMenu.tsx
    graph/
      GraphView.tsx
      GraphNode.tsx
      GraphEdge.tsx
      layoutGraph.ts
    ready-queue/
      ReadyQueueView.tsx
    inspector/
      TaskInspector.tsx
      DependencyEditor.tsx
  domain/
    models/
      project.ts
      task.ts
      dependency.ts
    services/
      graphService.ts
      taskTreeService.ts
      readyQueueService.ts
      importExportService.ts
    validators/
      projectSchema.ts
      taskSchema.ts
      dependencySchema.ts
  repositories/
    ProjectRepository.ts
    TaskRepository.ts
    DependencyRepository.ts
    indexedDb/
      db.ts
      IndexedDbProjectRepository.ts
      IndexedDbTaskRepository.ts
      IndexedDbDependencyRepository.ts
  state/
    projectStore.ts
    taskStore.ts
    graphStore.ts
    uiStore.ts
  tests/
    unit/
    integration/
  e2e/
```

### 8.1 分层约束

1. `components/` 只能调用 hooks 或 store，不直接写 IndexedDB。
2. `domain/services/` 放纯业务逻辑，必须尽量无副作用，便于单元测试。
3. `repositories/` 负责持久化。
4. `state/` 负责把 repository 与 UI 连接起来。
5. graph 算法不得写在 React 组件里。

---

## 9. 状态管理设计

### 9.1 Store 划分

| Store | 职责 |
|---|---|
| `projectStore` | 当前项目、项目列表、项目设置 |
| `taskStore` | 任务 CRUD、任务树、选中任务 |
| `graphStore` | 依赖边、DAG 派生状态、ready queue |
| `uiStore` | 视图模式、折叠节点、面板状态、图缩放状态 |

### 9.2 派生数据

下列内容不应直接作为主数据存储：

1. computedStatus。
2. rollupStatus。
3. ready queue。
4. topological order。
5. blocked reasons。
6. graph layout positions。

图布局坐标可以缓存，但必须能重新生成。

---

## 10. 图可视化实现方案

### 10.1 React Flow 节点映射

```ts
function toReactFlowNodes(tasks: Task[], derived: Map<string, DerivedTaskState>) {
  return tasks.map(task => ({
    id: task.id,
    type: 'taskNode',
    position: { x: 0, y: 0 },
    data: {
      task,
      derivedState: derived.get(task.id)
    }
  }));
}
```

### 10.2 React Flow 边映射

```ts
function toReactFlowEdges(edges: DependencyEdge[]) {
  return edges.map(edge => ({
    id: edge.id,
    source: edge.fromTaskId,
    target: edge.toTaskId,
    type: 'smoothstep',
    animated: false
  }));
}
```

### 10.3 自动布局

基础展示可使用 dagre，但布局语义必须由 Questack 自己定义清楚，不能只依赖 dagre 的默认排列：

1. 输入节点宽高。
2. 输入有向边。
3. 设置方向 `LR` 作为默认依赖方向，即从左到右表示前后顺序。
4. 按顶层任务和跨任务团依赖识别任务团。
5. 给每个独立无依赖任务团分配单独的视觉图层或泳道。
6. 在每个任务团内部，根据父子深度计算纵向基准，根据拓扑 rank 计算横向基准。
7. 输出节点坐标。
8. 写回 React Flow nodes 的 `position`。

当节点数量较大时，布局计算可以放入 Web Worker。

### 10.4 坐标语义与图层算法

图视图的默认自动布局应满足：

1. **Y 轴表示拆解深度**：根任务位于任务团图层顶部，子任务向下展开。`depth = 0` 的任务在最上方，`depth = 1` 的任务在其下方，依此类推。
2. **X 轴表示依赖顺序**：拓扑 rank 越小越靠左，拓扑 rank 越大越靠右。若存在 `A -> B`，B 的 X 坐标应大于或等于 A 的 X 坐标，并通过边线明确方向。
3. **独立任务团分层**：没有跨任务团依赖的顶层任务团应拥有独立图层。图层可以纵向堆叠，也可以以泳道方式排列，但必须在同一画布中同时可见。
4. **同层并行任务排布**：同一深度、同一拓扑 rank 的任务可以在局部纵向错开，避免重叠，并保持父子树可读。
5. **父节点聚合位置**：父任务应位于其子任务群的上方或左上方，视觉上成为该子树的标题/容器，不应被排到后代任务之后。
6. **跨任务团依赖处理**：如果两个任务团之间出现依赖，布局应优先保证依赖方向正确，再通过跨图层边线说明它们仍属于不同拆解树。

推荐实现步骤：

```ts
export interface TaskLayer {
  id: string;
  rootTaskId: string;
  taskIds: string[];
  incomingLayerIds: string[];
  outgoingLayerIds: string[];
  bounds?: { x: number; y: number; width: number; height: number };
}

export interface TaskLayoutPosition {
  taskId: string;
  x: number;
  y: number;
  source: 'auto' | 'manual';
  updatedAt: string;
}
```

1. 先通过 `parentId === null` 找到顶层任务团。
2. 将每个顶层任务的全部后代归入同一个初始 `TaskLayer`。
3. 检查依赖边是否跨越两个 `TaskLayer`，记录 `incomingLayerIds` 和 `outgoingLayerIds`。
4. 对没有跨层入边和出边的独立任务团分配独立图层。
5. 对每个任务团内部运行拓扑排序，生成横向 rank。
6. 根据任务树深度生成纵向 rank。
7. 将 `x = topoRank * columnWidth`、`y = layerOffset + depth * rowHeight + collisionOffset` 作为初始位置。

### 10.5 编辑模式与位置持久化

图视图应区分两种模式：

| 模式 | 用途 | 行为 |
|---|---|---|
| 自动布局模式 | 快速获得稳定、可解释的默认图 | 位置由布局算法计算；数据变化后可重新布局 |
| 编辑模式 | 用户手动整理画布 | 节点可任意拖动；拖动只改变展示位置，不改变父子或依赖关系 |

编辑模式要求：

1. 所有未归档任务仍显示在同一视图，不因为进入编辑模式而拆成多个页面。
2. 用户拖动节点后，记录 `TaskLayoutPosition.source = 'manual'`。
3. 手动位置应按项目保存，可在刷新后恢复。
4. 新增任务默认进入自动位置；如果父任务或同层任务有手动位置，应尽量放在邻近区域。
5. 提供“恢复当前任务团自动布局”和“恢复全图自动布局”两个操作。
6. 重新自动布局前应提示会覆盖手动位置，或提供撤销。

### 10.6 关系视觉编码实现

建议在 React Flow 层定义不同 node/edge 类型：

| 类型 | React Flow 表达 | 视觉要求 |
|---|---|---|
| `taskNode` | 普通任务节点 | 显示标题、状态、优先级、估时、完成进度 |
| `containerNode` | 父任务/任务团节点 | 更像标题或容器，显示聚合进度和子任务数量 |
| `dependencyEdge` | 先序依赖边 | 实线箭头，从左到右；blocked 时可高亮 |
| `decompositionGuide` | 父子拆解辅助线 | 淡色、细线或背景连接，不使用依赖箭头 |
| `blockedOverlay` | 阻塞解释层 | 高亮阻塞链，并显示前置任务名称 |
| `taskLayerBand` | 任务团图层背景 | 背景色、边框、标题、统计信息 |

颜色和线型建议：

1. 父子拆解：低对比度中性色或虚线树线。
2. 普通依赖：主轮廓色实线箭头。
3. 当前阻塞依赖：错误色或琥珀色高亮，并加粗。
4. ready 任务：青色/成功色边框或左侧状态条。
5. done 任务：降低不透明度，保留可读标题。
6. manual layout 节点：可在节点角落显示小型定位图标或在工具条显示“手动布局中”。

---

## 11. MVP 功能拆解

### Milestone 0：工程初始化

交付物：

1. Vite + React + TypeScript 项目。
2. ESLint、Prettier、Vitest。
3. 基础目录结构。
4. IndexedDB 初始化。
5. 全局错误边界。

验收标准：

1. `npm run dev` 可启动。
2. `npm run test` 可执行。
3. `npm run build` 通过。

### Milestone 1：项目与任务树

交付物：

1. 创建/编辑/删除项目。
2. 创建顶层任务。
3. 创建子任务。
4. 无限层级展示。
5. 折叠/展开任务。
6. 任务详情编辑面板。
7. 手动状态切换。

验收标准：

1. 用户能创建一个项目并添加多层任务。
2. 刷新页面后数据仍然存在。
3. 父任务 rollup 状态正确显示。

### Milestone 2：依赖关系与图算法

交付物：

1. 添加依赖边。
2. 删除依赖边。
3. 环检测。
4. 拓扑排序。
5. Ready Queue 计算。
6. Blocked Reasons 计算。

验收标准：

1. 不能添加会成环的依赖。
2. 完成前置任务后，后继任务自动进入 ready。
3. blocked 任务能展示未完成前置任务。

### Milestone 3：DAG 图视图

交付物：

1. React Flow 画布。
2. 任务节点渲染。
3. 依赖边渲染。
4. 自动布局。
5. 从节点拖线创建依赖。
6. 点击节点打开任务详情。
7. 按状态过滤。
8. 独立无依赖任务团的图层/泳道展示。
9. 编辑模式下节点自由拖动和位置保存。
10. 父子拆解线、依赖边、阻塞高亮的差异化视觉编码。

验收标准：

1. 图能正确展示任务和依赖。
2. 图中建边遵守 cycle check。
3. ready、blocked、done 状态在图中可区分。
4. 所有未归档任务默认出现在同一画布中。
5. 同一任务团内纵向表达拆解层级，横向表达前后依赖顺序。
6. 独立无依赖任务团能被清晰分到不同视觉图层。
7. 用户在编辑模式拖动任务后，刷新页面仍能恢复手动位置。

### Milestone 4：路线图与当前任务

交付物：

1. Ready Queue 页面。
2. Roadmap 页面。
3. 拓扑顺序展示。
4. 任务路径展示。
5. 一键开始/完成任务。

验收标准：

1. 用户进入项目后能立即看到“现在可以做什么”。
2. 用户完成任务后，路线图立即更新。
3. 每个 blocked 任务都能解释阻塞原因。

### Milestone 5：导入导出与数据修复

交付物：

1. 项目导出 JSON。
2. 项目导入 JSON。
3. schema 校验。
4. 数据健康检查面板。
5. 脏边清理。

验收标准：

1. 导出的项目能完整导入。
2. 非法 JSON 不会破坏现有数据。
3. 有环依赖导入会失败并展示错误。

### Milestone 6：体验打磨

交付物：

1. 快捷键。
2. 命令面板。
3. 空状态引导。
4. 大任务树虚拟滚动。
5. 图视图性能优化。
6. 移动端基础适配。

---

## 12. 测试计划

### 12.1 单元测试重点

必须覆盖：

1. `wouldCreateCycle()`。
2. `topologicalSort()`。
3. `computeReadyTasks()`。
4. `computeBlockedReasons()`。
5. 父任务 rollup 状态。
6. 导入 JSON 校验。
7. 删除任务后的依赖边清理。

### 12.2 集成测试场景

1. 创建项目 -> 创建任务树 -> 刷新 -> 数据仍存在。
2. 创建 A、B、C -> 添加 A -> B、B -> C -> 尝试 C -> A 被拒绝。
3. A 阻塞 B -> 完成 A -> B 进入 ready。
4. 删除 A -> A 相关边自动删除 -> 图仍合法。
5. 导入含缺失 taskId 的依赖边 -> 导入失败并提示。

### 12.3 E2E 测试场景

1. 用户创建“开发个人网站”项目。
2. 添加任务：需求整理、设计 UI、实现前端、部署。
3. 建立依赖：需求整理 -> 设计 UI -> 实现前端 -> 部署。
4. 系统显示当前可做：需求整理。
5. 完成需求整理后，系统显示当前可做：设计 UI。
6. 打开 Graph View，看到正确 DAG。

---

## 13. 性能与规模目标

### 13.1 MVP 性能目标

| 场景 | 目标 |
|---|---|
| 任务数量 | 1000 个节点以内流畅 |
| 依赖边数量 | 3000 条以内可接受 |
| Ready Queue 计算 | < 50ms |
| 拓扑排序 | < 100ms |
| 图布局 | 1000 节点内 < 1s；超过后提示用户过滤 |
| 页面刷新后恢复 | < 500ms |

### 13.2 优化策略

1. 使用 memoization 缓存 `taskById`、`childMap`、`adjacency`。
2. 任务树使用虚拟滚动。
3. 图视图默认只显示当前子树或过滤后的节点。
4. 大图布局放入 Web Worker。
5. 对变更操作做增量 recompute，而不是每次全量计算所有派生状态。
6. React Flow 节点组件使用 `memo`，避免全图重渲染。

---

## 14. 非功能要求

### 14.1 可解释性

系统做出的每个判断都必须可解释：

1. 为什么这个任务 ready？
2. 为什么这个任务 blocked？
3. 为什么不能添加这条依赖？
4. 为什么父任务显示完成？

### 14.2 数据安全

MVP 本地版至少提供：

1. 手动导出备份。
2. 导入前预校验。
3. 导入前自动生成现有数据快照。
4. 清空数据二次确认。

### 14.3 可迁移性

1. 业务逻辑不绑定 IndexedDB。
2. 所有 schema 有版本号。
3. 导入导出格式稳定。
4. 为后续服务端同步保留 `updatedAt`、`archivedAt`、`schemaVersion`。

---

## 15. 设计决策记录

### 15.1 为什么不是单纯 Todo List？

Todo List 只能表达任务集合，不能表达“做 B 之前必须完成 A”的图结构。本产品核心是依赖图和 Ready Queue。

### 15.2 为什么父子关系不直接作为依赖？

父子关系表达“组成”，依赖关系表达“顺序”。例如“开发前端”和“开发后端”可能同属一个父任务，但它们可以并行；父子关系不应自动表示先后顺序。

### 15.3 为什么默认只让叶子任务进入 Ready Queue？

父任务通常是抽象目标，不够可执行。Ready Queue 应只展示用户能立刻开始的具体动作，避免“做项目”这类不可执行项。

### 15.4 为什么禁止环？

如果 A 依赖 B，B 又依赖 A，则系统无法判断先做哪个。DAG 是产品成立的核心约束。

---

## 16. Agent 执行指令建议

可以把下面这段直接交给 coding agent：

```text
你要实现一个本地优先的任务路线图 Web 应用。请使用 React + TypeScript + Vite 实现 MVP。

核心模型：Project、Task、DependencyEdge。Task 通过 parentId 构成任务树；DependencyEdge 通过 fromTaskId -> toTaskId 构成任务依赖 DAG。父子关系和依赖关系必须分离。

请先实现以下能力：
1. 创建项目。
2. 在项目内创建无限层级任务树。
3. 编辑任务标题、描述、优先级、状态。
4. 添加和删除依赖边。
5. 添加依赖边时必须防止成环。
6. 使用拓扑排序计算路线图。
7. 只把未完成、未取消、无未完成前置依赖的叶子任务放入 Ready Queue。
8. blocked 任务必须能显示未完成的前置任务。
9. 使用 IndexedDB 持久化数据。
10. 使用 React Flow 展示 DAG 图，并支持自动布局。
11. 提供 JSON 导入导出。
12. 为图算法和 ready queue 计算写单元测试。

请按 domain/services、repositories、state、components 分层，不要把图算法写在 React 组件中。
```

---

## 17. 建议的首批文件实现顺序

1. `src/domain/models/task.ts`
2. `src/domain/models/project.ts`
3. `src/domain/models/dependency.ts`
4. `src/domain/services/graphService.ts`
5. `src/domain/services/taskTreeService.ts`
6. `src/domain/services/readyQueueService.ts`
7. `src/repositories/indexedDb/db.ts`
8. `src/repositories/IndexedDbTaskRepository.ts`
9. `src/state/taskStore.ts`
10. `src/components/task-tree/TaskTreeView.tsx`
11. `src/components/ready-queue/ReadyQueueView.tsx`
12. `src/components/graph/GraphView.tsx`
13. `src/domain/services/importExportService.ts`
14. `src/tests/unit/graphService.test.ts`
15. `src/tests/unit/readyQueueService.test.ts`

---

## 18. 风险清单

| 风险 | 表现 | 处理 |
|---|---|---|
| 父子关系和依赖关系混淆 | 用户以为子任务天然有顺序 | UI 明确区分“拆分”和“依赖” |
| 大图不可读 | 节点过多，图变成毛线团 | 默认过滤子树，支持折叠 group |
| 依赖规则过复杂 | 父任务依赖传播难解释 | MVP 优先叶子任务依赖，父任务依赖作为高级功能 |
| 本地数据丢失 | 用户清浏览器数据导致丢失 | 强化导出备份、导入恢复 |
| 状态冲突 | 手动 todo 但系统 blocked | 分离 manualStatus 和 computedStatus |
| 性能下降 | 大量节点导致重渲染 | 派生数据缓存、虚拟滚动、Web Worker |

---

## 19. 后续增强方向

本节用于指导 MVP 完成后的产品演进。目标不是堆功能，而是把 Questack 从“DAG 任务工具”升级为一个能陪用户完成复杂目标的**执行驾驶舱**：用户打开应用后，能快速知道当前目标处于什么阶段、为什么被卡住、现在最值得做什么，以及完成这一步后会解锁什么。

### 19.1 产品演进原则

1. **先降低执行摩擦，再增加高级能力**：优先补齐创建、拆分、建依赖、完成任务、导入恢复这几条高频路径，再做 AI、协作、模板市场等高级功能。
2. **图是解释工具，不是负担**：DAG 视图应该帮助用户看清顺序、并行和阻塞，而不是要求用户在巨大画布里找信息。
3. **Ready Queue 是默认工作台**：复杂计划最终要落到“现在做哪一个动作”。后续主页和快捷入口应围绕 Ready Queue、当前专注任务、阻塞摘要展开。
4. **所有自动判断都可解释**：ready、blocked、父任务聚合、环检测、冗余边、关键路径和 AI 建议都必须能展开查看依据。
5. **本地优先要给用户安全感**：导入、删除、批量修改、AI 改写前应有快照、预览和撤销。
6. **视觉服务于扫描效率**：这是生产力工具，页面应紧凑、清晰、有层次，避免营销式 hero、大面积装饰和过度戏剧化动画。

### 19.2 功能增强路线

#### P0：体验债修复与可信数据

当前版本已经具备核心能力，但仍有几类会影响用户信任的体验债，应优先处理。

| 能力 | 目标 | 关键交付 |
|---|---|---|
| 应用内对话框 | 替换浏览器原生 `prompt`、`alert`、`confirm` | 新建项目/任务弹窗、删除确认弹窗、建边失败说明弹窗、导入错误弹窗 |
| 完整导入恢复 | 导入后项目、任务、依赖、状态、估时、父子层级均保持一致 | 导入 ID 映射、依赖边重建、字段保留、导入前快照、导入结果摘要 |
| 撤销与安全操作 | 降低误删、误改成本 | Snackbar 撤销、最近操作栈、删除进入回收站、清空/导入前二次确认 |
| 全局反馈系统 | 所有成功、失败、警告都有统一反馈 | Toast/Snackbar、错误详情、操作完成后的“已解锁 N 个任务”提示 |
| 空状态与示例 | 让新用户不用先理解 DAG 概念也能开始 | 场景化示例项目、空任务树引导、空图说明、空队列解释 |
| 基础可访问性 | 键盘和读屏用户可用 | 焦点环、ARIA label、对话框焦点锁、快捷键帮助面板 |

#### P1：执行驾驶舱

让用户每天打开应用时，第一眼看到的是执行上下文，而不是一个抽象的任务数据库。

1. **今日工作台**：展示当前项目的 ready 数量、blocked 数量、进行中任务、最近完成任务和下一步建议。
2. **专注模式**：从 Ready Queue 选择一个任务进入单任务工作界面，显示标题、路径、描述、预计耗时、前后依赖和完成按钮。
3. **时间预算筛选**：用户可选择“我现在有 15/30/60 分钟”，Ready Queue 自动筛选估时合适的任务。
4. **稍后处理**：对 ready task 增加 snooze/稍后，不改变依赖状态，只改变当前队列展示优先级。
5. **完成后的解锁反馈**：完成任务后显示“已解锁：A、B；仍阻塞：C，因为 D 未完成”。
6. **批量操作**：批量标记完成、批量归档、批量设置优先级，用于整理大型计划。
7. **任务搜索与快速定位**：按标题、描述、路径、状态、优先级搜索，并能一键跳到树、图或详情面板。

#### P1：依赖图可读性增强

图视图应继续保持左到右表示先后、同层表示并行的设计，同时增加用于理解复杂图的“镜头”。

1. **子图聚焦**：选中任务后可切换“只看上游阻塞链”“只看下游影响链”“只看同一父任务子树”。
2. **路径高亮**：悬停节点时高亮所有直接前置和后继；点击“查看阻塞链”时高亮导致 blocked 的完整链路。
3. **边标签与方向说明**：边上可显示“先完成”“解锁”，并在首次进入图视图时用轻量提示解释方向。
4. **建边预检**：拖线时在目标节点上预览结果：可连接、会成环、跨层级非法、冗余依赖。
5. **图例和状态筛选增强**：增加状态图例、优先级图例、叶子/容器说明，并支持多条件组合筛选。
6. **大图降噪**：节点超过阈值时默认启用折叠、搜索、按阶段分组或只显示关键路径。
7. **布局记忆**：自动布局仍是默认，但允许用户微调并保存当前视图布局；一键恢复自动布局。

#### P2：规划智能与分析

在不破坏本地优先和可解释性的前提下，加入能帮助用户做决策的分析能力。

1. **关键路径分析**：基于依赖和估时计算影响整体完成时间的最长链路。
2. **风险任务识别**：识别高优先级、长耗时、阻塞多个后继任务、长期未推进的任务。
3. **里程碑视图**：允许把任务或父任务标记为里程碑，在路线图中形成阶段边界。
4. **计划健康度**：显示无估时任务、孤立任务、冗余依赖、长期 blocked 任务、过大的父任务。
5. **执行节奏统计**：按日/周统计完成数量、完成估时、平均阻塞时长、最常见阻塞来源。
6. **Markdown/Mermaid 导出**：导出为可读计划书、周报、Mermaid DAG 和可分享的静态说明。

#### P2：模板与复用

让用户不用每次从空白开始搭建大型计划。

1. **内置模板库**：开发个人网站、准备考试、写论文、发布产品、旅行规划等。
2. **项目另存为模板**：用户可把当前任务树和依赖结构保存为模板，创建新项目时复用。
3. **子树模板**：把某个父任务下的结构保存为模板，例如“上线前检查”“设计评审流程”。
4. **模板导入预览**：导入前展示会新增的任务、依赖和字段，允许取消部分内容。
5. **模板参数化**：项目名、日期、目标平台、技术栈等变量可在创建时填写。

#### P3：AI 辅助与协作

AI 和协作应作为后续层，而不是替代当前可解释的手动模型。

1. **AI 初始拆解**：输入目标后生成任务树草稿，用户确认后再写入数据。
2. **AI 依赖建议**：分析任务标题和描述，建议可能的前置关系，但必须由用户确认。
3. **AI 风险审查**：提示任务过大、缺少验收标准、依赖链过长、关键任务未估时。
4. **AI 周计划生成**：根据 ready task、估时和用户可用时间生成一周执行建议。
5. **账号与同步**：在本地优先成熟后再引入登录、云同步和多设备。
6. **协作模式**：多人分配、评论、变更历史、实时同步和权限控制。

### 19.3 更人性化的核心工作流

#### 新建项目

当前用 `prompt` 输入项目名即可创建，下一阶段应升级为一个短向导：

1. 第一步填写项目名称和目标描述。
2. 第二步选择空白项目、加载示例、使用模板或导入 JSON。
3. 第三步可选设置默认视图、图方向、Ready Queue 排序方式。
4. 创建后直接进入任务树，并给出一个清晰的首个操作入口：“添加第一个阶段”。

验收标准：用户在 30 秒内可以创建一个可开始拆分的项目，不需要理解所有设置。

#### 创建与拆分任务

任务创建应从弹窗式打断，升级为更自然的内联编辑：

1. 在任务树顶部提供“快速添加任务”输入框，回车创建同级任务。
2. 选中任务后按快捷键或点击图标添加子任务，直接进入标题编辑状态。
3. 当用户给叶子任务添加子任务时，界面提示该任务将变成容器任务，不再直接进入 Ready Queue。
4. 拆分已有任务时，提供“保留原描述到父任务”“把描述复制到第一个子任务”“清空子任务描述”选项。
5. 父任务已有依赖时，展示依赖如何处理的说明和可选迁移方案。

验收标准：创建、编辑、拆分都不依赖浏览器原生输入框；用户能理解为什么某个任务从 Ready Queue 消失。

#### 建立依赖

依赖编辑既要适合新手，也要适合熟练用户。

1. 在 Inspector 中保留“前置任务”和“阻塞的任务”两个清晰分区。
2. 下拉选择任务时展示路径、状态和是否已完成，而不是只显示标题。
3. 在图中拖线时使用颜色反馈：绿色可建边、红色会成环、黄色是冗余边。
4. 建边失败时说明具体原因，并提供“查看造成冲突的链路”。
5. 建边成功后短暂高亮新边，并刷新相关节点状态。

验收标准：用户不需要记住 `A -> B` 的技术含义，也能明白“谁必须先完成，谁会被解锁”。

#### 执行任务

Ready Queue 应成为“少想一点，马上做”的界面。

1. 每个 ready task 显示路径、优先级、估时、解锁原因和完成后会影响的下游数量。
2. 支持按优先级、拓扑顺序、估时、创建时间、手动顺序排序。
3. 支持“开始”“完成”“稍后”“拆分”“查看依赖”五个动作。
4. 进入专注模式后隐藏次要导航，保留任务详情、备注、依赖上下文和完成按钮。
5. 完成后用 Snackbar 给出可撤销反馈，并提示新解锁任务。

验收标准：用户可以只看 Ready Queue 完成一天的执行，不必频繁切到图视图理解下一步。

#### 导入、删除与恢复

这些操作必须建立用户信任。

1. 导入前创建快照，并显示导入预览：项目数、任务数、依赖数、冲突数。
2. 导入失败不写入任何数据；导入部分成功不应出现。
3. 删除项目、删除任务、清空数据都进入回收站或提供短期撤销。
4. 设置页提供“导出全部数据”“恢复快照”“清空本地数据”。
5. 数据健康检查面板可以修复孤立边、无效父子引用和重复 ID。

验收标准：用户能放心试用模板、导入示例和整理旧项目，不担心一次操作破坏本地数据。

### 19.4 页面与视觉设计方向

#### 整体信息架构

桌面端维持三栏结构，但需要更明确的页面层级：

1. **左侧导航**：项目列表、视图切换、全局导入导出、设置入口。可折叠为窄导航栏。
2. **中间工作区**：根据视图承载任务树、图、队列、路线图或工作台。
3. **右侧 Inspector**：承载任务详情、依赖、活动、备注、附件等上下文编辑。
4. **顶部工具条**：显示当前视图标题、筛选、排序、搜索、批量操作和视图设置。

移动端不应压缩三栏，而应改为：

1. 底部导航切换任务树、待办队列、路线图、依赖图。
2. Inspector 改为底部抽屉。
3. 依赖图默认只显示选中任务上下游，避免完整大图在小屏不可读。

#### 视觉语言

当前已有 Material Design 3 暗色主题，后续建议形成 Questack 自己的品牌层：

1. **色彩**：保留 M3 暗色基底，但降低页面被单一紫色主导的比例。主色用于选择和主操作，青色用于 ready，红色用于 blocked，琥珀色用于风险和高优先级，灰色用于完成/取消。
2. **形状**：生产力页面中的列表项、任务卡和工具条使用更克制的 6-8px 圆角；对话框和浮层可保留更大的 M3 圆角。
3. **字体层级**：列表、卡片、节点内标题保持紧凑；只有空状态和项目概览使用较大标题。
4. **图标体系**：引入一致的图标库，例如 `lucide-react`，替换裸字符 `+`、`x`、文本式 Material Symbol 名称和散落 emoji。
5. **动效**：只用于状态变化、解锁反馈、弹窗进入、图节点高亮和列表重排，避免无意义装饰。
6. **密度**：提供“舒适 / 紧凑”两种密度，大任务树和路线图默认偏紧凑。

#### 关键组件设计

| 组件 | 设计目标 | 行为 |
|---|---|---|
| App Dialog | 替代原生浏览器弹窗 | 支持标题、说明、危险态、确认输入、焦点锁 |
| Snackbar | 操作反馈和撤销 | 成功/失败/警告统一出口，删除和完成可撤销 |
| Command Palette | 快速导航与操作 | `Ctrl+K` 打开，支持搜任务、切视图、创建任务、导出 |
| Quick Add | 降低输入成本 | 任务树和 Ready Queue 都可快速创建任务 |
| Status Legend | 降低状态理解成本 | 图视图和路线图固定提供 ready/blocked/done/active 说明 |
| Path Breadcrumb | 帮助定位任务层级 | Inspector 和队列卡片显示可点击路径 |
| Focus Panel | 支持当下执行 | 单任务详情、前置完成情况、下游影响、完成按钮 |
| Health Banner | 暴露数据问题 | 检测孤立边、环、无效引用和导入风险 |

### 19.5 数据模型扩展建议

后续功能会要求主数据模型逐步扩展，但必须保持 schema 版本化和迁移脚本。

```ts
export interface Task {
  // existing fields...
  note?: string;
  tags?: string[];
  checklist?: TaskChecklistItem[];
  scheduledAt?: string | null;
  snoozedUntil?: string | null;
  completedAt?: string | null;
  canceledReason?: string | null;
}

export interface TaskChecklistItem {
  id: string;
  title: string;
  done: boolean;
  sortOrder: number;
}

export interface ActivityEvent {
  id: string;
  projectId: string;
  taskId?: string | null;
  type: 'task_created' | 'task_updated' | 'task_completed' | 'dependency_added' | 'import_completed';
  message: string;
  createdAt: string;
  undoPayload?: unknown;
}

export interface DataSnapshot {
  id: string;
  label: string;
  reason: 'manual' | 'before_import' | 'before_delete' | 'before_bulk_edit';
  createdAt: string;
  schemaVersion: number;
  payload: unknown;
}
```

新增字段的原则：

1. `computedStatus`、`ready queue`、`blocked reasons` 仍然保持派生，不进入主存储。
2. 用户明确输入或操作产生的事实可以存储，例如 `completedAt`、`snoozedUntil`、`tags`。
3. 导入导出 schema 必须包含版本号，并提供从旧版本升级到新版本的迁移函数。
4. 活动日志和快照可先保存在 IndexedDB，后续服务端同步时再迁移。

### 19.6 后 MVP 里程碑

#### Milestone 7：交互现代化

交付物：

1. 应用内 Dialog/Snackbar 基础组件。
2. 新建项目、创建任务、删除确认、建边错误全部替换原生弹窗。
3. 统一错误与成功反馈。
4. 删除任务和完成任务支持撤销。
5. 快捷键帮助面板。

验收标准：

1. 核心操作不再调用 `prompt`、`alert`、`confirm`。
2. 错误提示能说明原因和下一步动作。
3. 用户误删任务后可以在短时间内撤销。

#### Milestone 8：完整数据安全与导入导出 2.0

交付物：

1. 导入预览和全量字段保留。
2. 依赖边、父子层级、状态、估时、优先级完整恢复。
3. 导入前自动创建快照。
4. 快照列表与恢复入口。
5. 数据健康检查面板。

验收标准：

1. 导出后重新导入，任务数、依赖数、状态和拓扑顺序与原项目一致。
2. 非法导入不会写入任何部分数据。
3. 用户可以恢复导入前快照。

#### Milestone 9：执行驾驶舱与专注模式

交付物：

1. 今日工作台视图。
2. Ready Queue 排序、筛选和时间预算。
3. 专注模式。
4. 完成任务后的解锁反馈。
5. 稍后处理和队列隐藏。

验收标准：

1. 用户能从工作台直接开始执行，不必先进入任务树。
2. 完成一个任务后，系统明确显示解锁结果。
3. 用户可按当前可用时间选择合适任务。

#### Milestone 10：图视图可读性升级

交付物：

1. 上游/下游/阻塞链子图镜头。
2. 节点悬停路径高亮。
3. 建边预检反馈。
4. 图例、状态说明和多条件筛选。
5. 大图折叠与子树聚焦。

验收标准：

1. 选中 blocked 任务后，用户能一键看清它为什么被阻塞。
2. 拖线建边前就能知道是否合法。
3. 1000 节点项目默认不会直接展示成不可读全图。

#### Milestone 11：视觉系统与响应式适配

交付物：

1. 图标库接入与图标按钮替换。
2. 浅色/暗色主题切换。
3. 舒适/紧凑密度切换。
4. 移动端底部导航和 Inspector 抽屉。
5. 空状态、加载态、错误态、骨架屏规范。

验收标准：

1. 桌面端和移动端没有文本溢出、按钮拥挤或面板遮挡。
2. 所有按钮和图标有 tooltip 或可访问名称。
3. 页面在浅色和暗色主题下都有足够对比度。

#### Milestone 12：分析、模板与 AI 辅助

交付物：

1. 关键路径和计划健康度。
2. 内置模板库与项目另存为模板。
3. Markdown/Mermaid 导出。
4. AI 拆解草稿。
5. AI 依赖建议与风险审查。

验收标准：

1. AI 只生成草稿或建议，不未经用户确认直接改写项目。
2. 关键路径和风险提示能展开解释依据。
3. 模板导入可以预览和取消。

### 19.7 设计验收清单

每次实现新的产品功能或页面改版时，至少检查：

1. 这个功能是否让用户更快知道下一步该做什么。
2. 是否有清晰的空状态、错误状态、成功反馈和撤销路径。
3. 是否解释了系统判断，而不是只给一个状态标签。
4. 是否能在任务很多、依赖很多、标题很长时保持可读。
5. 是否同时照顾鼠标、键盘和小屏用户。
6. 是否避免把父子关系和依赖关系在 UI 中混淆。
7. 是否保留本地数据安全边界：预览、快照、撤销、导出。

### 19.8 后续 Agent 执行提示

可以把下面这段交给 coding agent 作为下一阶段总目标：

```text
当前 Questack 的核心 MVP 已经完成。下一阶段不要重做基础架构，而是在现有 React + TypeScript + Vite + Zustand + Dexie + React Flow 架构上，优先推进交互现代化、数据安全、执行驾驶舱和视觉系统升级。

第一优先级：
1. 替换所有 prompt/alert/confirm 为应用内 Dialog、Snackbar 和错误说明。
2. 修复并增强 JSON 导入：完整恢复任务字段、父子层级、依赖边、状态、估时和优先级；导入前创建快照。
3. 为 Ready Queue 增加排序、时间预算筛选、稍后处理、完成后解锁反馈。
4. 为图视图增加上游/下游/阻塞链聚焦、路径高亮、建边预检和图例。
5. 引入一致的图标体系，替换裸字符按钮和不稳定的文本式图标。

约束：
- 不破坏现有 domain/services、repositories、state、components 分层。
- graph 算法仍保持在 domain/services 或 graph 专用模块，不写进 React 组件。
- 所有数据模型扩展必须更新导入导出 schema、迁移逻辑和单元测试。
- 所有高风险数据操作必须支持预览、快照或撤销。
- 新页面必须同时检查桌面和移动端布局。
```

---

## 20. CI/CD 与部署

### 20.1 GitHub Actions 自动部署到 GitHub Pages

项目通过 GitHub Actions 实现 push 即部署。配置文件位于 `.github/workflows/deploy.yml`。

#### 工作流触发条件

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
```

每次推送到 `main` 分支，或手动触发 `workflow_dispatch`，都会执行构建和部署流程。

#### 流水线步骤

| 步骤 | 说明 |
|---|---|
| `actions/checkout@v4` | 拉取仓库代码 |
| `actions/setup-node@v4` | 设置 Node.js 20 环境，启用 npm cache |
| `npm ci` | 严格按 lock 文件安装依赖，保证 CI 环境与本地一致 |
| `npm run build` | TypeScript 编译 + Vite 生产构建，输出到 `dist/` |
| `npm test` | 运行 Vitest 单元测试（38 个用例），任一失败则流水线中断 |
| `upload-pages-artifact@v3` | 将 `dist/` 目录上传为 Pages 部署制品 |
| `deploy-pages@v4` | 将制品部署到 GitHub Pages |

#### 完整 Workflow 文件

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm test
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
```

### 20.2 Vite 基础路径配置

由于部署到 GitHub Pages 的路径为 `https://<username>.github.io/<repo>/`，需要在 `vite.config.ts` 中设置 `base`：

```ts
export default defineConfig({
  plugins: [react()],
  base: '/Questack/',
  // ...
});
```

### 20.3 GitHub Pages 启用步骤

在仓库的 **Settings → Pages** 中：

1. **Source** 选择 `GitHub Actions`
2. 推送代码到 `main` 分支后，Actions 自动运行
3. 部署完成后，站点 URL 在 Actions 日志或 Settings → Pages 中可见

### 20.4 依赖同步注意事项

`npm ci` 要求 `package.json` 与 `package-lock.json` 严格同步。任何对 `package.json` 的手动修改必须随后运行 `npm install` 更新 lock 文件并一并提交。

关键依赖清单（确保不被遗漏）：

| 依赖 | 用途 |
|---|---|
| `zustand` | 状态管理 |
| `@xyflow/react` | DAG 图可视化 |
| `dagre` | 有向图自动布局 |
| `dexie` | IndexedDB 封装 |
| `zod` | 运行时 schema 校验 |
| `uuid` | 任务/项目 ID 生成 |
| `@types/dagre` | dagre TypeScript 类型 |

---

## 21. 官方资料参考

以下资料用于确认推荐技术栈和实现方向：

1. Vite 官方文档：`https://vite.dev/`
2. React Flow / xyflow 官方文档：`https://reactflow.dev/`
3. MDN IndexedDB 文档：`https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API`
4. dagre 官方仓库：`https://github.com/dagrejs/dagre`
5. Zod 官方文档：`https://zod.dev/`
6. Playwright 官方文档：`https://playwright.dev/`
7. GitHub Pages 文档：`https://docs.github.com/en/pages`
8. GitHub Actions 文档：`https://docs.github.com/en/actions`
