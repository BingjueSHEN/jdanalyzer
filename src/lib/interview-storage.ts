// 面试数据存储管理

import type { InterviewSession, InterviewReport } from "./interview-engine";

const STORAGE_KEY = "jd_interviews";

export interface StoredInterview {
  id: string;
  jdId: string;
  jobTitle: string;
  companyName: string;
  messages: Array<{
    id: string;
    role: "assistant" | "user";
    content: string;
    timestamp: number;
  }>;
  status: "active" | "paused" | "completed";
  startedAt: number;
  completedAt?: number;
  pausedAt?: number;
  report?: InterviewReport;
  reportSaved?: boolean; // 报告是否已显式保存到JD库
}

export function getInterviews(): StoredInterview[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function getInterviewsByJdId(jdId: string): StoredInterview[] {
  return getInterviews().filter((i) => i.jdId === jdId);
}

// 获取已保存到JD库的面试报告
export function getInterviewReports(jdId: string): StoredInterview[] {
  return getInterviews().filter(
    (i) => i.jdId === jdId && i.reportSaved === true && i.report
  );
}

export function getInterviewById(id: string): StoredInterview | undefined {
  return getInterviews().find((i) => i.id === id);
}

export function saveInterview(session: InterviewSession): void {
  const interviews = getInterviews();
  const existingIndex = interviews.findIndex((i) => i.id === session.id);

  const stored: StoredInterview = {
    id: session.id,
    jdId: session.jdId,
    jobTitle: session.jobTitle,
    companyName: session.companyName,
    messages: session.messages,
    status: session.status,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    pausedAt: session.pausedAt,
    report: session.report,
    reportSaved: existingIndex >= 0 ? interviews[existingIndex].reportSaved : false,
  };

  if (existingIndex >= 0) {
    interviews[existingIndex] = stored;
  } else {
    interviews.unshift(stored);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(interviews));
}

export function deleteInterview(id: string): void {
  const interviews = getInterviews().filter((i) => i.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(interviews));
}

// 显式保存报告到JD库
export function markReportAsSaved(interviewId: string): void {
  const interviews = getInterviews();
  const interview = interviews.find((i) => i.id === interviewId);
  if (interview) {
    interview.reportSaved = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(interviews));
  }
}

export function saveInterviewReport(
  interviewId: string,
  report: InterviewReport
): void {
  const interviews = getInterviews();
  const interview = interviews.find((i) => i.id === interviewId);
  if (interview) {
    interview.report = report;
    interview.status = "completed";
    interview.completedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(interviews));
  }
}

// 获取未完成的面试（active 或 paused 状态）
export function getActiveInterview(): StoredInterview | undefined {
  return getInterviews().find(
    (i) => i.status === "active" || i.status === "paused"
  );
}
