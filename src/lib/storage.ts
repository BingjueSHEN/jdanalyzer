// localStorage 存储工具

export interface AIConfig {
  provider: string;
  endpoint: string;
  apiKey: string;
  model: string;
}

export interface AppSettings {
  vision: AIConfig;
  text: AIConfig;
}

const KEYS = {
  VISION: 'jd_vision_config',
  TEXT: 'jd_text_config',
  USAGE: 'jd_usage_count',
  VISITED: 'jd_first_visited',
};

export function getConfig(): AppSettings {
  const visionData = localStorage.getItem(KEYS.VISION);
  const textData = localStorage.getItem(KEYS.TEXT);
  return {
    vision: visionData ? JSON.parse(visionData) : { provider: 'doubao', endpoint: 'https://ark.cn-beijing.volces.com/api/v3', apiKey: '', model: 'doubao-seed-2-0-pro-260215' },
    text: textData ? JSON.parse(textData) : { provider: 'deepseek', endpoint: 'https://api.deepseek.com/v1', apiKey: '', model: 'deepseek-chat' },
  };
}

export function saveConfig(settings: AppSettings): void {
  localStorage.setItem(KEYS.VISION, JSON.stringify(settings.vision));
  localStorage.setItem(KEYS.TEXT, JSON.stringify(settings.text));
}

export function getUsageCount(): number {
  const data = localStorage.getItem(KEYS.USAGE);
  return data ? parseInt(data, 10) : 0;
}

export function incrementUsageCount(): void {
  const count = getUsageCount() + 1;
  localStorage.setItem(KEYS.USAGE, count.toString());
}

export function hasVisited(): boolean {
  return localStorage.getItem(KEYS.VISITED) === 'true';
}

export function setVisited(): void {
  localStorage.setItem(KEYS.VISITED, 'true');
}
