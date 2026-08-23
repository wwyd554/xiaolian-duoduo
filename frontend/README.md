# AI 销售陪练 - 前端

## 概要

AI 销售陪练是针对入职 3 年以内的年轻销售人员，通过与 AI 的交互式模拟训练来提升销售技能的 AI 驱动型角色扮演系统。

## 主要功能

- **AI 动态对话功能**: 与适应用户应答的 NPC 进行自然的语音对话
- **表现评估功能**: 基于多个参数（情绪指数、信任度、进度）的实时评分
- **场景管理功能**: 可自定义的各种销售场景模板
- **NPC 设定功能**: 可自定义的角色属性（性格、职位、行业）
- **反馈功能**: 包含改进建议的详细分析报告
- **进度管理功能**: 针对每个场景定义的达成目标的进度
- **会话目标功能**: 每个场景设定的具体目标及其达成度评估

## 技术栈

- **框架**: React 19
- **语言**: TypeScript
- **UI 库**: Material UI 7
- **构建工具**: Vite 6
- **认证**: AWS Amplify v6

## 开发环境搭建

### 前提条件

- Node.js 22.x 及以上
- npm 9.x 及以上

### 安装步骤

1. 克隆仓库

```bash
git clone https://github.com/aws-samples/sample-ai-sales-roleplay.git
cd sample-ai-sales-roleplay/frontend
```

2. 安装依赖

```bash
npm install
```

3. 启动开发服务器

```bash
npm run dev
```

4. 在浏览器中访问 http://localhost:5173

## 可用的脚本

- `npm run dev` - 启动开发服务器
- `npm run build` - 构建生产版本
- `npm run lint` - 使用 ESLint 进行代码校验
- `npm run test` - 使用 Jest 运行测试

## 环境变量

应用程序使用以下环境变量：

| 变量名                   | 说明                          | 默认值                  |
| ------------------------ | ----------------------------- | ----------------------- |
| VITE_REGION              | AWS 区域                      | ap-northeast-1          |
| VITE_USER_POOL_ID        | Cognito 用户池 ID             | -                       |
| VITE_USER_POOL_CLIENT_ID | Cognito 客户端 ID             | -                       |
| VITE_API_ENDPOINT        | 后端 API 端点                 | http://localhost:3000/api |

| VITE_ENVIRONMENT | 环境名（dev/staging/prod） | dev |


## 项目结构

```
frontend/
├── public/          # 静态文件
├── src/             # 源代码
│   ├── assets/      # 图片、字体等资源
│   ├── components/  # React 组件
│   ├── data/        # 静态数据（场景、NPC 等）
│   ├── pages/       # 页面组件
│   ├── services/    # API 服务
│   ├── styles/      # 全局样式
│   ├── types/       # TypeScript 类型定义
│   └── utils/       # 工具函数
└── docs/            # 文档
```
