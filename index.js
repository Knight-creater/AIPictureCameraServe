// ============================================================
//  AI Picture Camera Server
//  AI 图片生成服务端 - 接收用户上传的图片，生成风格化 AI 图片
//  技术栈：Express.js + OpenAI API + Flux/Midjourney API
// ============================================================

const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

// -------------------- 配置项 --------------------
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MIDJOURNEY_API_KEY = process.env.MIDJOURNEY_API_KEY;
const PROXY_HOST = process.env.PROXY_HOST;

if (!OPENAI_API_KEY) {
  console.error("❌ 错误：未设置 OPENAI_API_KEY！请在 .env 文件中配置。");
  console.error("   参考 .env.example 文件进行配置。");
  process.exit(1);
}

const API_HOST = PROXY_HOST || "api.openai.com";
const OPENAI_BASE_URL = `https://${API_HOST}/v1`;

// -------------------- 中间件配置 --------------------
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: false }));
app.use(cors());

app.use((req, res, next) => {
  req.setTimeout(620000);
  res.setTimeout(620000);
  next();
});

app.use(express.static(path.join(__dirname, "public")));

// -------------------- 常量定义 --------------------
const STYLE_TYPES = {
  BUBBLE_MATT: "BubbleMattStyle",
  CARTOON: "CartoonStyle",
  CYBERPUNK: "CyberpunkStyle",
};

const MODEL_TYPES = {
  FLUX: "flux",
  MIDJOURNEY: "midjourney",
};

const STYLE_PROMPTS = {
  [STYLE_TYPES.BUBBLE_MATT]:
    "3d Pixar character style, ip by pop mart, soft colors, soft lighting, high detail, art station, art, ip, blind box, 8k, best quality, 3d, c4d, blender --iw 2 --ar 1:1",

  [STYLE_TYPES.CARTOON]:
    "disney, creating an elegant yet powerful silhouette. The background is a vivid blend of contrasting colors, with dramatic lighting that adds depth and tension to the scene. This conceptual artwork captures the essence of a cinematic moment, reimagining the classic Disney character in a bold, powerful, and exciting new way, vibrant, photo, conceptual art, cinematic, painting --iw 2 --ar 1:1",

  [STYLE_TYPES.CYBERPUNK]:
    "(machine construction:1.3), cyberpunk style photo, cyberpunk setting, high contrast, hyper realistic, reflections, cinematic, retrofuturism, at night, red lights and neon lights --iw 2 --ar 1:1 --stylize 750",
};

// -------------------- 工具函数 --------------------
function createOpenAIHeaders() {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  };
}

function createMJHeaders() {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${MIDJOURNEY_API_KEY}`,
  };
}

function buildResponse(success, data, message) {
  return {
    success: success,
    data: data,
    message: message || "",
    timestamp: Date.now(),
  };
}

function buildImagePrompt(gptDescription, styleType, userPrompt, modelType) {
  if (userPrompt && userPrompt.trim() !== "") {
    return `${gptDescription}, ${userPrompt}`;
  }

  const stylePrompt = STYLE_PROMPTS[styleType];
  if (!stylePrompt) {
    return gptDescription;
  }

  let finalPrompt = `${gptDescription}, ${stylePrompt}`;

  if (styleType === STYLE_TYPES.CARTOON && modelType === MODEL_TYPES.MIDJOURNEY) {
    finalPrompt += " --niji";
  }

  return finalPrompt;
}

// -------------------- 核心业务逻辑 --------------------
async function analyzeImageWithGPT(imageBase64) {
  console.log("🔍 正在分析图片...");

  const requestBody = {
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are an expert in generating prompts based on images, " +
          "all outputs are English prompt phrases without line breaks, " +
          "in a format like this: big eye, black hair, white clothes, " +
          "describe as detailed as possible.",
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
          },
          {
            type: "text",
            text: "Please describe this image.",
          },
        ],
      },
    ],
  };

  try {
    const response = await axios.post(
      `${OPENAI_BASE_URL}/chat/completions`,
      requestBody,
      { headers: createOpenAIHeaders() }
    );

    const description = response.data.choices[0].message.content;
    console.log("✅ GPT 分析完成，描述:", description.substring(0, 100) + "...");

    return description;
  } catch (error) {
    if (error.response) {
      console.error("❌ OpenAI API 错误:", error.response.status, error.response.data);
      throw new Error(`OpenAI API 错误: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    console.error("❌ 调用 OpenAI 失败:", error.message);
    throw error;
  }
}

