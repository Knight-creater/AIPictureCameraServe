# 🎨 AI 图片风格化生成器

> 基于 Node.js + Express + OpenAI API 的 AI 图片风格化转换服务。
> 用户上传一张照片，AI 自动分析图片内容，并生成指定风格的艺术作品。

## 📋 项目简介

本项目是一个全栈 AI 图片处理应用，提供以下功能：

- **AI 图片分析**：使用 GPT-4o-mini 多模态模型自动分析图片内容，生成详细描述
- **多风格转换**：支持泡泡玛特风格、迪士尼卡通风格、赛博朋克风格
- **多模型支持**：支持 Flux 和 Midjourney 两种 AI 绘图模型
- **可视化界面**：内置 Web 管理页面，可直接在浏览器中上传图片并查看结果

## 🛠️ 技术栈

| 技术 | 用途 |
|------|------|
| **Node.js** | 运行时环境 |
| **Express.js** | Web 服务器框架（类似 Java 的 Spring Boot） |
| **Axios** | HTTP 请求库（类似 Java 的 HttpClient） |
| **OpenAI API** | GPT-4o-mini 图片分析 + Flux 图片生成 |
| **Midjourney API** | 第三方 Midjourney 图片生成服务 |

## 🚀 快速开始

### 前提条件

- 安装 [Node.js](https://nodejs.org/) (v18 或更高版本)
- 拥有 OpenAI API Key（[获取地址](https://platform.openai.com/api-keys)）
- （可选）Midjourney 第三方 API Key

### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/Knight-creater/AIPictureCameraServe.git
cd AiPictureCameraServe

# 2. 安装依赖
npm install

# 3. 配置环境变量
# 复制 .env.example 为 .env，然后填入你的 API Key
cp .env.example .env

# 4. 编辑 .env 文件，填入以下配置：
#    OPENAI_API_KEY=sk-your-key-here
#    MIDJOURNEY_API_KEY=your-mj-key-here（可选）
#    PROXY_HOST=你的代理地址（国内访问需要）

# 5. 启动服务
npm start
```

### 访问服务

打开浏览器访问：**http://localhost:3000**

## 📡 API 接口

### GET /health - 健康检查

检查服务是否正常运行。

```json
// 响应示例
{
  "success": true,
  "data": {
    "status": "running",
    "port": 3000,
    "models": ["flux", "midjourney"],
    "styles": ["BubbleMattStyle", "CartoonStyle", "CyberpunkStyle"]
  },
  "message": "服务运行正常",
  "timestamp": 1700000000000
}
```

### POST /imgupload - 图片生成（核心接口）

上传图片并生成风格化 AI 图片。

**请求体：**

```json
{
  "imagebase64": "图片的 Base64 编码（必填，不要包含 data:image/... 前缀）",
  "uploadtype": "风格类型（可选，默认 BubbleMattStyle）",
  "modeltype": "模型类型（可选，默认 flux）",
  "prompt": "自定义提示词（可选）"
}
```

**风格类型说明：**

| 值 | 说明 |
|----|------|
| `BubbleMattStyle` | 🎯 泡泡玛特风格 - 3D Pixar 盲盒风格 |
| `CartoonStyle` | 🎬 迪士尼卡通风格 - 电影感卡通重绘 |
| `CyberpunkStyle` | 🌃 赛博朋克风格 - 霓虹机械感 |

**模型类型说明：**

| 值 | 说明 |
|----|------|
| `flux` | ⚡ Flux 模型 - 速度快，通过 OpenAI 兼容接口调用 |
| `midjourney` | 🎨 Midjourney - 质量高，需要第三方中转服务 |

**响应示例：**

```json
{
  "success": true,
  "data": {
    "urls": ["https://..."],
    "state": "success"
  },
  "message": "生成成功",
  "timestamp": 1700000000000
}
```

## 📁 项目结构

```
AiPictureCameraServe/
├── index.js          # 服务端入口文件（核心逻辑）
├── package.json      # 项目配置和依赖
├── .env              # 环境变量（API Key，不提交到 Git）
├── .env.example      # 环境变量示例
├── .gitignore        # Git 忽略规则
├── public/
│   └── index.html    # 前端页面（浏览器访问界面）
└── README.md         # 项目文档
```

## ⚙️ 核心工作流程

```
用户上传图片 → GPT-4o-mini 分析图片 → 生成 Prompt 描述
  → 拼接风格模板 → 调用绘图模型(Flux/Midjourney) → 返回图片 URL
```

## 🔒 安全注意事项

1. **API Key 保护**：密钥通过 `.env` 文件管理，已加入 `.gitignore`，不会提交到 GitHub
2. **请求大小限制**：图片最大支持 50MB
3. **超时保护**：请求超时设置为 10 分钟，防止长时间占用