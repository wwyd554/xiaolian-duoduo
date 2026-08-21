# 方案 A 改造计划：AI 销售陪练系统去 AWS 化

> 项目：`sample-ai-sales-roleplay-main`（AWS 官方样例，已完成 90% 中文化）
> 目标：去除全部 AWS 依赖，改造为可部署在火山引擎的中文销售陪练助手
> 版本：v1.0（2026-08-21 定稿）

---

## 1. 决策记录

| 决策项 | 结论 | 备注 |
|---|---|---|
| 大模型 | **DeepSeek API**（OpenAI 兼容接口） | 接口层抽象，后续可无损切换豆包/千问 |
| 用户体系 | **邀请码制**（不做完整登录注册） | 输邀请码+昵称 → 发 JWT |
| 视频分析 | **砍掉**（先跑通核心） | 后续需要可用 Qwen-VL 补 |
| 部署目标 | **火山引擎云服务器** | docker-compose 部署 |
| 语音合成 TTS | **火山引擎 TTS**（豆包音色） | 开发期可用 edge-tts 免费方案顶替 |
| 语音识别 ASR | **火山引擎流式 ASR** | 镜像原 WebSocket 架构；浏览器自带识别在国内 Chrome 不可用，弃用 |

## 2. 架构对比

```
改造前（AWS）                          改造后（火山引擎 + DeepSeek）
─────────────────────────            ─────────────────────────
React 前端                            React 前端（保留，仅换服务层）
  → Cognito/Amplify 认证               → 邀请码 + JWT
  → AgentCore Runtime（AI 代理）        → FastAPI /agents/* 端点
  → API Gateway + 15 个 Lambda         → FastAPI 业务网关（逻辑移植）
  → Bedrock Claude                     → DeepSeek API
  → Polly TTS                          → 火山引擎 TTS（含口型数据）
  → Transcribe 流式 ASR（WebSocket）    → 火山引擎流式 ASR（WebSocket）
  → DynamoDB + S3                      → SQLite + 本地文件目录
```

**100% 保留的资产**：18 个中文场景数据、5 套中文提示词、811 条 UI 文案、3D 虚拟形象组件、实时情绪仪表盘、29k 行前端代码主体。

## 3. 新项目结构

```
sales-coach/（改造后）
├── frontend/          # 原 React 前端（改 5 个服务文件）
│   └── src/services/  # AuthService / AgentCoreService / ApiService
│                      # / TranscribeService / PollyService
├── server/            # 【新建】FastAPI 后端（替代 Lambda+API Gateway+AgentCore）
│   ├── main.py        # 入口 + 路由
│   ├── auth/          # 邀请码 + JWT
│   ├── agents/        # 5 个 AI 代理（提示词从 cdk/agents/ 原样搬过来）
│   │   ├── npc_conversation.py
│   │   ├── realtime_scoring.py
│   │   ├── feedback_analysis.py
│   │   └── llm.py     # DeepSeek 客户端抽象
│   ├── api/           # scenarios / sessions / rankings / avatars / tts / stt
│   ├── db/            # SQLite（SQLAlchemy）
│   ├── storage/       # 本地文件存储（替代 S3）
│   ├── tts/           # 火山 TTS + edge-tts 双实现
│   └── data/          # scenarios.json 种子数据
├── docker-compose.yml
└── 改造计划.md         # 本文档
```

## 4. 分阶段任务

### 阶段 0：准备（0.5 天）
- [ ] 注册 DeepSeek 开放平台，充值拿 API key
- [ ] 注册火山引擎，开通语音合成 + 流式语音识别（都有免费额度）
- [ ] 确认火山引擎云服务器规格（2C4G 起步够用，无 GPU 需求）
- [ ] 建 git 分支 `local-deploy`，初始化 server/ 骨架

