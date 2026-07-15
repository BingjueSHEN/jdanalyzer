// JD分析结果存储类型

import type { AnalysisResult } from "@/lib/types";

export interface SavedAnalysis {
  id: string;
  createdAt: number;
  jobTitle: string;
  companyName: string; // 公司名称
  jdText: string;
  resumeText: string;
  portfolioText?: string; // 作品集文本（可选，用于面试上下文）
  result: AnalysisResult;
}

const STORAGE_KEY = "jd_analyses";

export function getSavedAnalyses(): SavedAnalysis[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveAnalysis(analysis: SavedAnalysis): void {
  const analyses = getSavedAnalyses();
  analyses.unshift(analysis); // 新增的放在最前面
  localStorage.setItem(STORAGE_KEY, JSON.stringify(analyses));
}

export function updateSavedAnalysis(id: string, updates: Partial<SavedAnalysis>): void {
  const analyses = getSavedAnalyses();
  const index = analyses.findIndex((a) => a.id === id);
  if (index !== -1) {
    analyses[index] = { ...analyses[index], ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(analyses));
  }
}

export function deleteAnalyses(ids: string[]): void {
  const analyses = getSavedAnalyses();
  const filtered = analyses.filter((a) => !ids.includes(a.id));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
