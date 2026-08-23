# AI 销售陪练系统

## 概要

基于生成式 AI 的销售技能陪练系统：通过与情绪表达丰富的 AI 角色进行语音/文字对话，在实战模拟中提升销售技巧。面向销售新人及进阶销售人员，提供交互式场景演练与数据化复盘。

## 主要功能

- **AI 语音对话**：DeepSeek 驱动的 NPC 对话（支持文字与语音输入）
- **3D 虚拟形象**：VRM 模型 NPC 展示，支持口型同步、情绪表情、手势动画
- **实时语音识别**：WebSocket 流式识别（本地 faster-whisper，生产可切火山引擎）
- **实时情绪反馈**：愤怒度、信任度、商谈进度可视化
- **语音合成**：edge-tts 自然语音朗读，按场景选择音色
- **丰富场景**：17 个内置中文场景 + AI 场景生成器（上传行业资料自动生成）
- **详细复盘报告**：12 维评分、目标达成分析、改进建议
- **会话历史**：历史记录、搜索、评分排序
- **排行榜**：用户间成绩对比
- **多语言**：中文 / 英语 / 日语

## 技术栈

**前端**
- React 19 + TypeScript
- Material UI 7
- Vite 7（构建工具）
- three.js + @pixiv/three-vrm（3D 虚拟形象）
- i18next + react-i18next（国际化）
- Chart.js + react-chartjs-2（数据可视化）
- React Router DOM 7（路由）
- Jest + React Testing Library + Playwright（测试）

**后端（本地化实现，`server/`）**
- FastAPI + Uvicorn
- DeepSeek API（Anthropic 兼容端点；模型名由 `.env` 配置，开发期 `deepseek-v4-flash`）
- SQLite（场景 / 会话 / 消息 / 报告 / 排行榜）
- edge-tts（语音合成）+ faster-whisper（语音识别）
- JWT + 邀请码认证

> `cdk/` 目录保留原 AWS 参考实现（已被 `server/` 本地实现替代，仅供对照参考）。

## 部署方式

详见《[部署手册.md](./部署手册.md)》，支持：

1. **免 Docker 直接运行**（本地开发：后端 uvicorn + 前端 vite preview）
2. **Docker Compose 一键部署**（生产：backend + frontend + 数据卷）

## 项目结构

```
├── server/                     # 本地化后端（FastAPI + SQLite + DeepSeek）
│   ├── app/
│   │   ├── api/               # 路由（sessions/scenarios/analysis/transcribe/tts/guardrails...）
│   │   ├── services/          # 业务（对话/评分/报告/ASR/TTS）
│   │   ├── agents/            # LLM 调用底座 + 提示词
│   │   ├── auth/              # 邀请码 + JWT
│   │   └── models.py          # Pydantic 模型
│   └── data/                  # SQLite 数据库与场景种子
├── frontend/                   # React 前端
│   └── src/
│       ├── components/        # UI 组件（avatar/conversation/compliance/recording...）
│       ├── pages/             # 页面
│       ├── services/          # API 服务、认证
│       ├── i18n/              # 国际化（zh/en/ja）
│       └── types/ utils/ hooks/
├── cdk/                        # 原 AWS 参考实现（已废弃，保留对照）
├── docs/                       # 项目文档
├── 部署手册.md                 # 本地化部署指南
└── 方案A改造计划.md            # 本地化改造方案与决策记录
```

## 文档

- [部署手册.md](./部署手册.md) — 部署与运行指南
- [方案A改造计划.md](./方案A改造计划.md) — 本地化改造方案（阶段 0-6）
- [汉化交接文档.md](./汉化交接文档.md) — 原项目交接说明
- [场景审查报告.md](./场景审查报告.md) — 场景库审查结论

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.
