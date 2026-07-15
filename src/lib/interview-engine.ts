// 模拟面试引擎 - AI面试官对话管理

import type { AIConfig } from "./storage";
import { getAIErrorInfo } from "./api-errors";

export interface InterviewMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  timestamp: number;
}

export interface InterviewSession {
  id: string;
  jdId: string; // 关联的JD分析ID
  jobTitle: string;
  companyName: string;
  jdText: string;
  resumeText: string;
  portfolioText: string;
  analysisSummary?: string; // JD分析报告摘要（用于面试上下文）
  messages: InterviewMessage[];
  status: "active" | "paused" | "completed";
  startedAt: number;
  completedAt?: number;
  pausedAt?: number;
  report?: InterviewReport;
}

export interface InterviewReport {
  overview: {
    jobTitle: string;
    interviewTime: string;
    duration: string;
    dimensions: string[];
  };
  qaDetails: {
    question: string;
    answerSummary: string;
    suggestions: {
      content: string;
      expression: string;
    };
  }[];
 综合评价: {
    answerApproach: string;
    languageLogic: string;
    coreStrengths: string[];
    improvementAreas: string[];
    learningSuggestions: string[];
  };
}

const INTERVIEW_SYSTEM_PROMPT = `你是一位专业、敏锐且富有洞察力的AI面试官。你擅长基于岗位描述、候选人简历和作品集，进行多轮高压但又友好的连环追问。

## 核心能力
1. 快速读取并深度分析岗位描述、候选人简历及作品集
2. 自动提炼岗位核心胜任力要求、技术栈、项目背景，并与简历经历进行关联比对
3. 智能连环追问：从回答中识别关键信息、模糊点和潜在矛盾点

## 追问维度（必须覆盖）
- 岗位核心要求：基于JD的关键职责和必备技能进行验证
- 项目经验深挖：针对简历和作品集提到的项目，追问背景、角色、技术实现、挑战及解决方案
- 技能掌握程度：追问具体工具/语言/框架的使用细节、原理理解
- 软技能与团队协作：通过具体事例追问跨部门沟通、冲突处理
- 职业规划与动机：追问求职动机、自我认知与岗位发展预期

## 交互规则
1. 每次只问一个问题，保持对话节奏
2. 语气专业、亲和但有压迫感，像真正的面试官
3. 严格依据候选人上一轮的回答进行追问
4. 从开放但紧扣材料的问题切入
5. 用自然流畅的口语进行交谈，避免过度书面化
6. 在对话过程中默默记录每一个提问和回答，用于最终报告

## 面试流程
1. 开场：简短自我介绍，说明面试将围绕提供的岗位进行深度交流
2. 材料确认：确认收到JD、简历、作品集，做简短初步分析
3. 正式面试：从核心项目切入，逐步深入追问
4. 结束：当关键维度都已覆盖时，自然收尾

## 重要：你现在正在面试中，请直接以面试官身份开始对话。`;

function buildInterviewContext(
  jdText: string,
  resumeText: string,
  portfolioText: string,
  analysisSummary?: string
): string {
  let context = "## 候选人提交的材料\n\n";
  if (jdText) {
    context += `### 岗位描述（JD）\n${jdText}\n\n`;
  }
  if (resumeText) {
    context += `### 个人简历\n${resumeText}\n\n`;
  }
  if (portfolioText) {
    context += `### 作品集内容\n${portfolioText}\n\n`;
  }
  if (analysisSummary) {
    context += `### 岗位适配度分析摘要\n${analysisSummary}\n\n`;
  }
  return context;
}

function buildChatHistory(messages: InterviewMessage[]): Array<{ role: string; content: string }> {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

export async function sendInterviewMessage(
  session: InterviewSession,
  userMessage: string,
  config: AIConfig,
  onStream?: (text: string) => void
): Promise<string> {
  const context = buildInterviewContext(
    session.jdText,
    session.resumeText,
    session.portfolioText,
    session.analysisSummary
  );

  const chatHistory = buildChatHistory(session.messages);

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: INTERVIEW_SYSTEM_PROMPT + "\n\n" + context },
    ...chatHistory,
    { role: "user", content: userMessage },
  ];

  const endpoint = config.endpoint.replace(/\/$/, "");
  const url = `${endpoint}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const errorInfo = getAIErrorInfo(response.status, errorText);
    throw new Error(errorInfo.message);
  }

  // 流式读取
  const reader = response.body?.getReader();
  if (!reader) throw new Error("无法读取响应流");

  const decoder = new TextDecoder();
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n").filter((line) => line.trim() !== "");

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            onStream?.(fullText);
          }
        } catch {
          // 忽略解析错误
        }
      }
    }
  }

  return fullText;
}

export async function generateInterviewReport(
  session: InterviewSession,
  config: AIConfig
): Promise<InterviewReport> {
  const conversationText = session.messages
    .map((m) => `${m.role === "assistant" ? "面试官" : "候选人"}: ${m.content}`)
    .join("\n\n");

  const prompt = `基于以下模拟面试对话记录，生成一份结构化的面试报告。

## 面试信息
- 应聘岗位：${session.jobTitle}
- 公司：${session.companyName}
- 对话轮数：${session.messages.length}轮

## 完整对话记录
${conversationText}

## 输出要求
请严格以JSON格式返回，包含以下结构：
{
  "overview": {
    "jobTitle": "岗位名称",
    "interviewTime": "面试时间（格式：YYYY-MM-DD HH:mm）",
    "duration": "面试时长估算（如：约25分钟）",
    "dimensions": ["考察维度1", "考察维度2", ...]
  },
  "qaDetails": [
    {
      "question": "面试官的原始提问",
      "answerSummary": "候选人回答要点概括",
      "suggestions": {
        "content": "内容方面的提升建议",
        "expression": "表达方面的提升建议"
      }
    }
  ],
  "综合评价": {
    "answerApproach": "回答思路整体评价（100-200字）",
    "languageLogic": "语言逻辑评价（100-200字）",
    "coreStrengths": ["核心优势1", "核心优势2", "核心优势3"],
    "improvementAreas": ["待发展领域1", "待发展领域2", "待发展领域3"],
    "learningSuggestions": ["学习建议1", "学习建议2", "学习建议3", "学习建议4"]
  }
}

## 报告生成原则
- 必须基于真实对话内容总结，不可虚构候选人未提及的信息
- 语言保持专业、建设性、具体，避免空洞的夸奖或批评
- qaDetails中列出所有问过的问题（通常5-8个）
- 每个建议要具体可操作`;

  const endpoint = config.endpoint.replace(/\/$/, "");
  const url = `${endpoint}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: "你是一个专业的面试评估专家，请根据对话记录生成面试报告。严格以JSON格式返回。" },
        { role: "user", content: prompt },
      ],
      stream: false,
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    throw new Error(`生成报告失败: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  // 尝试解析JSON
  try {
    // 尝试从内容中提取JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as InterviewReport;
    }
    throw new Error("未找到JSON");
  } catch {
    throw new Error("报告格式解析失败");
  }
}

export function createInterviewSession(
  jdId: string,
  jobTitle: string,
  companyName: string,
  jdText: string,
  resumeText: string,
  portfolioText: string,
  analysisSummary?: string
): InterviewSession {
  return {
    id: `interview_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    jdId,
    jobTitle,
    companyName,
    jdText,
    resumeText,
    portfolioText,
    analysisSummary,
    messages: [],
    status: "active",
    startedAt: Date.now(),
  };
}

export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