### 阶段 1：后端骨架 + 数据层（2-3 天）
- [ ] SQLite 建表：users / invite_codes / scenarios / sessions / messages / rankings
- [ ] 移植 scenarios 业务逻辑（Lambda `cdk/lambda/scenarios/` → FastAPI），导入 18 个中文场景种子数据
- [ ] 移植 sessions 会话管理逻辑（Lambda `cdk/lambda/sessions/`）
- [ ] 本地文件存储接口（上传/下载/签名 URL 的本地等价物——直接返回本地路径或短期 token URL）
- [ ] 前端 `ApiService.ts`：替换 baseUrl 与认证头（接口路径尽量保持一致，减少前端改动）
- **验收**：前端能列出 18 个场景、能创建会话（打字对话此时还是报错，正常）

### 阶段 2：核心对话链路 ⭐（3-4 天，最关键里程碑）
- [ ] 移植 `npc-conversation` 代理：提示词原样搬，`strands + BedrockModel` → `openai` SDK 调 DeepSeek
- [ ] 移植 `realtime-scoring` 代理：同样处理（评分 JSON 解析逻辑一并搬）
- [ ] 会话历史：AgentCore Memory → SQLite messages 表
- [ ] 前端 `AgentCoreService.ts`：改调本地 `/agents/npc-conversation`、`/agents/realtime-scoring`
- [ ] 前端 `AuthService.ts`：邀请码登录界面（简单弹窗：邀请码 + 昵称）+ JWT 存取
- [ ] 邀请码管理：管理员 CLI 命令生成（如 `python -m server.auth.gen_code --count 20`）
- **验收**：选场景 → 打字对话 → NPC 中文回复 → 愤怒/信任/进度条实时变化 → 建议回复出现

### 阶段 3：语音链路（2-3 天）
- [ ] TTS：火山引擎合成接口封装（含口型/时间戳数据 → 转成前端 visemes 格式）；开发期用 edge-tts 顶替
- [ ] 前端 `PollyService.ts`：改调本地 `/tts/convert`（保留 viseme 数据结构，3D 唇形同步不破坏）
- [ ] ASR：FastAPI WebSocket 端点 → 转发火山引擎流式识别 → 按原 Transcribe 消息格式回传前端
- [ ] 前端 `TranscribeService.ts`：改连本地 WebSocket
- **验收**：麦克风说话 → 实时转文字 → NPC 语音回复 + 3D 形象嘴唇同步

### 阶段 4：反馈报告（2 天）
- [ ] 移植 `feedback-analysis` 代理（会话后总结报告）
- [ ] 移植 sessionAnalysis 逻辑（成绩页数据组装）
- **验收**：会话结束后 ResultPage 完整显示：得分、各目标达成情况、改进建议

### 阶段 5：次要功能（3-5 天，按需取舍）
- [ ] 排行榜（rankings Lambda 逻辑移植）
- [ ] VRM 头像上传管理（本地文件存储）
- [ ] 场景创建/编辑页打通（阶段 1 已有后端，此处验证前端流程）
- [ ] **场景生成器 ⭐（2026-08-21 用户确认事项 3）**：上传行业资料 → 现场生成场景草稿 → 人工审核入库
  - 后端 `POST /scenarios/generate`：接收资料文件（PDF/Word/Markdown/TXT，本地 pdfium/python-docx 提取文本）+ 行业/角色/训练目标/难度参数
  - 调 LLM（T2 模型，单次调用）按场景 schema 输出结构化草稿 JSON（title/description/npc/objectives/goals/initialMetrics/maxTurns/guardrail），强约束输出
  - 前端"场景生成预览页"：草稿可逐字段编辑 → 管理员确认 → 入库（状态 publish 才出现在场景列表，草稿不入库）
  - 新增 LLM 调用点 1 个（管理员低频操作，成本可忽略）
- [ ] 合规检查：Guardrails → 简化为提示词判断（LLM 检查话术违规），或直接砍掉
- [ ] PDF/幻灯片上传（本地存储 + pdf 转图片，用 pdfium 本地转）
- ~~视频分析~~（已砍）

