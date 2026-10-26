# 实验一证据包 · Demo 001

> 本文件用于登记 MindTrace-Agent 的首个可审阅 Demo 证据，对应课程「实验一：项目身份、开发环境与运行证据」。
> 全文数据均为本地演示（DEMO / SAMPLE），不含真实学生资料、生产数据或任何凭据。

## 1. 表单字段速览

| 字段 | 值 |
|---|---|
| GitHub 用户名 | `biggenabw` |
| 仓库地址 | https://github.com/biggenabw/MindTrace-Agent |
| Git Commit SHA | `b9d8ac23a83d5252cbac6ff1f19eebb396141557`（基线提交，说明见第 8 节） |
| Commit 链接 | https://github.com/biggenabw/MindTrace-Agent/commit/b9d8ac23a83d5252cbac6ff1f19eebb396141557 |
| Demo 运行说明 | 见第 3 节，可直接复制 |
| 运行截图 | `docs/evidence/01-home.png`、`02-feedback-a.png`、`03-teacher-view.png` |
| 移动云状态 | 未接入（纯本地运行，无云主机、无域名、无在线 Demo URL） |

## 2. 开发环境（实测）

| 项 | 版本 / 值 |
|---|---|
| OS | Windows（win32），PowerShell |
| Node.js | v24.15.0 |
| npm | 11.12.1 |
| Git | 2.52.0.windows.1 |
| 前端框架 | Vue 3.5 + Vite 7.3.7 + TypeScript 5.8 |
| 测试框架 | Vitest 3.2.7 |
| 监听地址 | `http://127.0.0.1:5173/`（`strictPort: true`，端口被占用时直接报错退出，不会自动换端口） |

> 本机未安装 GitHub CLI（`gh`），远程仓库通过网页创建后以 `git remote add` 绑定。

## 3. Demo 运行说明（可复制提交）

```
项目：MindTrace-Agent（学习反馈证据工作区，纯前端，无后端）
环境：Node.js v24.15.0 / npm 11.12.1 / Git 2.52.0

一、安装依赖
  npm --prefix frontend install

二、启动 Demo（固定端口 5173）
  npm --prefix frontend run dev -- --host 127.0.0.1 --port 5173
  启动成功后终端输出：Local: http://127.0.0.1:5173/
  浏览器打开 http://127.0.0.1:5173/

三、复现证据（与截图一一对应）
  1) 首屏为「过拟合诊断实验室」，可见 CASE 001 与三个指标卡：训练准确率 99% / 验证准确率 78% / 差距 21 pt。
  2) 演示身份选中「学生 A」，在输入框填写：
       这是过拟合，我会正则化并检查验证集
     点击「提交并获得规则反馈」，右侧 TRACEABLE FEEDBACK 面板出现建议，
     底部显示溯源行：已识别过拟合概念 / 来源：当前本地会话 · rule_baseline。
  3) 切换到「学生 B」，填写：
       训练和验证结果不同
     提交后得到不同档位的建议：已注意到训练与验证的差距（证明规则按证据等级分级，而非固定文案）。
  4) 切换到「教师证据视图」，可见学生 A、学生 B 各 1 条记录，
     每条含时间、原回答、规则反馈、mode=rule_baseline、source=current_local_session。

四、验证环境可用性（可选）
  npm --prefix frontend run build   # vue-tsc 类型检查 + vite 生产构建
  npm --prefix frontend test        # vitest 单元测试

五、数据边界
  所有回答仅写入浏览器 localStorage（键名 mindtrace-demo-evidence-v1，上限 100 条），
  不发起任何网络请求，不上传服务器；教师视图只能看到本机当前浏览器的记录；
  教师视图提供「清空本地演示记录」按钮，可随时抹除。
  系统不自动给学生评级，反馈仅为规则提示。
```

## 4. 构建与测试结果（环境可核验）

### 4.1 生产构建

```
> vue-tsc --noEmit && vite build

vite v7.3.7 building client environment for production...
✓ 16 modules transformed.
dist/index.html                 0.36 kB │ gzip:  0.27 kB
dist/assets/index-BeVFzy5G.css  6.68 kB │ gzip:  2.03 kB
dist/assets/index-C3QLmjJZ.js  75.81 kB │ gzip: 30.70 kB
✓ built in 538ms
```

结论：`vue-tsc --noEmit` 无类型错误，构建成功。

### 4.2 单元测试

```
> vitest run

✓ src/adapters/learning.test.ts (2 tests) 6ms

Test Files  1 passed (1)
     Tests  2 passed (2)
  Duration  597ms
```

覆盖内容：不同回答产出不同反馈且携带来源标记；空回答被拒绝。

