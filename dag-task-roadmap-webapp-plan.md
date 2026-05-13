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

用途：查看和编辑依赖 DAG。

功能：

1. 节点展示任务标题、状态、优先级、完成进度。
2. 边表示先序依赖。
3. 支持从节点拖出连线建立依赖。
4. 建边前调用 cycle check。
5. 支持自动布局。
6. 支持按子树、状态、优先级过滤。
7. 支持点击节点打开右侧任务详情。

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

MVP 可使用 dagre：

1. 输入节点宽高。
2. 输入有向边。
3. 设置方向 `TB` 或 `LR`。
4. 输出节点坐标。
5. 写回 React Flow nodes 的 `position`。

当节点数量较大时，布局计算可以放入 Web Worker。

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

验收标准：

1. 图能正确展示任务和依赖。
2. 图中建边遵守 cycle check。
3. ready、blocked、done 状态在图中可区分。

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

1. **AI 拆解任务**：输入目标后自动生成初始任务树，用户再手动校正。
2. **关键路径分析**：基于估时计算项目最短完成路径。
3. **时间计划**：把 ready task 拖到日历上。
4. **游戏化系统**：经验值、连续完成、成就、任务链。
5. **模板市场**：常见目标模板，例如“开发 App”、“写论文”、“准备考试”。
6. **多项目依赖**：支持项目之间的任务依赖。
7. **协作模式**：多人分配、评论、实时同步。
8. **版本历史**：任务树和 DAG 的变更记录。
9. **Mermaid 导出**：把 DAG 导出为 Mermaid 图。
10. **Markdown 计划导出**：把路线图导出为可读文档。

---

## 20. 官方资料参考

以下资料用于确认推荐技术栈和实现方向：

1. Vite 官方文档：`https://vite.dev/`
2. React Flow / xyflow 官方文档：`https://reactflow.dev/`
3. MDN IndexedDB 文档：`https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API`
4. dagre 官方仓库：`https://github.com/dagrejs/dagre`
5. Zod 官方文档：`https://zod.dev/`
6. Playwright 官方文档：`https://playwright.dev/`

