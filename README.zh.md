# dsh-sidebar-tags

**给 DeepSeek Harness 侧边栏加一层彩色会话标签。** 在会话行上直接打标签、一眼看到标签、
再在专门的侧栏面板里按标签筛出整批历史会话。

[English](README.md) · [更新记录](CHANGELOG.md) · MIT

---

## 为什么做这个

DSH 用久了，几个工作区里会堆到几百个会话。侧栏能列、能搜、能归档，但没法标记
"这个是客户交付"、"这个周五要回头看"，也没法把这类会话当成一批找回来。

这个插件只补这一层，不多做：

| 能力 | 说明 |
|---|---|
| **行上标记** | 会话行行首一个标签色点（多个标签显示 `+n`） |
| **行上打标** | 会话行 `…` 菜单里一项「打标签…」，行尾悬停还有一个快捷标签按钮，点一下即开关 |
| **悬停可见** | 悬停卡片里列出该会话的全部标签与备注 |
| **标签面板** | 侧栏新增面板：每个标签的会话计数、一点即筛、标题与备注全文搜索、点开跳转会话、新建/改名/改色/删除标签、导出导入备份 |

纯客户端插件：没有宿主路由、不往浏览器外写文件、不注册任何面向模型的内容、
不修改 Harness 的任何自带文件。数据存在 `localStorage`，随时可导出成 JSON。

## 安装

```bash
# 从 npm 安装（发布后）
dsh plugin --profile <profile> add dsh-sidebar-tags

# 从本仓库的检出目录安装
dsh plugin --profile <profile> add link:/本仓库绝对路径
```

然后重启该 profile（或刷新 Web GUI）。侧栏会出现「**会话标签**」。

卸载：

```bash
dsh plugin --profile <profile> remove dsh-sidebar-tags
```

## 使用

1. 悬停任意会话行，点行尾的标签按钮；或打开该行 `…` 菜单选「**打标签…**」。
2. 勾选一个或多个标签，行首立刻出现对应色点。
3. 打开侧栏「**会话标签**」面板：看各标签计数、按标签筛选、搜索标题与备注、
   管理标签本身（改名/改色/删除/新建）。
4. 标签保存在当前浏览器里。面板里的「**导出备份**」可以留一份 JSON，
   换浏览器时用「**导入备份**」恢复。

内置 6 个标签（待办 / 进行中 / 重要 / 参考 / 可归档 / 灵感），都可以改名、改色、
删除，也可以在面板里新建自己的标签。

## 兼容性

| Harness 版本 | 状态 |
|---|---|
| `0.2.0-rc.2` | 已实测（见下文「验证到什么程度」） |
| `0.2.0-rc.1` | 预计兼容（槽位契约相同） |
| 更早的版本线 | 插件静默缺席、不报错：它需要的槽位当时还不存在 |

插件只注册到宿主**已经声明**的槽位（`sidebar.panellist`、keyed `main`、
`sidebar.session.row.leading`、`sidebar.session.row.hover`、
`sidebar.workspaces.session.menu.item`、`sidebar.workspaces.session.row.action`），
且全部通过 `ctx.slots.inject` 注册。宿主没声明该槽位时回调根本不会执行，
所以将来 Harness 改了槽位名，表现是「少一个功能」而不是「启动失败」。

### 已知限制

- **行首色点是"静止态"标记。** 宿主只在会话行主状态为 idle 时才渲染
  `sidebar.session.row.leading`；正在运行、等待审批、有待查看完成的会话，
  那个位置会被宿主自己的状态点占用。此时标签仍然能在**悬停卡片**、
  **行菜单**和**面板**里看到。
- **`localStorage` 按浏览器 profile 隔离。** 清除站点数据会清掉标签；
  隐私窗口里是空的。介意的话请导出备份。
- **在 Harness 之外被删除的会话**可能留下孤儿记录；面板每次打开时会清理
  宿主已不再列出的记录。
- 面板列出的是当前页面已知的会话，加上已记住标题的历史标签会话。

## 验证到什么程度

下面这些都能在检出目录里用普通 Node 跑（不需要打包器、不需要联网）：