### 阶段 6：收尾与部署（1-2 天）
- [x] NPC 名字本地化：16 个角色、6 个公司名、开场白/目标/判定标准同步（已完成，git `27e97f5`）
- [x] 场景库定稿：6 个金融场景中国语境化重写 + 删 aws-summit-demo + 删英文场景 + AI-DLC 去 AWS 表述（已完成，17 个中文场景）
- [ ] 清理前端日文 console 日志（P1，约 160 行）
- [ ] docker-compose：前端镜像（nginx 静态托管）+ 后端镜像 + SQLite/文件数据卷
- [ ] 部署到火山引擎服务器，配域名 + HTTPS
- [ ] 更新 README，写部署手册

**总工作量：约 10-15 个工作日**

## 5. 风险与备选

| 风险 | 影响 | 备选方案 |
|---|---|---|
| 火山 TTS 口型数据格式与 Polly visemes 不一致 | 3D 唇形同步失真 | 用音素/字级时间戳推导 viseme 映射表；实在不行唇形用幅度随机动画 |
| DeepSeek 角色扮演出戏（提设定、说英文） | 陪练沉浸感下降 | 提示词加硬约束 + 温度调低；换豆包模型（同一抽象层，改配置即可） |
| 前端 Amplify 依赖剥离比预期深（Cognito 散布在页面里） | 阶段 2 延期 | 全局 grep Amplify 引用逐个摘除，保留接口签名不变的本地 mock |
| SQLite 并发写锁（多人同时用时） | 50+ 人规模性能瓶颈 | 开 WAL 模式；再不够就迁火山引擎 RDS PostgreSQL |
| scenarios.json 中 `npcs` 数组与场景内联 npc 不一致（交接文档已知坑） | 场景数据混乱 | 以内联 npc 为准，写一次性清洗脚本 |

## 6. 成本估算（运行期）

**会话轮次上限：20 轮**（2026-08-21 确认，后端强制限制；超限自动进入结束/评分流程）

**LLM 调用点清单**（会话内高频 + 首尾低频）：

| 调用点 | 频率 | 说明 |
|---|---|---|
| NPC 对话生成 | 每轮 1 次 × 20 轮 | 主链路 |
| 实时评分（情绪/进度/建议） | 每轮 1 次 × 20 轮 | 与 NPC 对话并行 |
| 反馈分析报告 | 会话结束 1 次 | |
| s17 目标达成判断 | 会话结束 1 次 | 可与反馈分析合并为一次调用（优化项） |
| s09 记忆提取 | 会话结束 1 次 | 写入学员画像 |
| s09 记忆召回 | 会话开始 1 次 | 可用关键词匹配替代，不调模型 |
| **场景生成器**（阶段 5 新增） | 管理员每生成 1 个场景 1 次 | 上传行业资料 → 生成场景草稿，低频 |

即：**一次完整陪练 ≈ 40+3 次 LLM 调用**；砍掉视频分析、音频分析（MVP 不做，音频分析说话人识别由火山 ASR 结果推导）。

| 项目 | 费用 |
|---|---|
| 火山引擎服务器 2C4G | 约 ¥100-200/月 |
| DeepSeek API（每次陪练约 43 次调用，人均每天 2-3 次陪练） | 约 ¥5-30/月 |
| 火山 TTS + ASR（都有免费额度，超出后按量） | 约 ¥10-50/月 |
| **合计** | **约 ¥150-300/月**（对比 AWS 方案可省 80%+） |

## 7. 待办确认事项（开发中随时对齐）

1. 邀请码的发放方式：CLI 生成够不够？还是要一个简单的管理页面？
2. 3D 形象默认 VRM 模型：原项目自带日系模型，是否需要换？
3. 合规检查（Guardrails 简化版）：保留还是砍掉？（s03/s04 已定引入，具体落地形态阶段 5 定）

