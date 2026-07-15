// AI API 错误分类与友好提示

export type AIErrorType =
  | 'network'          // 网络问题
  | 'auth'             // 认证失败（Key 无效/过期）
  | 'rate_limit'       // 频率限制/配额超限
  | 'server'           // 服务端错误
  | 'timeout'          // 请求超时
  | 'invalid_response' // 响应格式异常
  | 'unknown';         // 未知错误

export interface AIErrorInfo {
  type: AIErrorType;
  title: string;
  message: string;
  suggestion: string;
}

const ERROR_MAP: Record<AIErrorType, Omit<AIErrorInfo, 'type'>> = {
  network: {
    title: '网络连接失败',
    message: '无法连接到 AI 服务，请检查网络连接',
    suggestion: '1. 检查网络连接是否正常\n2. 确认 API 端点地址是否正确\n3. 如使用代理，请检查代理设置',
  },
  auth: {
    title: 'API Key 无效',
    message: '认证失败，请检查 API Key 是否正确',
    suggestion: '1. 检查 API Key 是否复制完整\n2. 确认 Key 是否已过期或被禁用\n3. 前往服务商官网重新生成 Key',
  },
  rate_limit: {
    title: '请求过于频繁',
    message: '已达到 API 调用频率限制或配额上限',
    suggestion: '1. 稍等片刻后重试\n2. 检查服务商的配额使用情况\n3. 如需更高配额，请升级套餐',
  },
  server: {
    title: '服务端错误',
    message: 'AI 服务暂时不可用',
    suggestion: '1. 稍等片刻后重试\n2. 检查服务商状态页面\n3. 如持续失败，可切换其他 AI 服务商',
  },
  timeout: {
    title: '请求超时',
    message: 'AI 服务响应时间过长',
    suggestion: '1. 检查网络连接是否稳定\n2. 尝试缩短输入内容\n3. 稍后重试',
  },
  invalid_response: {
    title: '响应格式异常',
    message: 'AI 返回的内容格式不正确',
    suggestion: '1. 点击重试按钮重新分析\n2. 如持续失败，可尝试切换其他模型',
  },
  unknown: {
    title: '未知错误',
    message: '发生了一个未知错误',
    suggestion: '1. 刷新页面后重试\n2. 检查浏览器控制台获取详细信息',
  },
};

/**
 * 根据 HTTP 状态码和错误信息分类错误类型
 */
export function classifyAIError(statusCode?: number, errorText?: string): AIErrorType {
  if (!statusCode) {
    // 无状态码通常是网络问题
    if (errorText?.includes('timeout') || errorText?.includes('ETIMEDOUT')) {
      return 'timeout';
    }
    return 'network';
  }

  if (statusCode === 401 || statusCode === 403) {
    return 'auth';
  }

  if (statusCode === 429) {
    return 'rate_limit';
  }

  if (statusCode >= 500) {
    return 'server';
  }

  if (statusCode >= 400) {
    // 检查错误文本中的关键词
    if (errorText?.includes('rate') || errorText?.includes('quota') || errorText?.includes('limit')) {
      return 'rate_limit';
    }
    if (errorText?.includes('auth') || errorText?.includes('key') || errorText?.includes('token')) {
      return 'auth';
    }
  }

  return 'unknown';
}

/**
 * 获取友好的错误信息
 */
export function getAIErrorInfo(statusCode?: number, errorText?: string): AIErrorInfo {
  const type = classifyAIError(statusCode, errorText);
  return { type, ...ERROR_MAP[type] };
}

/**
 * 创建友好的错误对象
 */
export function createAIError(statusCode?: number, errorText?: string): Error & { info: AIErrorInfo } {
  const info = getAIErrorInfo(statusCode, errorText);
  const error = new Error(info.message) as Error & { info: AIErrorInfo };
  error.info = info;
  return error;
}