```bash
node scripts/build.mjs      # bundle 与 manifest 守卫（24 条不变式）
node scripts/test.mjs       # 34 个单测，单进程运行
node --test tests/          # 同样的测试，走 Node 自带 runner
```

`scripts/verify-browser.mjs <gui-url>` 会用无头 Chromium 通过 DevTools 协议
检查真实页面：样式表是否注入、侧栏面板行是否存在、点击后是否挂载面板页、
面板是否真的渲染出内容 —— CI 里有浏览器时可用。`lab/index.html`
（用 `node tools/serve.mjs` 起静态服务）把同一份 bundle 挂到一个替身外壳里，
不装插件也能看 UI。

**已经实测观察到的：**

- loader 能从 profile 的 `link:` 安装中挂载插件，宿主在该 profile 的启动图里
  下发 `dsh-sidebar-tags/client.js`；
- `scripts/build.mjs` 与单测套件在 Node 24 上全绿；
- 四个行内/面板组件的**注册契约**与全部纯函数（数据模型、校验、迁移、筛选）
  都有单测覆盖。

**尚未实测：** 在真实 Harness 窗口里点完整个面板流程。写这个插件的环境里
浏览器起不来（沙箱限制），这一步请在有桌面环境的机器上第一个做，
`scripts/verify-browser.mjs` 已经把这套检查自动化了。

## 实现方式

```
sidebar.panellist ──► 面板行（图标）              ┐
main (key = sidebar-tags) ──► 面板整页            │  全部经 ctx.slots.inject 注册：
sidebar.session.row.leading ──► 行首色点          │  加载顺序无关；宿主没有该槽位时
sidebar.session.row.hover ──► 标签 + 备注         │  静默缺席，不影响启动
sidebar.workspaces.session.menu.item ──► 选择器   │
sidebar.workspaces.session.row.action ──► 选择器  ┘

localStorage ──► TagsDb ──► 快照 store ──► 组件（React.useSyncExternalStore）
                                  ▲
                     纯函数：校验 / 迁移 / 开关 / 清理 / 筛选
```

面板数据直接读 Harness 自己的 Cordis store（`sessions.list`、
`uiSession.sessionStatus`、`workspaces.list`）的 `getSnapshot()` 与 `subscribe()`
—— 与自带侧栏读的是同一批可观察对象，因此没有额外轮询、RPC 或重复缓存。

### 为什么没有构建步骤

`lib/client.js` 是手写的 CommonJS，外面套一层 Harness loader 要求的调用：

```js
window.__ModuleLoader__.load({ id: 'dsh-sidebar-tags', factory: (require) => { … } })
```

它唯一 require 的模块是 `react`，而每个 Harness 外壳都提供 React。
这意味着**发布产物就是源码**：检出目录可直接安装、可直接审阅，`git diff`
反映的就是行为差异，也没有需要信任或持续维护的工具链。
`scripts/build.mjs` 用一组结构检查替代打包器 —— 外层形状、bundle id 与包名、
patch 行与包名、文件头 region 索引与正文、语法。代价是没有 TypeScript 与
tree-shaking，对这个体量的插件不构成损失；真要迁移，模块边界已经按
`@region` 段落划好了，换 `tsdown` 是机械操作。

## 仓库结构

```
lib/index.js            宿主半侧（空实现：本插件只在浏览器侧工作）
lib/client.js           浏览器半侧 —— 实际发布的 bundle
cordis.patch.yml        把插件挂进 profile 的 bundle patch 层
scripts/build.mjs       bundle 与 manifest 守卫
scripts/test.mjs        单进程测试入口
scripts/verify-browser.mjs  无头 Chromium 冒烟检查
scripts/sandbox-install.mjs 装进隔离 profile（不碰默认 DSH_HOME）
scripts/publish-github.mjs  用 REST API 建仓库并推送（不依赖 git）
tests/                  34 个单测 + 替身外壳 harness
lab/index.html          在浏览器里渲染 bundle 的替身外壳
tools/serve.mjs         给验证台用的临时静态服务器
```

## 参与开发

欢迎提 Issue 和 PR。开 PR 前请先跑
`node scripts/build.mjs && node scripts/test.mjs`；CI 会额外跑浏览器冒烟检查。

## 许可

MIT，见 [LICENSE](LICENSE)。