async function generateWithFlux(prompt, imageBase64) {
  console.log("🎨 正在使用 Flux 生成图片...");

  const requestBody = {
    model: "flux",
    prompt: prompt,
    size: "1024x1024",
    n: 1,
    image: imageBase64,
  };

  try {
    const response = await axios.post(
      `${OPENAI_BASE_URL}/images/generations`,
      requestBody,
      { headers: createOpenAIHeaders() }
    );

    const imageUrl = response.data.data[0].url;
    console.log("✅ Flux 生成完成:", imageUrl);

    return {
      urls: [imageUrl],
      state: "success",
    };
  } catch (error) {
    console.error("❌ Flux 生成失败:", error.message);
    throw error;
  }
}

async function generateWithMidjourney(prompt, imageBase64) {
  console.log("🎨 正在使用 Midjourney 生成图片...");

  if (!MIDJOURNEY_API_KEY) {
    throw new Error("未配置 MIDJOURNEY_API_KEY");
  }

  console.log("📤 提交 Midjourney 绘图任务...");
  const submitResponse = await axios.post(
    `https://${API_HOST}/mj/submit/imagine`,
    {
      botType: "MID_JOURNEY",
      prompt: prompt,
      base64Array: [`data:image/jpeg;base64,${imageBase64}`],
    },
    { headers: createMJHeaders() }
  );

  console.log("📥 提交结果:", submitResponse.data);

  const code = submitResponse.data.code;
  if (code !== 1 && code !== 22) {
    return {
      urls: [],
      state: "error",
      message: submitResponse.data.message || "Midjourney 任务提交失败",
    };
  }

  const taskId = submitResponse.data.result;
  console.log("🆔 任务 ID:", taskId);

  console.log("⏳ 等待 Midjourney 绘图完成...");
  const taskResult = await pollMJTask(taskId, 600000);

  if (taskResult.state === "error") {
    return taskResult;
  }

  console.log("🔍 提交放大任务...");
  const upscaleTaskIds = [];

  for (let i = 0; i < Math.min(taskResult.buttons.length, 4); i++) {
    await new Promise((r) => setTimeout(r, 1000));

    try {
      const upscaleResult = await submitMJAction(
        taskResult.buttons[i].customId,
        taskId
      );
      if (upscaleResult && upscaleResult.result) {
        upscaleTaskIds.push(upscaleResult.result);
      }
    } catch (error) {
      console.error(`⚠️ 放大任务 ${i + 1} 提交失败:`, error.message);
    }
  }

  console.log("📋 放大任务 ID 列表:", upscaleTaskIds);

  console.log("⏳ 等待放大完成...");
  const upscaleResults = await Promise.all(
    upscaleTaskIds
      .filter((id) => id != null)
      .map((id) => pollMJTask(id, 600000))
  );

  const imageUrls = upscaleResults
    .filter((r) => r.state === "success" && r.imageUrl)
    .map((r) => r.imageUrl);

  console.log("✅ 所有图片生成完成:", imageUrls);

  return {
    urls: imageUrls,
    state: imageUrls.length > 0 ? "success" : "error",
    message: imageUrls.length > 0 ? "" : "所有放大任务均失败",
  };
}

function pollMJTask(taskId, timeout) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const headers = createMJHeaders();

    const interval = setInterval(async () => {
      try {
        const response = await axios.get(
          `https://${API_HOST}/mj/task/${taskId}/fetch`,
          { headers }
        );

        const data = response.data;
        console.log(`📊 任务 ${taskId} 进度:`, data.progress || "处理中...");

        if (data.status === "SUCCESS") {
          clearInterval(interval);
          console.log(`✅ 任务 ${taskId} 完成`);
          resolve({
            state: "success",
            imageUrl: data.imageUrl,
            buttons: data.buttons || [],
            progress: data.progress,
          });
        }

        if (data.status === "FAILURE") {
          clearInterval(interval);
          console.error(`❌ 任务 ${taskId} 失败:`, data.failReason || "未知原因");
          resolve({
            state: "error",
            message: data.failReason || "任务失败",
          });
        }
      } catch (error) {
        console.error(`⚠️ 查询任务 ${taskId} 出错:`, error.message);
      }

      if (Date.now() - startTime >= timeout) {
        clearInterval(interval);
        console.error(`⏰ 任务 ${taskId} 超时`);
        resolve({
          state: "error",
          message: "任务超时",
        });
      }
    }, 1000);
  });
}

