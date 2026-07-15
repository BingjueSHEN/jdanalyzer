"use client";
import { useState, useRef, useEffect } from "react";
import { callAIForAnalysis } from "@/lib/api-client";
import {
    getConfig,
    getUsageCount,
    incrementUsageCount,
    hasVisited,
    setVisited,
} from "@/lib/storage";
import { SettingsModal } from "@/components/settings-modal";
import { WelcomeModal } from "@/components/welcome-modal";
import { FileUploadPanel, type UploadedFile } from "@/components/file-upload-panel";
import { AnalysisResultDisplay } from "@/components/analysis-result";

// Re-export types for backward compatibility
export type { MissingSkill, ImprovementPlan, JDTruth, AnalysisResult } from "@/lib/types";
import type { AnalysisResult } from "@/lib/types";

export default function HomePage() {
    const [jdText, setJdText] = useState("");
    const [resumeFile, setResumeFile] = useState<UploadedFile | null>(null);
    const [portfolioFile, setPortfolioFile] = useState<UploadedFile | null>(null);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const resultRef = useRef<HTMLDivElement>(null);
    const [jobTitle, setJobTitle] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingText, setLoadingText] = useState("");
    const [analysisStep, setAnalysisStep] = useState(0); // 0: idle, 1: preparing, 2: analyzing, 3: generating
    const [showSettings, setShowSettings] = useState(false);
    const [showWelcome, setShowWelcome] = useState(false);
    const [usageCount, setUsageCount] = useState(0);

    useEffect(() => {
        const savedResult = sessionStorage.getItem("jd_analysis_result");

        if (savedResult) {
            try {
                const parsed = JSON.parse(savedResult);
                setResult(parsed.result);
                setJobTitle(parsed.jobTitle);
            } catch (e) {
                console.error("Failed to parse saved result:", e);
            }
        }
    }, []);

    useEffect(() => {
        if (result) {
            sessionStorage.setItem("jd_analysis_result", JSON.stringify({
                result,
                jobTitle
            }));
        }
    }, [result, jobTitle]);

    useEffect(() => {
        if (!hasVisited()) {
            setShowWelcome(true);
            setVisited();
        }

        setUsageCount(getUsageCount());

        try {
            const savedResume = sessionStorage.getItem("jd_resume");

            if (savedResume) {
                setResumeFile(JSON.parse(savedResume));
            }

            const savedPortfolio = sessionStorage.getItem("jd_portfolio");

            if (savedPortfolio) {
                setPortfolioFile(JSON.parse(savedPortfolio));
            }

            const savedJdText = sessionStorage.getItem("jd_text");

            if (savedJdText) {
                setJdText(savedJdText);
            }
        } catch (e) {
            console.error("Failed to restore file state:", e);
        }
    }, []);

    useEffect(() => {
        if (resumeFile) {
            sessionStorage.setItem("jd_resume", JSON.stringify(resumeFile));
        }
    }, [resumeFile]);

    useEffect(() => {
        if (portfolioFile) {
            sessionStorage.setItem("jd_portfolio", JSON.stringify(portfolioFile));
        }
    }, [portfolioFile]);

    useEffect(() => {
        if (jdText) {
            sessionStorage.setItem("jd_text", jdText);
        }
    }, [jdText]);

    const handleWelcomeConfigure = () => {
        setShowWelcome(false);
        setShowSettings(true);
    };

    const handleAnalyze = async () => {
        if (!jdText.trim()) {
            alert("请输入招聘信息");
            return;
        }

        if (!resumeFile || resumeFile.status !== "done") {
            alert("请上传并等待简历识别完成");
            return;
        }

        const config = getConfig();

        if (!config.text?.apiKey) {
            alert("请先在设置中配置文本分析 API Key");
            setShowSettings(true);
            return;
        }

        setLoading(true);
        setResult(null);
        setJobTitle("");
        setAnalysisStep(1);
        setLoadingText("正在准备数据...");

        try {
            // Step 1: Prepare data
            await new Promise(resolve => setTimeout(resolve, 300));
            setAnalysisStep(2);
            setLoadingText("正在解读招聘信息...");
            
            // Step 2: AI Analysis
            const portfolioText = portfolioFile?.status === "done" ? portfolioFile.text : "";
            
            // Update loading text during AI call
            setTimeout(() => {
                if (loading) {
                    setLoadingText("正在寻找你的技能闪光点...");
                }
            }, 3000);
            setTimeout(() => {
                if (loading) {
                    setLoadingText("正在解读招聘黑话...");
                }
            }, 6000);
            
            const analysisResult = await callAIForAnalysis(jdText, resumeFile.text, portfolioText, config.text);
            
            setAnalysisStep(3);
            setLoadingText("正在生成报告...");
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // 将原始招聘信息添加到结果中
            setResult({ ...analysisResult, jd_text: jdText });
            setJobTitle(analysisResult.job_title || "");
            incrementUsageCount();
            setUsageCount(getUsageCount());
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "未知错误";
            console.error("Analysis error:", err);
            alert("分析失败: " + msg);
        } finally {
            setLoading(false);
            setLoadingText("");
            setAnalysisStep(0);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            {}
            {}
            <header className="bg-primary animate-fade-in-up stagger-1">
                <div
                    className="mx-auto flex max-w-7xl flex-col items-center justify-center px-4 py-4 relative">
                    <h1
                        className="text-xl font-bold text-primary-foreground"
                        style={{
                            fontSize: "24px"
                        }}>JD分析器</h1>
                    <p
                        className="mt-1 text-sm text-primary-foreground/70"
                        style={{
                            fontSize: "12px",
                            fontFamily: "\"Noto Sans SC\", sans-serif"
                        }}>今天你拿到offer了吗</p>
                    <button
                        onClick={() => setShowSettings(true)}
                        className="absolute right-4 top-4 rounded-lg p-2 text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground btn-press"
                        title="API 设置">
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2">
                            <circle cx="12" cy="12" r="3" />
                            <path
                                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                    </button>
                </div>
            </header>
            {}
            <main className="mx-auto max-w-7xl px-4 py-8">
                {}
                {}
                <div
                    className="mb-3 rounded-lg border border-border bg-card p-5 shadow-card md:mb-6 animate-fade-in-up stagger-2"
                    style={{
                        borderRadius: "12px"
                    }}>
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="font-semibold text-foreground">招聘信息</h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={async () => {
                                    try {
                                        const text = await navigator.clipboard.readText();
                                        setJdText(text);
                                    } catch {
                                        alert("无法读取剪贴板，请手动粘贴");
                                    }
                                }}
                                className="flex items-center gap-1 rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground btn-press">
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2">
                                    <path
                                        d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                                </svg>从剪贴板粘贴
                            </button>
                            <button
                                onClick={() => { setJdText(""); sessionStorage.removeItem("jd_text"); }}
                                className="flex items-center gap-1 rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground btn-press">
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                </svg>清除内容
                            </button>
                        </div>
                    </div>
                    <textarea
                        value={jdText}
                        onChange={e => setJdText(e.target.value)}
                        placeholder="粘贴招聘 JD 全文..."
                        className="h-32 w-full resize-none rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
                </div>
                {}
                <div className="mb-3 grid gap-3 md:mb-6 md:gap-6 md:grid-cols-2 animate-fade-in-up stagger-3">
                    <FileUploadPanel title="个人简历" file={resumeFile} onFileChange={setResumeFile} maxSizeMB={5} />
                    <FileUploadPanel title="作品集" optional file={portfolioFile} onFileChange={setPortfolioFile} maxSizeMB={20} />
                </div>
                {}
                <div className="mb-8 flex justify-center animate-fade-in-up stagger-4">
                    <button
                        onClick={handleAnalyze}
                        disabled={loading}
                        className="rounded-lg bg-primary px-8 py-3 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all btn-press dark:bg-muted dark:text-foreground dark:hover:bg-muted/80"
                        style={{
                            fontSize: "18px"
                        }}>
                        {loading ? loadingText || "分析中..." : "开始分析"}
                    </button>
                </div>

                {/* 骨架屏加载 */}
                {loading && !result && (
                    <div className="space-y-6">
                        {/* 进度步骤指示器 */}
                        <div className="flex items-center justify-center gap-2 mb-6">
                            {[
                                { step: 1, label: "准备数据" },
                                { step: 2, label: "AI分析" },
                                { step: 3, label: "生成报告" },
                            ].map((item, index) => (
                                <div key={item.step} className="flex items-center">
                                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                                        analysisStep >= item.step 
                                            ? "bg-primary text-primary-foreground" 
                                            : "bg-muted text-muted-foreground"
                                    }`}>
                                        {analysisStep > item.step ? "✓" : item.step}
                                    </div>
                                    <span className={`ml-2 text-sm ${
                                        analysisStep >= item.step ? "text-foreground" : "text-muted-foreground"
                                    }`}>{item.label}</span>
                                    {index < 2 && (
                                        <div className={`w-8 h-0.5 mx-2 ${
                                            analysisStep > item.step ? "bg-primary" : "bg-muted"
                                        }`} />
                                    )}
                                </div>
                            ))}
                        </div>
                        
                        {/* 当前步骤提示 */}
                        <div className="text-center text-sm text-muted-foreground mb-4">
                            {loadingText}
                        </div>
                        
                        {/* 骨架屏 */}
                        <div className="space-y-6 animate-pulse">
                        {/* 评分环骨架 */}
                        <div className="flex justify-center">
                            <div className="w-40 h-40 rounded-full bg-muted" />
                        </div>
                        {/* 卡片骨架 */}
                        <div className="space-y-4">
                            <div className="rounded-lg border border-border bg-card p-6">
                                <div className="h-4 w-20 bg-muted rounded mb-3" />
                                <div className="h-5 w-48 bg-muted rounded" />
                            </div>
                            <div className="rounded-lg border border-border bg-card p-6">
                                <div className="h-4 w-20 bg-muted rounded mb-3" />
                                <div className="space-y-2">
                                    <div className="h-4 w-full bg-muted rounded" />
                                    <div className="h-4 w-full bg-muted rounded" />
                                    <div className="h-4 w-3/4 bg-muted rounded" />
                                </div>
                            </div>
                            <div className="rounded-lg border border-border bg-card p-6">
                                <div className="h-4 w-20 bg-muted rounded mb-3" />
                                <div className="flex flex-wrap gap-2">
                                    <div className="h-7 w-16 bg-muted rounded-full" />
                                    <div className="h-7 w-20 bg-muted rounded-full" />
                                    <div className="h-7 w-14 bg-muted rounded-full" />
                                    <div className="h-7 w-18 bg-muted rounded-full" />
                                </div>
                            </div>
                        </div>
                        </div>
                    </div>
                )}

                {}
                {result && (
                    <div ref={resultRef} className="animate-scale-in">
                        <AnalysisResultDisplay
                            result={result}
                            jobTitle={jobTitle}
                            jdText={jdText}
                            resumeText={resumeFile?.text || ""}
                            portfolioText={portfolioFile?.text || ""}
                        />
                    </div>
                )}
            </main>
            <footer
                className="border-t border-border py-6 text-center"
                style={{
                    backgroundColor: "var(--muted)",
                    borderWidth: "0px"
                }}>
                <p className="text-sm text-muted-foreground">你已分析 {usageCount}份 JD
                </p>
            </footer>
            {}
            <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
            {showWelcome && <WelcomeModal onConfigure={handleWelcomeConfigure} />}
        </div>
    );
}
