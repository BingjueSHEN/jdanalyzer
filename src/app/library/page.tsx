"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Check, ChevronLeft, X, Download, FileText, Image, MessageSquare, Clock, Library, ArrowRight, Upload, Pencil } from "lucide-react";
import {
  getSavedAnalyses,
  deleteAnalyses,
  updateSavedAnalysis,
  type SavedAnalysis,
} from "@/lib/jd-storage";
import { exportToPdf, exportToImage, exportToHtml } from "@/lib/export-utils";
import { getInterviewReports, deleteInterview, type StoredInterview } from "@/lib/interview-storage";
import type { AnalysisResult } from "@/lib/types";

export default function LibraryPage() {
  const router = useRouter();
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewAnalysis, setViewAnalysis] = useState<SavedAnalysis | null>(null);
  const [showFormatSelector, setShowFormatSelector] = useState(false);
  const [interviews, setInterviews] = useState<Map<string, StoredInterview[]>>(new Map());
  const [showInterviewReports, setShowInterviewReports] = useState<string | null>(null);
  const [editingAnalysis, setEditingAnalysis] = useState<SavedAnalysis | null>(null);
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editJdText, setEditJdText] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  
  // 搜索和筛选状态
  const [searchQuery, setSearchQuery] = useState("");
  const [scoreFilter, setScoreFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [sortBy, setSortBy] = useState<"time-desc" | "time-asc" | "score-desc" | "score-asc" | "missing-desc">("time-desc");
  
  // Toast 状态
  const [toast, setToast] = useState<{ message: string; visible: boolean; deletedItems: SavedAnalysis[] | null }>({
    message: "",
    visible: false,
    deletedItems: null,
  });
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const savedAnalyses = getSavedAnalyses();
    setAnalyses(savedAnalyses);
    
    // 加载每个JD的面试报告（仅已保存的）
    const interviewMap = new Map<string, StoredInterview[]>();
    savedAnalyses.forEach((a) => {
      const jdInterviews = getInterviewReports(a.id);
      if (jdInterviews.length > 0) {
        interviewMap.set(a.id, jdInterviews);
      }
    });
    setInterviews(interviewMap);
  }, []);

  // 过滤并排序后的分析列表
  const filteredAnalyses = analyses
    .filter((analysis) => {
      // 搜索过滤
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const jobTitle = analysis.result.job_title.toLowerCase();
        const company = analysis.result.company_name?.toLowerCase() || "";
        if (!jobTitle.includes(query) && !company.includes(query)) {
          return false;
        }
      }
    
      // 评分段过滤
      if (scoreFilter !== "all") {
        const score = analysis.result.score;
        if (scoreFilter === "high" && score < 8) return false;
        if (scoreFilter === "medium" && (score < 6 || score >= 8)) return false;
        if (scoreFilter === "low" && score >= 6) return false;
      }
    
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "time-desc":
          return b.createdAt - a.createdAt;
        case "time-asc":
          return a.createdAt - b.createdAt;
        case "score-desc":
          return b.result.score - a.result.score;
        case "score-asc":
          return a.result.score - b.result.score;
        case "missing-desc":
          return b.result.missing_skills.length - a.result.missing_skills.length;
        default:
          return 0;
      }
    });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDelete = () => {
    if (selectedIds.size === 0) return;
    
    // 保存被删除的项目以便撤销
    const deletedItems = analyses.filter(a => selectedIds.has(a.id));
    
    // 执行删除
    deleteAnalyses(Array.from(selectedIds));
    setAnalyses(getSavedAnalyses());
    setSelectedIds(new Set());
    setSelectMode(false);
    
    // 显示 toast
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({
      message: `已删除 ${deletedItems.length} 条记录`,
      visible: true,
      deletedItems: deletedItems,
    });
    
    // 3秒后自动隐藏
    toastTimeoutRef.current = setTimeout(() => {
      setToast({ message: "", visible: false, deletedItems: null });
    }, 3000);
  };

  const handleUndoDelete = () => {
    if (!toast.deletedItems) return;
    
    // 恢复被删除的项目
    const currentAnalyses = getSavedAnalyses();
    const restoredAnalyses = [...toast.deletedItems, ...currentAnalyses].sort((a, b) => b.createdAt - a.createdAt);
    
    // 保存到 localStorage
    localStorage.setItem("jd_analyses", JSON.stringify(restoredAnalyses));
    setAnalyses(restoredAnalyses);
    
    // 隐藏 toast
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ message: "", visible: false, deletedItems: null });
  };

  const handleEdit = (analysis: SavedAnalysis) => {
    setEditingAnalysis(analysis);
    setEditJobTitle(analysis.jobTitle);
    setEditJdText(analysis.jdText || "");
    setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    if (!editingAnalysis) return;
    
    updateSavedAnalysis(editingAnalysis.id, {
      jobTitle: editJobTitle.trim() || editingAnalysis.jobTitle,
      jdText: editJdText.trim(),
    });
    
    setAnalyses(getSavedAnalyses());
    setShowEditModal(false);
    setEditingAnalysis(null);
  };

  const handleCompare = () => {
    if (selectedIds.size < 2) {
      alert("请至少选择 2 条记录进行对比分析");
      return;
    }
    if (selectedIds.size > 5) {
      alert("最多选择 10 条记录进行对比分析");
      return;
    }
    sessionStorage.setItem("compareIds", JSON.stringify(Array.from(selectedIds)));
    router.push("/compare");
  };

  const handleExportPdf = async () => {
    if (!reportRef.current) return;
    await exportToPdf(reportRef.current, `${viewAnalysis?.companyName || ""}_${viewAnalysis?.jobTitle || "分析报告"}`);
  };

  const handleExportImage = async () => {
    if (!reportRef.current) return;
    await exportToImage(reportRef.current, `${viewAnalysis?.companyName || ""}_${viewAnalysis?.jobTitle || "分析报告"}`);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 渲染单个分析报告
  const renderAnalysisReport = (result: AnalysisResult, jdText?: string) => {
    return (
      <div className="space-y-4">
        {/* 适配度评分 */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-base font-medium text-foreground mb-2">适配度评分</h3>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold text-foreground">{result.score}</span>
            <span className="text-lg text-muted-foreground">/10</span>
          </div>
        </div>

        {/* 岗位名称 */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-base font-medium text-foreground mb-2">岗位名称</h3>
          <p className="text-lg font-medium text-foreground">
            {result.company_name && result.job_title ? `${result.company_name} ${result.job_title}` : result.job_title || "未识别"}
          </p>
        </div>

        {/* 招聘信息 */}
        {jdText && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-base font-medium text-foreground mb-2">招聘信息</h3>
            <p className="text-sm text-muted-foreground leading-loose whitespace-pre-wrap">{jdText}</p>
          </div>
        )}

        {/* 公司简介 */}
        {result.company_info && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="font-medium text-foreground mb-2">公司简介</h3>
            <p className="text-sm text-muted-foreground leading-loose whitespace-pre-wrap">
              {result.company_info}
            </p>
          </div>
        )}

        {/* 综合评价 */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="font-medium text-foreground mb-2">综合评价</h3>
          <p className="text-sm text-muted-foreground leading-loose whitespace-pre-wrap">
            {result.overall_review}
          </p>
        </div>

        {/* 已拥有技能 */}
        {result.owned_skills.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="font-medium text-foreground mb-2">已拥有技能</h3>
            <p className="text-sm text-muted-foreground leading-loose">
              {result.owned_skills.join("、")}
            </p>
          </div>
        )}

        {/* 缺失技能 */}
        {result.missing_skills.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="font-medium text-foreground mb-3">缺失技能</h3>
            <div className="space-y-3">
              {result.missing_skills.map((skill, i) => (
                <div key={i} className="rounded-lg bg-muted p-3">
                  <div className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{skill.skill}</p>
                      <p className="mt-1 text-sm text-muted-foreground leading-loose whitespace-pre-wrap">
                        {skill.detail}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 补差计划 */}
        {result.improvement_plan.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="font-medium text-foreground mb-3">补差计划</h3>
            <div className="space-y-3">
              {result.improvement_plan.map((plan, i) => (
                <div key={i} className="rounded-lg bg-muted p-3">
                  <div className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{plan.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground leading-loose whitespace-pre-wrap">
                        {plan.detail}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* JD真实含义 */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="font-medium text-foreground mb-3">JD 真实含义（招聘黑话解读）</h3>
          <div className="space-y-3">
            {result.jd_truth.filter(item => item.phrase && !item.phrase.includes("未检测到")).length === 0 ? (
              <p className="text-sm text-muted-foreground">未检测到招聘黑话</p>
            ) : (
              result.jd_truth.filter(item => item.phrase && !item.phrase.includes("未检测到")).map((item, i) => (
              <div key={i} className="rounded-lg bg-muted p-3">
                <div className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{item.phrase}</p>
                    <p className="mt-1 text-sm text-muted-foreground leading-loose whitespace-pre-wrap">
                      {item.meaning}
                    </p>
                  </div>
                </div>
              </div>
            )))}
          </div>
        </div>
      </div>
    );
  };

  // 渲染面试报告
  const renderInterviewReports = (jdId: string) => {
    const reports = getInterviewReports(jdId);
    if (reports.length === 0) return null;

    return (
      <div className="mt-6 pt-6 border-t border-border">
        <h2 className="text-lg font-bold text-foreground mb-4 text-center">
          面试报告
        </h2>
        {reports.map((interview, idx) => {
          if (!interview.report) return null;
          const report = interview.report;
          return (
            <div key={interview.id} className="mb-6">
              {idx > 0 && <div className="my-6 border-t border-border/50" />}
              {/* 面试概览 */}
              <div className="rounded-lg border border-border bg-card p-4 mb-4">
                <h3 className="text-base font-medium text-foreground mb-3">面试概览</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">应聘岗位</span>
                    <span className="text-sm font-medium text-foreground">{report.overview.jobTitle}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">面试时间</span>
                    <span className="text-sm text-foreground">
                      {new Date(interview.startedAt).toLocaleString("zh-CN", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">面试时长</span>
                    <span className="text-sm text-foreground">{report.overview.duration}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">考察维度</span>
                    <div className="flex flex-wrap gap-1">
                      {report.overview.dimensions.map((dim, i) => (
                        <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs bg-muted text-muted-foreground border border-border/50">
                          {dim}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 面试问答详情 */}
              <div className="mb-4">
                <h3 className="text-base font-medium text-foreground mb-3">面试问答详情</h3>
                {report.qaDetails.map((qa, index) => (
                  <div key={index} className="rounded-lg border border-border bg-card p-4 mb-3">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">面试官提问</p>
                        <p className="text-sm text-foreground font-medium leading-relaxed">{qa.question}</p>
                      </div>
                    </div>
                    <div className="ml-9 mb-3">
                      <p className="text-xs text-muted-foreground mb-1">你的回答要点</p>
                      <p className="text-sm text-foreground leading-relaxed">{qa.answerSummary}</p>
                    </div>
                    <div className="ml-9 bg-muted/60 rounded-lg p-3 border border-border/50">
                      <p className="text-xs font-semibold text-accent mb-2">提升建议</p>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs font-medium text-foreground mb-0.5">内容方面</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{qa.suggestions.content}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-foreground mb-0.5">表达方面</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{qa.suggestions.expression}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 综合评价 */}
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-base font-medium text-foreground mb-3">综合评价与提升总结</h3>
                <div className="mb-3">
                  <p className="text-xs font-medium text-foreground mb-1">回答思路评价</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{report.综合评价.answerApproach}</p>
                </div>
                <div className="mb-3">
                  <p className="text-xs font-medium text-foreground mb-1">语言逻辑评价</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{report.综合评价.languageLogic}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <p className="text-xs font-medium text-foreground mb-1">核心优势</p>
                    <div className="flex flex-wrap gap-1">
                      {report.综合评价.coreStrengths.map((s, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">{s}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground mb-1">待提升项</p>
                    <div className="flex flex-wrap gap-1">
                      {report.综合评价.improvementAreas.map((s, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md text-xs font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">{s}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground mb-1">学习建议</p>
                  <ul className="space-y-1">
                    {report.综合评价.learningSuggestions.map((item: string, i: number) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-accent mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // 空白状态
  if (analyses.length === 0) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-4 relative">
        <div className="text-center max-w-sm">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-5">
            <Library className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            还没有保存的分析记录
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            去 JD分析 页面完成分析后，点击「导出到库」即可保存到这里
          </p>
          <button
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all"
          >
            开始分析
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <label className="absolute left-1/2 -translate-x-1/2 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium hover:bg-muted/80 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap" style={{ top: "calc(50% + 125px)" }}>
          导入记录
          <Upload className="w-4 h-4" />
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (event) => {
                try {
                  const data = JSON.parse(event.target?.result as string);
                  if (Array.isArray(data)) {
                    localStorage.setItem("jd_analyses", JSON.stringify(data));
                    setAnalyses(data);
                  } else {
                    alert("文件格式错误");
                  }
                } catch {
                  alert("文件解析失败");
                }
              };
              reader.readAsText(file);
              e.target.value = "";
            }}
          />
        </label>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 pb-20">
      {/* 页面标题 */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {selectMode && (
            <button
              onClick={() => {
                setSelectMode(false);
                setSelectedIds(new Set());
              }}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <h1 className="text-xl font-semibold text-foreground">
            {selectMode ? `已选择 ${selectedIds.size} 项` : "JD库"}
          </h1>
        </div>
        {!selectMode ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const data = JSON.stringify(analyses, null, 2);
                const blob = new Blob([data], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `jd-library-${new Date().toISOString().split("T")[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              title="导出所有数据"
            >
              导出
            </button>
            <label className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              导入
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    try {
                      const data = JSON.parse(event.target?.result as string);
                      if (Array.isArray(data)) {
                        localStorage.setItem("jd_analyses", JSON.stringify(data));
                        setAnalyses(data);
                        alert("导入成功");
                      } else {
                        alert("文件格式错误");
                      }
                    } catch {
                      alert("文件解析失败");
                    }
                  };
                  reader.readAsText(file);
                }}
              />
            </label>
            <button
              onClick={() => setSelectMode(true)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              选择
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setSelectMode(false);
              setSelectedIds(new Set());
            }}
            className="p-2 rounded-lg bg-primary text-primary-foreground transition-colors"
          >
            <Check className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* 搜索和筛选 */}
      {analyses.length > 0 && !selectMode && (
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {/* 搜索框 */}
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="搜索公司或职位..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* 评分筛选 */}
          <div className="flex gap-2">
            {[
              { value: "all", label: "全部" },
              { value: "high", label: "8-10分" },
              { value: "medium", label: "6-7分" },
              { value: "low", label: "5分以下" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setScoreFilter(option.value as typeof scoreFilter)}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  scoreFilter === option.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          
          {/* 排序方式 */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-2 rounded-[10px] text-sm bg-muted text-muted-foreground border-none focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
          >
            <option value="time-desc">最新优先</option>
            <option value="time-asc">最早优先</option>
            <option value="score-desc">评分从高到低</option>
            <option value="score-asc">评分从低到高</option>
            <option value="missing-desc">缺失技能多到少</option>
          </select>
        </div>
      )}

      {/* 分析列表 */}
      {filteredAnalyses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-muted-foreground/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <p className="text-muted-foreground">未找到匹配的记录</p>
          <button
            onClick={() => {
              setSearchQuery("");
              setScoreFilter("all");
            }}
            className="mt-4 text-sm text-primary hover:underline"
          >
            清除筛选条件
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAnalyses.map((analysis) => (
            <div
              key={analysis.id}
              className={`rounded-lg border border-border bg-card p-4 shadow-card transition-all duration-200 cursor-pointer hover:border-primary/50 hover:shadow-float hover:-translate-y-0.5 ${
                selectMode && selectedIds.has(analysis.id)
                  ? "ring-2 ring-primary"
                  : ""
              }`}
              onClick={() => {
                if (selectMode) {
                  toggleSelect(analysis.id);
                } else {
                  setViewAnalysis(analysis);
                }
              }}
            >
              <div className="flex items-start gap-3">
                {/* 选择框 */}
                {selectMode && (
                  <div
                    className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      selectedIds.has(analysis.id)
                        ? "bg-primary border-primary"
                        : "border-muted-foreground/30"
                    }`}
                  >
                    {selectedIds.has(analysis.id) && (
                      <Check className="w-3 h-3 text-primary-foreground" />
                    )}
                  </div>
                )}

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <h3 className="font-medium text-foreground truncate">
                        {analysis.jobTitle}
                      </h3>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(analysis);
                        }}
                        className="shrink-0 p-1 rounded hover:bg-muted transition-colors"
                        title="编辑"
                      >
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                    <span className="text-2xl font-bold text-foreground shrink-0">
                      {analysis.result.score}
                      <span className="text-sm font-normal text-muted-foreground">
                        /10
                      </span>
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {analysis.result.overall_review}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{formatDate(analysis.createdAt)}</span>
                    <span>·</span>
                    <span>
                      已拥有 {analysis.result.owned_skills.length} 项技能
                    </span>
                    <span>·</span>
                    <span>
                      缺失 {analysis.result.missing_skills.length} 项技能
                    </span>
                  </div>
                  {/* 面试报告区域 */}
                  {(() => {
                    const reports = getInterviewReports(analysis.id);
                    if (reports.length === 0) return null;
                    return (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">面试报告 ({reports.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {reports.slice(0, 3).map((report) => (
                            <div
                              key={report.id}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-muted/50 border border-border/50 group"
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/interview-report?id=${report.id}`);
                                }}
                                className="flex items-center gap-1.5 text-xs text-foreground hover:text-primary transition-colors"
                              >
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span>{formatDate(report.startedAt)}</span>
                                <span className="text-muted-foreground">·</span>
                                <span className="text-muted-foreground">{report.messages.length}轮</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm("确定要删除这份面试报告吗？")) {
                                    deleteInterview(report.id);
                                    setAnalyses([...analyses]); // 触发重新渲染
                                  }
                                }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-destructive transition-all"
                                title="删除报告"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                          {reports.length > 3 && (
                            <span className="flex items-center px-2 py-1.5 text-xs text-muted-foreground">
                              +{reports.length - 3} 更多
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 选择模式下的底部操作栏 */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-sm p-4">
          <div className="mx-auto max-w-7xl flex items-center gap-3">
            <button
              onClick={handleCompare}
              className="flex-1 py-3 rounded-lg bg-primary text-primary-foreground font-medium transition-colors hover:bg-primary/90"
            >
              对比分析
            </button>
            <button
              onClick={handleDelete}
              className="p-3 rounded-lg bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* 查看详情弹窗 */}
      {viewAnalysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-7xl max-h-[90vh] overflow-hidden rounded-lg bg-background border border-border shadow-xl flex flex-col">
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
              <div>
                <h2 className="font-semibold text-foreground">
                  {viewAnalysis.jobTitle}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {formatDate(viewAnalysis.createdAt)}
                </p>
              </div>
              <button
                onClick={() => setViewAnalysis(null)}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="flex-1 overflow-y-auto p-4" ref={reportRef}>
              {/* 报告标题 - 包含职位名称 */}
              <div className="mb-6 text-center">
                <h2 className="text-xl font-bold text-foreground">
                  {viewAnalysis.jobTitle}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  分析日期：{formatDate(viewAnalysis.createdAt)}
                </p>
              </div>
              {renderAnalysisReport(viewAnalysis.result, viewAnalysis.jdText)}
              {/* 面试报告 */}
              {renderInterviewReports(viewAnalysis.id)}
            </div>

            {/* 弹窗底部按钮 */}
            <div className="flex flex-col items-center justify-center gap-3 p-4 border-t border-border shrink-0">
              <div className="flex items-center gap-3">
                {!showFormatSelector ? (
                  <button
                    onClick={() => setShowFormatSelector(true)}
                    className="flex items-center justify-center gap-2 px-8 py-2.5 rounded-lg bg-muted text-foreground font-medium transition-colors hover:bg-muted/80"
                  >
                    <Download className="h-4 w-4" />
                    保存
                  </button>
                ) : (
                  <div className="flex flex-col md:flex-row items-center justify-center gap-2 w-full px-4">
                    <button
                      onClick={() => { handleExportPdf(); setShowFormatSelector(false); }}
                      className="flex items-center gap-2 w-full md:w-auto justify-center px-6 py-2.5 rounded-lg bg-muted text-foreground text-sm font-medium transition-colors hover:bg-muted/80"
                    >
                      <FileText className="h-4 w-4" />
                      保存为 PDF
                    </button>
                    <button
                      onClick={() => { handleExportImage(); setShowFormatSelector(false); }}
                      className="flex items-center gap-2 w-full md:w-auto justify-center px-6 py-2.5 rounded-lg bg-muted text-foreground text-sm font-medium transition-colors hover:bg-muted/80"
                    >
                      <Image className="h-4 w-4" />
                      保存为图片
                    </button>
                    <button
                      onClick={() => setShowFormatSelector(false)}
                      className="flex items-center gap-2 w-full md:w-auto justify-center px-6 py-2.5 rounded-lg text-muted-foreground text-sm font-medium transition-colors hover:bg-muted/50"
                    >
                      取消
                    </button>
                  </div>
                )}
                {/* 模拟面试按钮 */}
                {!showFormatSelector && viewAnalysis && (
                  <button
                    onClick={() => {
                      setViewAnalysis(null);
                      router.push(`/interview?jdId=${viewAnalysis.id}`);
                    }}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium transition-colors hover:bg-primary/90"
                  >
                    <MessageSquare className="h-4 w-4" />
                    模拟面试
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 编辑弹窗 */}
      {editingAnalysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setEditingAnalysis(null)}>
          <div className="bg-card rounded-xl p-6 w-full max-w-md shadow-float" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-foreground mb-4">编辑记录</h3>

            <div className="mb-4">
              <label className="block text-sm text-muted-foreground mb-1.5">岗位名称</label>
              <input
                type="text"
                value={editingAnalysis.jobTitle}
                onChange={(e) => setEditingAnalysis({ ...editingAnalysis, jobTitle: e.target.value })}
                className="w-full rounded-md bg-muted border-none px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-muted-foreground mb-1.5">招聘信息</label>
              <textarea
                value={editingAnalysis.jdText || ""}
                onChange={(e) => setEditingAnalysis({ ...editingAnalysis, jdText: e.target.value })}
                rows={6}
                className="w-full rounded-md bg-muted border-none px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setEditingAnalysis(null)}
                className="flex-1 rounded-md bg-muted px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm text-primary-foreground hover:opacity-90 transition-opacity"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 存储空间提示 */}
      {analyses.length > 0 && (
        <div className="mt-8 text-center text-xs text-muted-foreground">
          <p>当前存储 {analyses.length} 份报告 · 已用空间约 {Math.round(JSON.stringify(analyses).length / 1024)}KB / 5MB</p>
          <p className="mt-1">建议定期导出备份，避免清理浏览器缓存后数据丢失</p>
        </div>
      )}

      {/* Toast 提示 */}
      {toast.visible && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 rounded-lg bg-foreground px-4 py-3 text-sm text-background shadow-float">
            <span>{toast.message}</span>
            <button
              onClick={handleUndoDelete}
              className="font-medium text-accent hover:underline"
            >
              撤销
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