async function submitMJAction(customId, taskId) {
  const response = await axios.post(
    `https://${API_HOST}/mj/submit/action`,
    {
      chooseSameChannel: true,
      customId: customId,
      taskId: taskId,
    },
    { headers: createMJHeaders() }
  );

  console.log("🔄 动作提交结果:", response.data);
  return response.data;
}

// -------------------- 主处理函数 --------------------
async function processImageGeneration(imageBase64, styleType, modelType, userPrompt) {
  try {
    const gptDescription = await analyzeImageWithGPT(imageBase64);

    const finalPrompt = buildImagePrompt(
      gptDescription,
      styleType,
      userPrompt,
      modelType
    );
    console.log("📝 最终 Prompt:", finalPrompt.substring(0, 150) + "...");

    let result;
    if (modelType === MODEL_TYPES.FLUX) {
      result = await generateWithFlux(finalPrompt, imageBase64);
    } else if (modelType === MODEL_TYPES.MIDJOURNEY) {
      result = await generateWithMidjourney(finalPrompt, imageBase64);
    } else {
      throw new Error(`不支持的模型类型: ${modelType}`);
    }

    return result;
  } catch (error) {
    console.error("❌ 图片生成失败:", error.message);
    throw error;
  }
}

// ============================================================
//  API 路由定义
// ============================================================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/health", (req, res) => {
  res.json(
    buildResponse(true, {
      status: "running",
      port: PORT,
      models: Object.values(MODEL_TYPES),
      styles: Object.values(STYLE_TYPES),
    }, "服务运行正常")
  );
});

app.post("/imgupload", async (req, res) => {
  const { imagebase64, uploadtype, modeltype, prompt } = req.body;

  if (!imagebase64) {
    return res.status(400).json(buildResponse(false, null, "请提供图片数据"));
  }

  const style = uploadtype || STYLE_TYPES.BUBBLE_MATT;
  const model = modeltype || MODEL_TYPES.FLUX;

  console.log("📥 收到请求:", {
    style,
    model,
    hasPrompt: !!prompt,
    imageSize: imagebase64.length,
  });

  try {
    const result = await processImageGeneration(
      imagebase64,
      style,
      model,
      prompt || ""
    );

    console.log("📤 返回结果:", result);
    res.json(buildResponse(true, result, "生成成功"));
  } catch (error) {
    console.error("❌ 处理失败:", error.message);
    res.status(500).json(
      buildResponse(false, null, `生成失败: ${error.message}`)
    );
  }
});

// -------------------- 404 错误处理 --------------------
app.use((req, res) => {
  res.status(404).json(buildResponse(false, null, `接口不存在: ${req.method} ${req.path}`));
});

// -------------------- 全局错误处理 --------------------
app.use((err, req, res, next) => {
  console.error("💥 未捕获的异常:", err);

  if (err.code === "ECONNREFUSED") {
    return res.status(503).json(buildResponse(false, null, "无法连接到 AI 服务，请检查代理地址"));
  }
  if (err.code === "ETIMEDOUT") {
    return res.status(504).json(buildResponse(false, null, "AI 服务响应超时"));
  }

  res.status(500).json(buildResponse(false, null, "服务器内部错误"));
});

// ============================================================
//  启动服务器
// ============================================================
app.listen(PORT, () => {
  console.log("================================================");
  console.log("  🚀 AI 图片生成服务已启动！");
  console.log(`  📡 地址: http://localhost:${PORT}`);
  console.log(`  🩺 健康检查: http://localhost:${PORT}/health`);
  console.log(`  📸 图片生成: POST http://localhost:${PORT}/imgupload`);
  console.log("================================================");
  console.log("  配置信息:");
  console.log(`  - OpenAI API: ${OPENAI_API_KEY ? "✅ 已配置" : "❌ 未配置"}`);
  console.log(`  - Midjourney API: ${MIDJOURNEY_API_KEY ? "✅ 已配置" : "❌ 未配置"}`);
  console.log(`  - 代理地址: ${PROXY_HOST || "无（直连）"}`);
  console.log("================================================");
});