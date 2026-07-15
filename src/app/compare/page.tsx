"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, FileText, Image as ImageIcon, GitCompare, ArrowRight } from "lucide-react";
import { getSavedAnalyses, type SavedAnalysis } from "@/lib/jd-storage";
import { generateComparisonReport } from "@/lib/compare-ai";
import { exportToPdf, exportToImage } from "@/lib/export-utils";

type ReportStatus = "empty" | "loading" | "done" | "error";

interface CompareCache {
  status: ReportStatus;
  report: string;
  progress: number;
  progressText: string;
}

export default function ComparePage() {
  const router = useRouter();
  const reportRef = useRef<HTMLDivElement>(null);
  const [showFormatSelector, setShowFormatSelector] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 从 sessionStorage 加载缓存的状态
  const [status, setStatus] = useState<ReportStatus>(() => {
    if (typeof window === 'undefined') return 'empty';
    try {
      const cached = sessionStorage.getItem('compare-analysis-cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        // 缓存有效期 24 小时
        const now = new Date().getTime();
        if (now - parsed.timestamp < 24 * 60 * 60 * 1000) {
          return parsed.status as ReportStatus;
        }
      }
    } catch {}
    return 'empty';
  });

  const [report, setReport] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      const cached = sessionStorage.getItem('compare-analysis-cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        const now = new Date().getTime();
        if (now - parsed.timestamp < 24 * 60 * 60 * 1000) {
          return parsed.report as string;
        }
      }
    } catch {}
    return '';
  });

  const [progress, setProgress] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const cached = sessionStorage.getItem('compare-analysis-cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        const now = new Date().getTime();
        if (now - parsed.timestamp < 24 * 60 * 60 * 1000) {
          return parsed.progress as number;
        }
      }
    } catch {}
    return 0;
  });

  const [progressText, setProgressText] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      const cached = sessionStorage.getItem('compare-analysis-cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        const now = new Date().getTime();
        if (now - parsed.timestamp < 24 * 60 * 60 * 1000) {
          return parsed.progressText as string;
        }
      }
    } catch {}
    return '';
  });

  // 缓存状态到 sessionStorage
  const cacheState = (newStatus: ReportStatus, newReport: string, newProgress: number, newProgressText: string) => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem('compare-analysis-cache', JSON.stringify({
        status: newStatus,
        report: newReport,
        progress: newProgress,
        progressText: newProgressText,
        timestamp: Date.now()
      }));
    } catch {}
  };

  // 将 Markdown 转换为简单 HTML（不依赖外部库）
  const renderMarkdown = (md: string) => {
    // 移除报告标题（已在页面中显示）
    let html = md.replace(/^#\s*多岗位对比分析与求职策略报告\s*\n*/i, '');
    html = html.replace(/^#\s*.*求职策略.*报告\s*\n*/i, '');
    
    // 移除分隔线（---）
    html = html.replace(/^---+\s*$/gm, '');
    
    // 移除 mermaid 代码块（不渲染图表）
    html = html.replace(/```mermaid[\s\S]*?```/g, '<p class="text-sm text-muted-foreground italic">[图表已省略]</p>');
    
    // 转换标题
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-6 mb-3">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-8 mb-4">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>');
    
    // 转换粗体和斜体
    html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // 转换表格 - 改进版本
    // 首先找到所有表格块（连续的以|开头的行）
    html = html.replace(/((?:^\|.*\|\s*\n?)+)/gm, (tableBlock) => {
      const rows = tableBlock.trim().split('\n');
      if (rows.length < 2) return tableBlock;
      
      let tableHtml = '<table class="w-full border-collapse border border-border my-4">';
      
      // 处理每一行
      rows.forEach((row, index) => {
        const cells = row.split('|').filter(c => c.trim() !== '');
        
        // 跳过分隔行（包含---的行）
        if (cells.every(c => /^[\s-:]+$/.test(c))) return;
        
        // 第一行是表头
        if (index === 0) {
          const headerCells = cells.map(c => `<th class="border border-border px-3 py-2 bg-muted font-semibold text-left">${c.trim()}</th>`).join('');
          tableHtml += `<thead><tr>${headerCells}</tr></thead><tbody>`;
        } else {
          const dataCells = cells.map(c => `<td class="border border-border px-3 py-2">${c.trim()}</td>`).join('');
          tableHtml += `<tr>${dataCells}</tr>`;
        }
      });
      
      tableHtml += '</tbody></table>';
      return tableHtml;
    });
    
    // 转换列表
    html = html.replace(/^- (.*$)/gim, '<li class="ml-4 list-disc">$1</li>');
    html = html.replace(/(<li.*<\/li>\n?)+/g, '<ul class="my-2 space-y-1">$&</ul>');
    
    // 转换段落
    html = html.replace(/\n\n/g, '</p><p class="my-3 leading-relaxed">');
    html = '<p class="my-3 leading-relaxed">' + html + '</p>';
    
    // 清理空标签
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<h[123])/g, '$1');
    html = html.replace(/(<\/h[123]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<table)/g, '$1');
    html = html.replace(/(<\/table>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ul)/g, '$1');
    html = html.replace(/(<\/ul>)<\/p>/g, '$1');
    
    return html;
  };

  const generateReport = useCallback(async (analyses: SavedAnalysis[]) => {
    setStatus("loading");
    setProgress(0);
    setProgressText("正在分析数据...");
    cacheState("loading", "", 0, "正在分析数据...");

    try {
      const progressInterval = setInterval(() => {
        setProgress((prev: number) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 5;
        });
        setProgressText((prev: string) => {
          if (prev === "正在分析数据...") return "正在对比技能...";
          if (prev === "正在对比技能...") return "正在生成报告...";
          return "正在优化排版...";
        });
      }, 1000);

      const result = await generateComparisonReport(analyses);

      clearInterval(progressInterval);
      setProgress(100);
      setProgressText("分析完成");
      setReport(result);
      setStatus("done");
      cacheState("done", result, 100, "分析完成");
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成报告失败");
      setStatus("error");
      cacheState("error", "", 0, "");
    }
  }, []);

  useEffect(() => {
    // 先检查是否有缓存的状态
    const cached = sessionStorage.getItem("compareCache");
    if (cached) {
      try {
        const cache: CompareCache = JSON.parse(cached);
        setStatus(cache.status);
        setReport(cache.report);
        setProgress(cache.progress);
        setProgressText(cache.progressText);
        // 如果有缓存，不再生成新报告
        return;
      } catch {
        // 缓存解析失败，继续正常流程
      }
    }

    const compareIdsStr = sessionStorage.getItem("compareIds");
    if (!compareIdsStr) return;

    const compareIds: string[] = JSON.parse(compareIdsStr);
    const allAnalyses = getSavedAnalyses();
    const selected = allAnalyses.filter((a) => compareIds.includes(a.id));

    if (selected.length >= 2) {
      generateReport(selected);
    } else {
      setError("请至少选择 2 个岗位进行对比");
      setStatus("error");
    }

    // 清除 sessionStorage，防止刷新后重复触发
    sessionStorage.removeItem("compareIds");
  }, [generateReport]);

  const handleSavePdf = async () => {
    if (!reportRef.current) return;
    await exportToPdf(reportRef.current, "多岗位对比分析报告");
  };

  const handleSaveImage = async () => {
    if (!reportRef.current) return;
    await exportToImage(reportRef.current, "多岗位对比分析报告");
  };

  // 空白状态
  if (status === "empty") {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-5">
            <GitCompare className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            多岗位对比分析
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            在JD库中选择2-5份岗位分析报告，进行多维度横向对比，帮助你快速找到最适合的机会
          </p>
          <button
            onClick={() => router.push("/library")}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all"
          >
            前往JD库选择
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>
    );
  }

  // 加载状态
  if (status === "loading") {
    return (
      <main className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex flex-col items-center gap-6">
          <Loader2 className="h-10 w-10 animate-spin text-foreground" />
          <div className="text-center">
            <p className="text-lg font-medium text-foreground">{progressText}</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{progress}%</p>
          </div>
          <div className="h-2 w-64 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-foreground transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </main>
    );
  }

  // 错误状态
  if (status === "error") {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-destructive">生成失败</p>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => router.push("/library")}
            className="mt-6 rounded-lg bg-foreground px-6 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80"
          >
            返回JD库
          </button>
        </div>
      </main>
    );
  }

  // 报告完成状态
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 pb-24">
      {/* 报告内容 */}
      <div ref={reportRef} className="rounded-lg border border-border bg-card p-4 md:p-6 shadow-card">
        {/* 报告标题 */}
        <h1 className="mb-6 text-center text-xl md:text-2xl font-bold text-foreground">
          多岗位对比分析与求职策略报告
        </h1>
        <div
          className="prose prose-sm max-w-none text-sm text-foreground prose-table:block prose-table:overflow-x-auto prose-th:px-2 prose-td:px-2 prose-table:text-xs md:prose-table:text-sm"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(report) }}
        />
      </div>


      {/* 保存按钮 */}
      <div className="mt-8 flex flex-col items-center justify-center gap-3">
        {!showFormatSelector ? (
          <button
            onClick={() => setShowFormatSelector(true)}
            className="flex items-center justify-center gap-2 rounded-lg bg-muted px-8 py-2.5 font-medium text-foreground transition-colors hover:bg-muted/80"
          >
            <Download className="h-4 w-4" />
            保存
          </button>
        ) : (
          <div className="flex flex-col md:flex-row items-center justify-center gap-2 w-full px-4">
            <button
              onClick={() => { handleSavePdf(); setShowFormatSelector(false); }}
              className="flex items-center gap-2 w-full md:w-auto justify-center rounded-lg bg-muted px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
            >
              <FileText className="h-4 w-4" />
              保存为 PDF
            </button>
            <button
              onClick={() => { handleSaveImage(); setShowFormatSelector(false); }}
              className="flex items-center gap-2 w-full md:w-auto justify-center rounded-lg bg-muted px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
            >
              <ImageIcon className="h-4 w-4" />
              保存为图片
            </button>
            <button
              onClick={() => setShowFormatSelector(false)}
              className="flex items-center gap-2 w-full md:w-auto justify-center rounded-lg px-6 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50"
            >
              取消
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
