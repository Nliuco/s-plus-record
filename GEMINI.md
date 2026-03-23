# GEMINI.md - s-plus-record 项目核心开发宪法

## 1. 项目愿景 (Project Vision)
本项目 `s-plus-record` 是一个专门用于追踪英雄联盟本赛季 S+ 评价英雄的桌面工具。
- **核心目标**: 通过本地 LCU 接口，实时展示用户本赛季已获得 S+ 的英雄，帮助用户明确“全英雄 S+”挑战的进度。
- **技术栈**: Electron + Vue 3 + TypeScript (Vite)。
- **原则**: 零服务器成本、强类型安全、模块化架构。

## 2. 架构规约 (Architectural Standards)
本应用遵循现代前端组件化与分层架构模式，确保代码的逻辑解耦与高可维护性：

| 层级 | 核心概念 | 实现方式 | 职责描述 |
| :--- | :--- | :--- | :--- |
| **视图层 (View)** | **UI 表现层** | `src/renderer/views/` | **纯展示**。负责界面渲染与用户交互，不包含复杂的业务逻辑计算。 |
| **逻辑层 (Logic)** | **领域逻辑 / Hooks** | `src/renderer/composables/` | **业务流程封装**。管理组件内部状态、API 调用逻辑与副作用。 |
| **状态层 (State)** | **全局状态管理** | `src/renderer/stores/` | **跨组件共享**。维护应用级别的全局数据（如用户信息、英雄列表等）。 |
| **服务层 (Service)** | **数据服务 / API** | `src/renderer/api/` | **外部通信**。封装所有 HTTP 请求逻辑，处理认证与原始响应。 |
| **契约层 (Type)** | **类型系统 / Interfaces** | `src/renderer/types/` | **数据结构定义**。定义应用内流转的数据模型，确保全程类型安全。 |

## 3. 核心质量准则 (Quality Mandates)

### 3.1 编码规范
- **TypeScript**: 严禁使用 `any`。所有函数参数和返回值必须有明确类型定义。
- **单向数据流**: Props 只读，通过事件或 Store 修改状态。
- **单一职责**: 单个组件文件原则上不超过 300 行。
- **命名**: 组件使用 `PascalCase`，变量函数使用 `camelCase`，常量使用 `UPPER_SNAKE_CASE`。

### 3.2 教学式开发 (Educational Development)
由于开发者正处于本技术栈的进阶学习阶段，AI 助手在执行任务时需遵循以下原则：
- **主动解释**: 在生成代码后，必须主动提取并解释其中的 **核心知识点**（如：为什么使用特定的 TypeScript 语法、为何选择此架构模式、Vue 的响应式原理等）。
- **避坑提示**: 针对初学者易犯错的场景（如：Electron 的进程通信安全、Vue 的生命周期误用），需给出明确的 **Warning 提示**。
- **关联学习**: 将当前代码实现的模式与通用软件工程设计模式进行关联，帮助开发者建立知识体系。

### 3.3 安全与隔离
- **Electron**: 必须启用 `contextIsolation`。渲染进程禁止直接使用 Node.js API，必须通过 `preload.js` 桥接。
- **隐私**: 严禁将 LCU 的 Token 或敏感数据记录到日志或提交到仓库。

## 4. 目录结构 (Directory Structure)
```text
src/
├── main/              # Electron 主进程 (Node.js 环境)
├── preload/           # 桥接层 (安全隔离)
└── renderer/          # 渲染进程 (Vue 3 前端)
    ├── api/           # Service 层：数据接口
    ├── components/    # 通用 UI 组件
    ├── composables/   # Logic 层：业务逻辑
    ├── stores/        # State 层：全局状态
    ├── types/         # Type 层：强类型定义
    └── views/         # View 层：页面容器
```

## 5. 关键工作流 (Workflows)
- **先思后行 (Plan-First)**: 重大逻辑改动前必须提供 Strategy 方案。
- **验证闭环**: 所有功能开发必须经过本地运行验证。
- **手术式修改**: 保持改动的精确性，不触碰无关代码。

---
*本规约作为项目开发的最高指导原则，所有代码生成必须严格遵守。*
