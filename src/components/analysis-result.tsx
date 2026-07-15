"use client";
import { useState, useEffect } from "react";
import type { AnalysisResult } from "@/lib/types";

export function AnalysisResultDisplay({
    result,
    jobTitle,
    jdText,
    resumeText,
    portfolioText,
}: {
    result: AnalysisResult;
    jobTitle: string;
    jdText: string;
    resumeText: string;
    portfolioText?: string;
}) {
    const [animatedScore, setAnimatedScore] = useState(0);
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(['jd_text']));

    useEffect(() => {
        setAnimatedScore(0);
        const targetScore = result.score;
        const duration = 1000;
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setAnimatedScore(Math.round(eased * targetScore * 10) / 10);
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        requestAnimationFrame(animate);
    }, [result]);

    const toggleSection = (section: string) => {
        setCollapsedSections(prev => {
            const next = new Set(prev);
            if (next.has(section)) {
                next.delete(section);
            } else {
                next.add(section);
            }
            return next;
        });
    };

    const handleExportToLibrary = () => {
        const title = result.job_title || jobTitle || "未命名岗位";
        const company = result.company_name || "未知公司";
        const combinedTitle = `${company} ${title}`;

        const savedAnalysis = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2),
            createdAt: Date.now(),
            jobTitle: combinedTitle,
            companyName: company,
            jdText: result.jd_text || jdText,
            resumeText: resumeText || "",
            portfolioText: portfolioText || "",
            result: result
        };

        const existing = localStorage.getItem("jd_analyses");
        const analyses = existing ? JSON.parse(existing) : [];
        analyses.unshift(savedAnalysis);
        localStorage.setItem("jd_analyses", JSON.stringify(analyses));
        alert(`已保存到JD库：${combinedTitle}`);
    };

    return (
        <div
            id="jd-analysis-result"
            className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2
                className="text-center text-lg font-semibold text-foreground"
                style={{
                    fontSize: "24px"
                }}>分析结果</h2>
            {/* 评分环 - 带动画 */}
            <div className="flex flex-col items-center">
                <div className="relative">
                    <svg width="160" height="160" viewBox="0 0 160 160">
                        {/* 背景圆环 */}
                        <circle cx="80" cy="80" r="70" fill="none" stroke="#E5E5E5" strokeWidth="12" />
                        {/* 进度圆环 - 使用动画分数 */}
                        <circle
                            cx="80"
                            cy="80"
                            r="70"
                            fill="none"
                            stroke={animatedScore >= 8 ? "#22c55e" : animatedScore >= 6 ? "#F97316" : "#ef4444"}
                            strokeWidth="12"
                            strokeLinecap="round"
                            strokeDasharray={`${animatedScore / 10 * 440} 440`}
                            transform="rotate(-90 80 80)"
                            style={{ transition: 'stroke 0.3s ease' }}
                        />
                    </svg>
                    {/* 中心分数 */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-bold text-foreground">{animatedScore.toFixed(1)}</span>
                        <span className="text-sm text-muted-foreground">/10</span>
                    </div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">适配度评分</p>
            </div>
            {/* 岗位名称 */}
            <div className="rounded-lg border border-border bg-card p-6 shadow-card transition-all duration-200 hover:shadow-float hover:-translate-y-0.5 animate-fade-in-up stagger-1">
                <h3 className="mb-3 font-semibold text-foreground">岗位名称</h3>
                <p className="text-lg font-medium text-foreground">
                    {result.company_name && result.job_title ? `${result.company_name} ${result.job_title}` : result.job_title || jobTitle || "未识别"}
                </p>
            </div>
            {/* 招聘信息 - 可折叠 */}
            {result.jd_text && (
                <div className="rounded-lg border border-border bg-card p-6 shadow-card transition-all duration-200 hover:shadow-float hover:-translate-y-0.5 animate-fade-in-up stagger-2">
                    <button
                        onClick={() => toggleSection("jd_text")}
                        className="flex w-full items-center justify-between text-left"
                    >
                        <h3 className="font-semibold text-foreground">招聘信息</h3>
                        <svg
                            className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ease-out ${collapsedSections.has("jd_text") ? "" : "rotate-180"}`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <path d="M18 15l-6-6-6 6" />
                        </svg>
                    </button>
                    <div className={`grid transition-all duration-300 ease-out ${collapsedSections.has("jd_text") ? "grid-rows-[0fr]" : "grid-rows-[1fr]"}`}>
                        <div className="overflow-hidden">
                            <p className="pt-4 text-sm text-muted-foreground leading-loose whitespace-pre-wrap">
                                {result.jd_text}
                            </p>
                        </div>
                    </div>
                </div>
            )}
            {/* 公司简介 - 可折叠 */}
            {result.company_info && (
                <div className="rounded-lg border border-border bg-card p-6 shadow-card transition-all duration-200 hover:shadow-float hover:-translate-y-0.5 animate-fade-in-up stagger-3">
                    <button
                        onClick={() => toggleSection("company_info")}
                        className="flex w-full items-center justify-between text-left"
                    >
                        <h3 className="font-semibold text-foreground">公司简介</h3>
                        <svg
                            className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ease-out ${collapsedSections.has("company_info") ? "" : "rotate-180"}`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <path d="M18 15l-6-6-6 6" />
                        </svg>
                    </button>
                    <div className={`grid transition-all duration-300 ease-out ${collapsedSections.has("company_info") ? "grid-rows-[0fr]" : "grid-rows-[1fr]"}`}>
                        <div className="overflow-hidden">
                            <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-loose pt-3">{result.company_info}</p>
                        </div>
                    </div>
                </div>
            )}
            {/* 综合评价 - 可折叠 */}
            <div className="rounded-lg border border-border bg-card p-6 shadow-card transition-all duration-200 hover:shadow-float hover:-translate-y-0.5 animate-fade-in-up stagger-4">
                <button
                    onClick={() => toggleSection("overall_review")}
                    className="flex w-full items-center justify-between text-left"
                >
                    <h3 className="font-semibold text-foreground">综合评价</h3>
                    <svg
                        className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ease-out ${collapsedSections.has("overall_review") ? "" : "rotate-180"}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <path d="M18 15l-6-6-6 6" />
                    </svg>
                </button>
                <div className={`grid transition-all duration-300 ease-out ${collapsedSections.has("overall_review") ? "grid-rows-[0fr]" : "grid-rows-[1fr]"}`}>
                    <div className="overflow-hidden">
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-loose pt-3">{result.overall_review}</p>
                    </div>
                </div>
            </div>
            {}
            {}
            {/* 已拥有技能 - 标签样式 */}
            <div className="rounded-lg border border-border bg-card p-6 shadow-card transition-all duration-200 hover:shadow-float hover:-translate-y-0.5 animate-fade-in-up stagger-5">
                <h3 className="mb-3 font-semibold text-foreground">已拥有技能</h3>
                <div className="flex flex-wrap gap-2">
                    {result.owned_skills.map((skill, i) => (
                        <span key={i} className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm text-foreground border border-border">
                            {skill}
                        </span>
                    ))}
                </div>
            </div>
            {/* 缺失技能 - 可折叠 */}
            <div className="rounded-lg border border-border bg-card p-6 shadow-card transition-all duration-200 hover:shadow-float hover:-translate-y-0.5 animate-fade-in-up stagger-6">
                <button
                    onClick={() => toggleSection("missing_skills")}
                    className="flex w-full items-center justify-between text-left"
                >
                    <h3 className="font-semibold text-foreground">缺失技能</h3>
                    <svg
                        className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${collapsedSections.has("missing_skills") ? "" : "rotate-180"}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <path d="M18 15l-6-6-6 6" />
                    </svg>
                </button>
                <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${collapsedSections.has("missing_skills") ? "grid-rows-[0fr]" : "grid-rows-[1fr]"}`}>
                    <div className="overflow-hidden">
                        <div className="space-y-4 pt-4">
                            {result.missing_skills.map((skill, i) => <div key={i} className="rounded-lg bg-muted p-4">
                                <div className="flex gap-3">
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                                        {i + 1}
                                    </span>
                                    <div className="flex-1">
                                        <p className="font-medium text-foreground">{skill.skill}</p>
                                        <p className="mt-2 text-sm text-muted-foreground leading-loose">{skill.detail}</p>
                                    </div>
                                </div>
                            </div>)}
                        </div>
                    </div>
                </div>
            </div>
            {/* 补差学习计划 - 可折叠 */}
            <div className="rounded-lg border border-border bg-card p-6 shadow-card transition-all duration-200 hover:shadow-float hover:-translate-y-0.5">
                <button
                    onClick={() => toggleSection("improvement_plan")}
                    className="flex w-full items-center justify-between text-left"
                >
                    <h3 className="font-semibold text-foreground">补差学习计划</h3>
                    <svg
                        className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ease-out ${collapsedSections.has("improvement_plan") ? "" : "rotate-180"}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <path d="M18 15l-6-6-6 6" />
                    </svg>
                </button>
                <div className={`grid transition-all duration-300 ease-out ${collapsedSections.has("improvement_plan") ? "grid-rows-[0fr]" : "grid-rows-[1fr]"}`}>
                    <div className="overflow-hidden">
                        <div className="space-y-4 pt-4">
                            {result.improvement_plan.map((plan, i) => <div key={i} className="rounded-lg bg-muted p-4">
                                <div className="flex gap-3">
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                                        {i + 1}
                                    </span>
                                    <div className="flex-1">
                                        <p className="font-medium text-foreground">{plan.title}</p>
                                        <p className="mt-2 text-sm text-muted-foreground leading-loose whitespace-pre-wrap">{plan.detail}</p>
                                    </div>
                                </div>
                            </div>)}
                        </div>
                    </div>
                </div>
            </div>
            {/* JD 真实含义 - 警示样式，可折叠 */}
            <div className="rounded-lg border border-accent/30 bg-card p-6 shadow-card transition-all duration-200 hover:shadow-float hover:-translate-y-0.5">
                <button
                    onClick={() => toggleSection("jd_truth")}
                    className="flex w-full items-center justify-between text-left"
                >
                    <h3 className="font-semibold text-foreground">
                        JD 真实含义（招聘黑话解读）
                    </h3>
                    <svg
                        className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ease-out ${collapsedSections.has("jd_truth") ? "" : "rotate-180"}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <path d="M18 15l-6-6-6 6" />
                    </svg>
                </button>
                <div className={`grid transition-all duration-300 ease-out ${collapsedSections.has("jd_truth") ? "grid-rows-[0fr]" : "grid-rows-[1fr]"}`}>
                    <div className="overflow-hidden">
                        {result.jd_truth.filter(item => item.phrase && !item.phrase.includes("未检测到")).length === 0 ? (
                            <p className="text-sm text-muted-foreground pt-4">未检测到招聘黑话</p>
                        ) : (
                            <div className="space-y-4 pt-4">
                                {result.jd_truth.filter(item => item.phrase && !item.phrase.includes("未检测到")).map((item, i) => <div key={i} className="rounded-lg bg-accent/5 border border-accent/20 p-4">
                                    <div className="flex gap-3">
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
                                            {i + 1}
                                        </span>
                                        <div className="flex-1">
                                            <p className="font-medium text-foreground">{item.phrase}</p>
                                            <p className="mt-2 text-sm text-muted-foreground leading-loose whitespace-pre-wrap">{item.meaning}</p>
                                        </div>
                                    </div>
                                </div>)}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {}
            {}
            <div className="flex justify-center gap-3 pt-4">
                <button
                    onClick={handleExportToLibrary}
                    className="flex items-center gap-2 rounded-lg bg-muted px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 btn-press">
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                        <polyline points="7 3 7 8 15 8" />
                    </svg>导出到库
                </button>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">报告下载请到JD库中操作</p>
        </div>
    );
}
