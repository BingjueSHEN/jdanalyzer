# AGENTS.md - JD分析器

## 项目概览

JD分析器是一个智能招聘需求分析工具，用户粘贴招聘JD、上传简历/作品集（PDF/图片），前端直接调用AI服务商API进行分析，结果可视化展示。

## 技术栈

- **框架**: Next.js 16 (App Router)
- **核心**: React 19 + TypeScript 5
- **UI**: shadcn/ui + Tailwind CSS 4
- **AI**: 用户自带API Key，前端直接调用（支持豆包、通义千问、Kimi、DeepSeek、智谱GLM、OpenAI等）
- **PDF解析**: pdfjs-dist v4.0.379 + 视觉模型识别

## 架构说明

**纯前端架构，无后端API**：所有AI调用由浏览器直接发起，API Key存储在localStorage中。

## 目录结构

```
src/
├── app/
│   ├── page.tsx           # 主页面（含设置面板、欢迎弹窗、文件上传、结果展示）
│   ├── layout.tsx         # 全局布局
│   └── globals.css        # 全局样式 + 设计Token
├── components/
│   └── ui/                # shadcn/ui组件
└── lib/
    ├── ai-providers.ts    # AI服务商配置（端点、模型列表、申请Key链接）
    ├── api-client.ts      # 前端AI API客户端（文本分析 + 视觉识别）
    ├── storage.ts         # localStorage管理（配置、使用次数、首次访问）
    └── utils.ts           # 工具函数
```

## 核心功能

1. **招聘信息输入**: 粘贴JD全文
2. **简历/作品集上传**: PDF转图片后调用视觉模型识别，图片直接调用视觉模型
3. **AI分析**: 前端直接调用用户配置的AI服务商API
4. **结果展示**: 适配度评分、综合评价、技能分析、补差计划、JD解读
5. **API设置**: 右上角齿轮图标，图像识别和文本分析分别配置
6. **首次访问引导**: 弹窗引导用户配置API Key
7. **使用统计**: 底部显示个人分析次数

## 支持的AI服务商

| 服务商 | 端点 | 视觉模型 |
|--------|------|----------|
| 豆包（字节） | ark.cn-beijing.volces.com/api/v3 | Seed 2.0 Pro/Lite/Mini |
| 通义千问（阿里） | dashscope.aliyuncs.com/compatible-mode/v1 | Qwen-VL-Max/Plus |
| Kimi（月之暗面） | api.moonshot.cn/v1 | Moonshot V1 128K Vision |
| DeepSeek | api.deepseek.com/v1 | - |
| 智谱GLM | open.bigmodel.cn/api/paas/v4 | GLM-4V-Plus |
| OpenAI | api.openai.com/v1 | GPT-4o |
| 自定义 | 用户填写 | - |

## 设计规范

- 主色: #1A1A1A（纯黑）
- 背景: #FAFAFA
- 强调色: #F97316（活力橙）
- 字体: Inter
- 圆角: 12px (lg)
- 阴影: 柔和分层阴影

## 开发命令

```bash
pnpm dev          # 启动开发服务器
pnpm build        # 构建生产版本
pnpm start        # 启动生产服务器
pnpm ts-check     # TypeScript类型检查
pnpm lint         # ESLint检查
```