**已确认事项（2026-08-21）**：
- ~~4. 场景内容审查~~ → ✅ 已执行完毕：6 个金融/证券场景已按中国语境重写（A股/公募基金/个人养老金/企业年金，删除 NISA/日元/税制表述）；`aws-summit-demo` 已删（含 e2e 测试）；英文场景 `enterprise-cloud-migration` 不保留已删；AI-DLC 场景去除 AWS 出处表述。场景库现为 **17 个中文场景**，`npcs` 数组与内联 NPC 完全一致，全文件零 AWS/NISA/日元残留。
- **定制场景 → 场景生成器**：不做一次性定制，改为"上传行业资料现场生成"（见阶段 5），数据结构复用现有 schema，管理员审核后入库。

## 8. 组件复用：agent-blueprint（2026-08-21 补充）

> 参考库：`~/Desktop/agent-blueprint`（MIT 协议，17 个 Agent Harness 组件参考实现 + 生产级脚手架）
> 关键发现：全部代码基于 Anthropic SDK，而 **DeepSeek 官方提供 Anthropic 兼容端点**（`ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic`），换 DeepSeek 只需改两个环境变量，零代码改动。

### 8.1 确定引入的模块（2026-08-21 用户最终确认：五个全要，仅砍 s07）

| agent-blueprint 模块 | 作用 | 用法 | 阶段 |
|---|---|---|---|
| `scaffold/agent.py`（358行生产级骨架） | strands SDK 模型调用层 | 复用其重试/退避、超时、结构化日志、轨迹采集作为后端 LLM 调用层的底座 | 阶段 2 |
| `s08_context_compact`（499行） | 长对话上下文压缩 | 长陪练对话（20-30 分钟）上下文压缩：先转存→裁剪→占位→摘要，省 token 且不丢剧情关键信息 | 阶段 2 |
| `s09_memory`（757行） | 跨会话记忆 | **增强项（原项目没有的能力）**：跨会话记忆学员弱点（"价格谈判总让步太快"），下次练习注入提示词，实现个性化陪练 | 阶段 4-5 |
| `s03_permission` + `s04_hooks`（241+255行） | 权限/钩子 | 替代 Guardrails：钩子模式在 NPC 输出前拦截审查（合规/越界话术），可阻断重写；用户输入提交前也可校验 | 阶段 5 |
| `s17_goal_loop`（882行） | 目标闭环 | 独立判断器对照场景 `goals`/判定标准评估会话是否达成目标，未达成给出理由继续——替代"NPC 自行宣布结束"的不可靠判定 | 阶段 4 |

**关于原项目记忆系统的说明**（调查结论）：原项目的"记忆"= AgentCore Memory（AWS 托管的按会话事件日志，三个代理共享读写）+ DynamoDB messages 表（前端展示用聊天记录）。它**没有摘要、没有检索、没有跨会话画像**——会话内历史用我们计划中的 SQLite messages 表即可完整替代（不需要 s09）；s09 的价值是补上原来没有的"跨会话学员画像"。

### 8.2 明确不引入的模块

- **s07 技能加载**（用户 2026-08-21 确认不需要）：原方案里它对应"知识库按需加载"，现砍掉，产品资料如需要直接放进场景数据或提示词
- s05 todo / s06 subagent / s10-s13 / s14 MCP / s15 集成 harness / s16 工作流运行时：面向编码 Agent 场景，陪练用不上

### 8.3 复用注意事项

1. **教学代码定位**：每个模块是单文件 CLI 参考实现，需适配——同步改异步（FastAPI async）、单用户改多用户（会话状态按 session_id 隔离）、去掉 CLI 交互部分
2. **Anthropic SDK 全局替换**：复用代码统一走 DeepSeek 的 Anthropic 兼容端点（`ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic`），零代码改动
3. **引入顺序**：scaffold 底座 → s08 压缩（阶段 2）→ s17 目标判断（阶段 4）→ s09 跨会话记忆（阶段 4-5）→ s03+s04 合规钩子（阶段 5）
4. 对工期的影响：scaffold/s08 净省约 1-2 天（调用层和压缩不用从零写）；s17/s09/s03+s04 属于能力增强，合计 +3-4 天，**总工期调整为 13-18 个工作日**
