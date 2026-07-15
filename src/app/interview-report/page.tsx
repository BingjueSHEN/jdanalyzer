"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
    ArrowLeft,
    ClipboardList,
    MessageCircle,
    Lightbulb,
    Brain,
    Languages,
    CheckCircle,
    Target,
    BookOpen,
    Save,
    RotateCcw,
    Library,
    Image,
    FileText,
} from "lucide-react";

import { getInterviewById, markReportAsSaved, type StoredInterview } from "@/lib/interview-storage";
import type { InterviewReport } from "@/lib/interview-engine";
import { exportToPdf, exportToImage } from "@/lib/export-utils";
import { Suspense } from "react";

function InterviewReportPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const interviewId = searchParams.get("id");
    const reportRef = useRef<HTMLDivElement>(null);
    const [interview, setInterview] = useState<StoredInterview | null>(null);
    const [report, setReport] = useState<InterviewReport | null>(null);
    const [isSaved, setIsSaved] = useState(false);

    useEffect(() => {
        if (!interviewId)
            return;

        const found = getInterviewById(interviewId);

        if (found) {
            setInterview(found);

            if (found.report) {
                setReport(found.report);
                setIsSaved(found.reportSaved === true);
            }
        }
    }, [interviewId]);

    if (!interview) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <p className="text-muted-foreground">未找到面试记录</p>
                <button
                    onClick={() => router.push("/interview")}
                    className="mt-4 text-primary hover:underline">返回面试页面
                            </button>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl px-4 py-6">
            {}
            <div className="flex items-center gap-3 mb-6">
                <button
                    onClick={() => router.back()}
                    className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    style={{
                        margin: "8px"
                    }}>
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-2xl font-bold text-foreground">面试报告</h1>
                <span
                    className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-accent/10 text-accent border border-accent/20">
                    {interview.jobTitle}
                </span>
            </div>
            {report ? <div id="report-content" ref={reportRef}>
                {}
                <div className="bg-card rounded-xl shadow-sm p-5 mb-5 border border-border">
                    <div className="flex items-center gap-2 mb-4">
                        <ClipboardList className="w-4 h-4 text-foreground" />
                        <h2 className="text-base font-semibold text-foreground">面试概览
                                          </h2>
                    </div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                        <div className="flex items-center gap-2">
                            <span
                                className="text-xs text-muted-foreground w-16 shrink-0"
                                style={{
                                    textAlign: "center"
                                }}>应聘岗位
                                                </span>
                            <span className="text-sm font-medium text-foreground">
                                {report.overview.jobTitle}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span
                                className="text-xs text-muted-foreground w-16 shrink-0"
                                style={{
                                    textAlign: "center"
                                }}>面试时间
                                                </span>
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
                            <span
                                className="text-xs text-muted-foreground w-16 shrink-0"
                                style={{
                                    textAlign: "center"
                                }}>面试时长
                                                </span>
                            <span className="text-sm text-foreground">
                                {report.overview.duration}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span
                                className="text-xs text-muted-foreground w-16 shrink-0"
                                style={{
                                    textAlign: "center"
                                }}>考察维度
                                                </span>
                            <div className="flex flex-wrap gap-1.5">
                                {report.overview.dimensions.map((dim, i) => <span
                                    key={i}
                                    className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs bg-muted text-muted-foreground border border-border/50 whitespace-nowrap">
                                    {dim}
                                </span>)}
                            </div>
                        </div>
                    </div>
                </div>
                {}
                <div className="mb-5">
                    <div
                        className="flex items-center gap-2 mb-4"
                        style={{
                            margin: "16px"
                        }}>
                        <MessageCircle className="w-4 h-4 text-foreground" />
                        <h2 className="text-base font-semibold text-foreground">面试问答详情
                                          </h2>
                    </div>
                    {report.qaDetails.map((qa, index) => <div
                        key={index}
                        className="bg-card rounded-xl shadow-sm p-5 mb-4 border border-border">
                        <div className="flex items-start gap-3 mb-4">
                            <span
                                className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0 mt-0.5">
                                {index + 1}
                            </span>
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">面试官提问
                                                        </p>
                                <p className="text-sm text-foreground font-medium leading-relaxed">
                                    {qa.question}
                                </p>
                            </div>
                        </div>
                        <div className="ml-9 mb-4">
                            <p className="text-xs text-muted-foreground mb-1.5">你的回答要点
                                                  </p>
                            <p className="text-sm text-foreground leading-relaxed">
                                {qa.answerSummary}
                            </p>
                        </div>
                        <div className="ml-9 bg-muted/60 rounded-lg p-4 border border-border/50">
                            <p
                                className="text-xs font-semibold text-accent mb-2 flex items-center gap-1">
                                <Lightbulb className="w-3.5 h-3.5" />提升建议
                                                  </p>
                            <div className="space-y-2">
                                <div>
                                    <p className="text-xs font-medium text-foreground mb-0.5">内容方面
                                                              </p>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {qa.suggestions.content}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-foreground mb-0.5">表达方面
                                                              </p>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {qa.suggestions.expression}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>)}
                </div>
                {}
                <div className="bg-card rounded-xl shadow-sm p-5 mb-5 border border-border">
                    <div className="flex items-center gap-2 mb-4">
                        <CheckCircle className="w-4 h-4 text-foreground" />
                        <h2 className="text-base font-semibold text-foreground">综合评价与提升总结
                                          </h2>
                    </div>
                    {}
                    <div className="mb-4">
                        <p
                            className="text-xs font-medium text-foreground mb-1.5 flex items-center gap-1"
                            style={{
                                fontSize: "14px"
                            }}>
                            <Brain className="w-3.5 h-3.5 text-accent" />回答思路评价
                                          </p>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {report.综合评价.answerApproach}
                        </p>
                    </div>
                    {}
                    <div className="mb-5">
                        <p
                            className="text-xs font-medium text-foreground mb-1.5 flex items-center gap-1"
                            style={{
                                fontSize: "14px"
                            }}>
                            <Languages className="w-3.5 h-3.5 text-accent" />语言逻辑评价
                                          </p>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {report.综合评价.languageLogic}
                        </p>
                    </div>
                    {}
                    <div className="grid grid-cols-2 gap-4 mb-5">
                        <div>
                            <p
                                className="text-xs font-medium text-foreground mb-2 flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5 text-green-500" />核心优势
                                                </p>
                            <div className="flex flex-wrap gap-2">
                                {report.综合评价.coreStrengths.map((strength, i) => <span
                                    key={i}
                                    className="w-fit px-2.5 py-1 rounded-md text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                                    {strength}
                                </span>)}
                            </div>
                        </div>
                        <div>
                            <p
                                className="text-xs font-medium text-foreground mb-2 flex items-center gap-1">
                                <Target className="w-3.5 h-3.5 text-amber-500" />待发展领域
                                                </p>
                            <div className="flex flex-wrap gap-2">
                                {report.综合评价.improvementAreas.map((area, i) => <span
                                    key={i}
                                    className="w-fit px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                    {area}
                                </span>)}
                            </div>
                        </div>
                    </div>
                    {}
                    <div className="bg-muted/60 rounded-lg p-4 border border-border/50">
                        <p
                            className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1"
                            style={{
                                fontSize: "14px",
                                fontWeight: "bold"
                            }}>
                            <BookOpen className="w-3.5 h-3.5 text-accent" />后续学习建议
                                          </p>
                        <ul className="space-y-1.5">
                            {report.综合评价.learningSuggestions.map((suggestion, i) => <li
                                key={i}
                                className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed"
                                style={{
                                    fontSize: "14px"
                                }}>
                                <span className="w-1 h-1 rounded-full bg-accent shrink-0 mt-1.5" />
                                {suggestion}
                            </li>)}
                        </ul>
                    </div>
                </div>
            </div> : <div
                className="bg-card rounded-xl shadow-sm p-8 text-center border border-border">
                <p className="text-muted-foreground mb-4">本次面试未生成详细报告
                              </p>
                <p className="text-sm text-muted-foreground">面试共进行了 {interview.messages.length}轮对话
                              </p>
            </div>}
            {}
            <div className="flex items-center justify-center gap-3 pb-8 pt-4 flex-wrap">
                <button
                    onClick={() => {
                        if (interviewId && report) {
                            markReportAsSaved(interviewId);
                            setIsSaved(true);
                        }
                    }}
                    disabled={isSaved}
                    className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all inline-flex items-center gap-2 ${isSaved ? "bg-muted text-muted-foreground opacity-60 cursor-not-allowed" : "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]"}`}>
                    {isSaved ? <>
                        <CheckCircle className="w-4 h-4" />已保存到JD库
                                    </> : <>
                        <Save className="w-4 h-4" />保存到JD库
                                    </>}
                </button>
                {}
                {report && <div className="flex items-center gap-2 border-l border-border pl-3">
                    <button
                        onClick={async () => {
                            if (!reportRef.current || !interview) {
                                console.warn("报告内容未加载完成");
                                return;
                            }

                            try {
                                await exportToImage(
                                    reportRef.current,
                                    `面试报告-${interview.jobTitle}-${new Date().toLocaleDateString()}`
                                );
                            } catch (err) {
                                console.error("导出图片失败:", err);
                            }
                        }}
                        className="bg-muted text-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-muted/80 active:scale-[0.98] transition-all inline-flex items-center gap-1.5"
                        title="导出为图片">
                        <Image className="w-4 h-4" />图片
                                    </button>
                    <button
                        onClick={async () => {
                            if (!reportRef.current || !interview) {
                                console.warn("报告内容未加载完成");
                                return;
                            }

                            try {
                                await exportToPdf(
                                    reportRef.current,
                                    `面试报告-${interview.jobTitle}-${new Date().toLocaleDateString()}`
                                );
                            } catch (err) {
                                console.error("导出PDF失败:", err);
                            }
                        }}
                        className="bg-muted text-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-muted/80 active:scale-[0.98] transition-all inline-flex items-center gap-1.5"
                        title="导出为PDF">
                        <FileText className="w-4 h-4" />PDF
                                    </button>
                </div>}
                <button
                    onClick={() => router.push(`/interview?jdId=${interview.jdId}`)}
                    className="bg-muted text-foreground border-none px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-muted/80 active:scale-[0.98] transition-all inline-flex items-center gap-2">
                    <RotateCcw className="w-4 h-4" />再次面试
                            </button>
                <button
                    onClick={() => router.push("/library")}
                    className="bg-muted text-foreground border-none px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-muted/80 active:scale-[0.98] transition-all inline-flex items-center gap-2">
                    <Library className="w-4 h-4" />返回JD库
                            </button>
            </div>
        </div>
    );
}

export default function InterviewReportPage() {
    return (
        <Suspense
            fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
            <InterviewReportPageContent />
        </Suspense>
    );
}