// AI API 客户端 - 前端直接调用各服务商
import { createAIError, getAIErrorInfo } from './api-errors';

export interface AnalysisResult {
  score: number;
  job_title: string;
  company_name: string;
  overall_review: string;
  owned_skills: string[];
  missing_skills: { skill: string; detail: string }[];
  improvement_plan: { title: string; detail: string }[];
  jd_truth: { phrase: string; meaning: string }[];
}

export interface AIConfig {
  provider: string;
  endpoint: string;
  apiKey: string;
  model: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }>;
}

// 文本分析：JD + 简历 + 作品集 → 分析结果
export async function callAIForAnalysis(
  jdText: string,
  resumeText: string,
  portfolioText: string,
  config: AIConfig
): Promise<AnalysisResult> {
  const systemPrompt = `你是一个专业的JD分析师和职业规划顾问。请分析用户提供的招聘信息和候选人简历，评估适配度。
你必须以严格的JSON格式返回分析结果，不要包含任何其他文字。

## 重要规则：
- 在分析结果中，称呼候选人/用户时，统一使用"你"来称呼，不要使用"候选人"、"该用户"、"他/她"等

## 输出要求（严格遵守字数限制）：

1. **score**: 0-10的整数评分

2. **job_title**: 从JD中提取的职位名称，如"高级前端工程师"

3. **company_name**: 从JD中提取的公司名称，如"字节跳动"、"腾讯"。如果JD中未明确提及公司名，根据上下文推断或返回"未知公司"

4. **company_info** (公司简介): 
   - 300-500字的公司介绍
   - 包含以下内容（用流畅的段落形式呈现，不要用标题分隔）：
     a) 概览定位（1-2句）：公司全称、成立年份、总部、员工规模、企业性质及行业地位
     b) 核心业务与产品（2-3句）：用最通俗的语言说明做什么，为谁解决什么问题，核心产品/服务有哪些
     c) 市场优势与成绩（2句）：突出市占率、标杆客户、专利、融资轮次、荣誉奖项等
     d) 文化理念与氛围（1-2句）：提炼使命、愿景或价值观关键词，以及团队风格
     e) 发展动态与前景（1句）：提及近期的战略布局、新业务方向或上市计划
     f) 结尾点题（可选）：一句话拉回用户与公司的关联
   - 如果JD中公司信息不足，根据公司名称和你已知的公开信息进行补充
   - 用"你"来称呼用户

5. **overall_review** (综合评价): 
   - 300-500字的完整段落
   - 必须具体结合简历、作品集、JD内容分析
   - 用"你"来称呼用户，说明匹配情况、亮点与不足
   - 杜绝模板空话，要有针对性

3. **owned_skills** (已拥有技能):
   - 仅列出技能名词（如 Python、Figma、项目管理）
   - 不展开说明，不写描述

4. **missing_skills** (缺失技能):
   - 仅列出硬技能（技术、工具、软件等），不要写软技能
   - 每个技能附100-200字解释，说明该技能的含义与重要性

5. **improvement_plan** (补差计划):
   - 针对每个缺失技能提供具体可实施的学习建议
   - 每条建议包含title（简短标题，如"学习Kubernetes基础"）和detail（200-500字的详细方案）
   - 必须结合用户的简历、作品集背景，给出个性化方案
   - 用"你"来称呼用户
   - 不要泛泛而谈

6. **jd_truth** (JD真实含义/招聘黑话解读):
   - 检查JD文本中是否包含"弹性工作"、"抗压能力强"、"扁平管理"、"有竞争力薪资"、"快速成长"、"狼性文化"、"996福报"等可能隐藏真实含义的词汇
   - 如果检测到，解读其可能隐藏的真实含义，提醒用户注意
   - 每条包含phrase（原词）和meaning（解读）
   - 如果未检测到任何招聘黑话，返回 [{"phrase": "未检测到", "meaning": "该JD未发现明显的招聘黑话或隐晦表达，整体表述较为直接透明。"}]

## 返回格式：
{
  "score": 8,
  "job_title": "从JD中提取的职位名称，如'高级前端工程师'",
  "company_name": "从JD中提取的公司名称，如'字节跳动'",
  "company_info": "300-500字的公司简介...",
  "overall_review": "300-500字的综合评价，用'你'称呼用户...",
  "owned_skills": ["Python", "Figma", "项目管理"],
  "missing_skills": [{"skill": "Kubernetes", "detail": "100-200字的解释..."}],
  "improvement_plan": [{"title": "学习Kubernetes基础", "detail": "200-500字的个性化学习建议，用'你'称呼..."}],
  "jd_truth": [{"phrase": "弹性工作", "meaning": "简洁的解读..."}]
}`;

  let userContent = `## 招聘信息\n${jdText}\n\n## 候选人简历\n${resumeText}`;
  if (portfolioText) {
    userContent += `\n\n## 作品集\n${portfolioText}`;
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];

  const response = await fetch(`${config.endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw createAIError(response.status, error);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  // 解析 JSON 响应
  try {
    // 尝试从 markdown code block 中提取 JSON
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
    return JSON.parse(jsonStr);
  } catch {
    // 如果解析失败，尝试找到第一个 { 和最后一个 }
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      try {
        return JSON.parse(content.slice(start, end + 1));
      } catch {
        throw new Error('AI返回格式异常，请重试');
      }
    }
    throw new Error('AI返回格式异常，请重试');
  }
}

// 视觉识别：图片 → 文字
export async function callAIForVision(
  imageBlob: Blob,
  config: AIConfig
): Promise<string> {
  // 将图片转为 base64
  const base64 = await blobToBase64(imageBlob);
  const dataUrl = `data:${imageBlob.type || 'image/jpeg'};base64,${base64}`;

  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: '请仔细识别这张图片中的所有文字内容，完整输出，不要遗漏任何文字。如果图片中有表格或结构化内容，请保持其结构。',
        },
        {
          type: 'image_url',
          image_url: {
            url: dataUrl,
            detail: 'high',
          },
        },
      ],
    },
  ];

  const response = await fetch(`${config.endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw createAIError(response.status, error);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Blob 转 base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // 去掉 data:xxx;base64, 前缀
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
