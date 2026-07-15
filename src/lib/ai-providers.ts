// AI 服务商配置
export interface AIProvider {
  id: string;
  name: string;
  endpoint: string;
  keyUrl: string;
  models: {
    id: string;
    name: string;
    vision?: boolean;
  }[];
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'doubao',
    name: '豆包（字节跳动）',
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3',
    keyUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
    models: [
      { id: 'doubao-seed-2-0-pro-260215', name: 'Seed 2.0 Pro（推荐，支持图像）', vision: true },
      { id: 'doubao-seed-2-0-lite-260215', name: 'Seed 2.0 Lite（支持图像）', vision: true },
      { id: 'doubao-seed-2-0-mini-260215', name: 'Seed 2.0 Mini（快速，支持图像）', vision: true },
    ],
  },
  {
    id: 'qwen',
    name: '通义千问（阿里云）',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    keyUrl: 'https://dashscope.console.aliyun.com/apiKey',
    models: [
      { id: 'qwen-vl-max', name: 'Qwen-VL-Max（视觉，推荐）', vision: true },
      { id: 'qwen-vl-plus', name: 'Qwen-VL-Plus（视觉）', vision: true },
      { id: 'qwen-max', name: 'Qwen-Max（文本）' },
      { id: 'qwen-plus', name: 'Qwen-Plus（文本）' },
      { id: 'qwen-turbo', name: 'Qwen-Turbo（文本，快速）' },
    ],
  },
  {
    id: 'kimi',
    name: 'Kimi（月之暗面）',
    endpoint: 'https://api.moonshot.cn/v1',
    keyUrl: 'https://platform.moonshot.cn/console/api-keys',
    models: [
      { id: 'moonshot-v1-128k-vision', name: 'Moonshot V1 128K Vision（推荐）', vision: true },
      { id: 'moonshot-v1-128k', name: 'Moonshot V1 128K（文本）' },
      { id: 'moonshot-v1-32k', name: 'Moonshot V1 32K（文本）' },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/v1',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat（推荐）' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner（推理）' },
    ],
  },
  {
    id: 'glm',
    name: '智谱 GLM',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4',
    keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    models: [
      { id: 'glm-4v-plus', name: 'GLM-4V-Plus（视觉，推荐）', vision: true },
      { id: 'glm-4v', name: 'GLM-4V（视觉）', vision: true },
      { id: 'glm-4', name: 'GLM-4（文本）' },
      { id: 'glm-4-flash', name: 'GLM-4-Flash（文本，免费）' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1',
    keyUrl: 'https://platform.openai.com/api-keys',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o（推荐，支持图像）', vision: true },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo（支持图像）', vision: true },
      { id: 'gpt-4', name: 'GPT-4（文本）' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo（文本，便宜）' },
    ],
  },
  {
    id: 'custom',
    name: '其他（自定义）',
    endpoint: '',
    keyUrl: '',
    models: [],
  },
];

// 获取支持视觉的模型列表
export function getVisionModels(): { provider: AIProvider; model: { id: string; name: string } }[] {
  const visionModels: { provider: AIProvider; model: { id: string; name: string } }[] = [];
  for (const provider of AI_PROVIDERS) {
    for (const model of provider.models) {
      if (model.vision) {
        visionModels.push({ provider, model });
      }
    }
  }
  return visionModels;
}

// 根据服务商ID获取服务商
export function getProviderById(id: string): AIProvider | undefined {
  return AI_PROVIDERS.find(p => p.id === id);
}