### 4.3 开发服务器启动日志

原始日志见 `docs/evidence/04-dev-server.log`，关键行（已去除终端颜色转义码）：

```
> mindtrace-agent@0.1.0 dev
> vite --host 127.0.0.1 --port 5173

VITE v7.3.7  ready in 768 ms
➜  Local:   http://127.0.0.1:5173/
```

> 说明：端口 5173 的交叉证据采用**文本日志**而非截图。文本可复制、可检索、可被教师直接比对，比终端窗口截图更难伪造，故第 4 号证据以 `.log` 形式随仓库提交。

## 5. 运行证据截图

三张截图均由无头 Chrome 通过 DevTools Protocol 驱动真实交互后截取，视口 1440px，整页捕获，未经裁剪或修图。

| 文件 | 场景 | 可核验要素 |
|---|---|---|
| `docs/evidence/01-home.png` | 学生区首屏 | `DEMO / SAMPLE` 标签、`CASE 001 · IMAGE CLASSIFICATION`、`TRAIN ACCURACY 99%`、`VALIDATION ACCURACY 78%`、`GAP 21 pt`、反馈面板显示「等待回答」、记录区显示「暂无记录」 |
| `docs/evidence/02-feedback-a.png` | 学生 A 提交后的反馈态 | 输入原文、建议正文「你指出了过拟合并提出改进方向…」、溯源行「已识别过拟合概念 / 来源：当前本地会话 · rule_baseline」、LEARNING EVIDENCE 出现 1 条带时间戳记录 |
| `docs/evidence/03-teacher-view.png` | 教师证据视图 | `TEACHER REVIEW / CURRENT BROWSER`、学生 A 与学生 B 各 1 条回答、两条规则反馈文案不同、每条显示 `rule_baseline` 与 `current_local_session`、`清空本地演示记录` 按钮 |

**关于地址栏**：无头浏览器截图不含地址栏，单图无法自证访问地址。补偿证据为 `04-dev-server.log` 中的 `Local: http://127.0.0.1:5173/`，两者时间戳一致。

## 6. 数据边界与免责

- 页面固定展示 `DEMO / SAMPLE`，页脚标注「本地样例 · 未连接生产服务」，顶栏标注「规则基线 · 本地会话」。
- 演示身份仅 `学生 A` / `学生 B` 两个虚构标识，页内明确标注「DEMO / SAMPLE 身份」。
- 无真实学生姓名、学号、成绩；无生产接口、无账号体系、无鉴权。
- 反馈由关键词规则产生（`source=rule_baseline`），不含大模型推理，不构成真实课堂评价，**不自动给学生评级**。
- 数据仅存于本机浏览器 localStorage，点「清空本地演示记录」即抹除。
- 仓库内不含任何密码、Token、私钥或凭据。

## 7. 已知问题（如实记录）

1. 浏览器控制台存在 1 条 `404 (Not Found)`：来源为 `index.html` 未声明 favicon，浏览器自动请求 `/favicon.ico`。**不影响页面渲染与交互**，本次未修改（超出「只做证据工程」范围）。
2. `docs/ARCHITECTURE.md` 提到 `features/`、`sample-data/` 目录，实际仓库中并不存在，属文档超前于代码，本次未处理。
3. 仓库当前无 LICENSE 文件，公开可见性下的再许可条件仍待仓库所有者确认（见 `docs/LICENSES_AND_PROVENANCE.md`）。
4. 关键词规则对否定句不鲁棒（如「这不是过拟合」仍会命中 `过拟合`），属课程后续任务，本次不修。

## 8. 提交记录

| 项目 | 值 |
|---|---|
| 分支 | `main` |
| 基线 Commit（完整 SHA） | `b9d8ac23a83d5252cbac6ff1f19eebb396141557` |
| 基线 Commit（短 SHA） | `b9d8ac2` |
| Commit 提交时间 | 2026-10-26 14:30:12 +0800 |
| 作者 | `biggenabw` |
| 提交内容 | 25 个文件，2286 行新增 |
| 远程仓库 | https://github.com/biggenabw/MindTrace-Agent |
| 远程协议 | SSH over 443（`ssh://git@ssh.github.com:443/biggenabw/MindTrace-Agent.git`） |
| 推送结果 | `main -> main`，38 objects，1.31 MiB，已建立 upstream 跟踪 |

> 说明：`b9d8ac2` 为包含本文件首个版本的基线提交。由于本文件需要记录自身 SHA，SHA 回填产生的第二个提交位于其之后；请以仓库页面的提交列表为准，两者均指向同一份 Demo 证据。
