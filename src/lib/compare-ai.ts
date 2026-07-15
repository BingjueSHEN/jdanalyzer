// 对比分析 AI 调用

import type { SavedAnalysis } from "./jd-storage";
import { getConfig } from "./storage";

export async function generateComparisonReport(
  analyses: SavedAnalysis[]
): Promise<string> {
  const config = getConfig();
  const textConfig = config.text;

  if (!textConfig.apiKey || !textConfig.endpoint || !textConfig.model) {
    throw new Error("请先在设置中配置文本分析的 API Key");
  }

  // 构建分析数据摘要
  const summaries = analyses.map((a, idx) => ({
    index: idx + 1,
    jobTitle: a.jobTitle,
    score: a.result.score,
    overall_review: a.result.overall_review,
    owned_skills: a.result.owned_skills,
    missing_skills: a.result.missing_skills.map((s) => ({
      skill: s.skill,
      detail: s.detail,
    })),
    improvement_plan: a.result.improvement_plan,
    jd_truth: a.result.jd_truth,
  }));

  const prompt = `你是一位资深的职业顾问和求职策略专家。请基于以下 ${analyses.length} 份岗位分析报告，生成一份《多岗位对比分析与求职策略报告》。

## 各岗位分析数据

${summaries
  .map(
    (s) => `
### 岗位 ${s.index}: ${s.jobTitle}
- 适配度评分: ${s.score}/10
- 综合评价: ${s.overall_review}
- 已拥有技能: ${s.owned_skills.join(", ")}
- 缺失技能: ${s.missing_skills.map((m) => `${m.skill}(${m.detail})`).join("; ")}
- 补差计划: ${s.improvement_plan.map((p) => `${p.title}: ${p.detail}`).join("\n  ")}
- JD真实含义: ${s.jd_truth.map((t) => `"${t.phrase}": ${t.meaning}`).join("; ")}
`
  )
  .join("\n")}

---

请严格按照以下框架生成报告，使用 Markdown 格式（不要使用 Mermaid 图表，改用表格和文字描述）：

## 一、总体匹配度排行与梯队划分
- 从每份报告中提取适配分数，按从高到低排列
- 自动划分三个梯队：第一梯队（8-10分）、第二梯队（6-7分）、第三梯队（5分及以下）
- 用表格展示各岗位分数、所属梯队及策略建议（冲刺/主攻/保底）

## 二、技能池交叉对比与核心短板挖掘
- 构建一个覆盖所有岗位的核心技能清单（去重后合并）
- 为每个岗位判断每个技能的状态："已拥有"、"缺失"或"不要求"
- 统计每个技能在多个岗位的"缺失"频次，找出"高频缺失技能"（在≥2个岗位中缺失）
- 明确指出补上这些技能可同时提升多个岗位匹配度
- 使用 Markdown 表格展示技能-岗位矩阵，用表情表示状态：🟢 已拥有，🔴 缺失，⬜ 不要求

## 三、补差路径的性价比评估
- 阅读每个岗位的"补差计划"，估算每个缺失技能的学习周期（短期1-2周，中期1-2月，长期3个月以上）和难度（低/中/高）
- 找出"速赢机会"：只差1-2个短期技能就能从第二梯队跃升第一梯队的岗位
- 识别"一鱼多吃"技能：某个高频缺失技能可同时弥补多个岗位缺口
- 用表格展示：各岗位缺失技能、学习周期、难度、性价比简评

## 四、JD隐藏风险与公司文化预警
- 提取所有岗位"JD真实含义"中的负面或警惕点，按风险类型归类
- 统计每个岗位的风险点总数量
- 用表格详细列出各岗位的风险点原文解读和风险类型

## 五、职业发展潜力与战略契合度
- 从以下四个维度为每个岗位主观打分（1-5分）：
  1. 技能延续性：能否复用现有核心优势
  2. 增量技能价值：缺失技能中是否有高含金量、前沿技能
  3. 作品集放大效应：项目经验对未来竞争力的提升
  4. 行业/赛道前景：岗位所在领域的成长性
- 简要说明打分理由
- 提供评分表格（行为岗位，列为四维度，值为分数，表头不要带序号，直接写维度名称如"技能延续性 (1-5)"）

## 六、综合决策看板与行动建议
- 构建加权评估矩阵，对每个岗位在以下四个战略维度进行1-10分打分：
  1. 即时匹配度（直接采用原报告分数换算为10分制）
  2. 补差难易度（越高越容易，周期越短）
  3. 风险程度（越高风险越低，1=风险极高）
  4. 长期成长性（综合第五部分四维度平均分换算为10分制）
- 赋予默认权重：匹配度20%、补差难易度25%、风险程度30%、长期成长性25%
- 计算加权总分并排序，输出各岗位总分、排名及明确的求职优先级顺序
- 用表格展示各维度得分和加权总分
- 给出综合行动建议：针对优先岗位的1-2项补差学习任务，以及简历微调方向

---

### 格式与质量要求
- 不要在报告开头生成标题（标题已在页面中显示）
- 直接从"一、总体匹配度排行与梯队划分"开始
- 不要在每部分内容后面添加"---"分隔线
- 所有提取数据必须准确反映原文，禁止编造
- 语言专业、客观、有建设性，避免模棱两可
- 使用 Markdown 表格展示数据，不要使用 Mermaid 图表
- 称呼用户时使用"你"`;

  const messages = [
    {
      role: "system",
      content:
        "你是一位资深的职业顾问和求职策略专家，擅长多维度对比分析不同岗位的适配度，并能给出专业、客观、有建设性的求职建议。请严格按照用户要求的框架生成报告，使用 Markdown 格式和表格展示数据。",
    },
    { role: "user", content: prompt },
  ];

  const response = await fetch(`${textConfig.endpoint}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${textConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: textConfig.model,
      messages,
      temperature: 0.7,
      max_tokens: 8000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API 请求失败: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("API 返回内容为空");
  }

  return content;
}
