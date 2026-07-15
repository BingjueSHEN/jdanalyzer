"use client";

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event & { error: string }) => void) | null;
  onend: (() => void) | null;
}

declare const SpeechRecognition: {
  new (): SpeechRecognition;
  prototype: SpeechRecognition;
};

declare const webkitSpeechRecognition: {
  new (): SpeechRecognition;
  prototype: SpeechRecognition;
};

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MessageSquare,
  Send,
  Mic,
  MicOff,
  Video,
  VideoOff,
  X,
  Square,
  Briefcase,
  ArrowRight,
  AlertCircle,
  Check,
  Pause,
  Play,
} from "lucide-react";
import { getConfig } from "@/lib/storage";
import {
  sendInterviewMessage,
  generateInterviewReport,
  createInterviewSession,
  generateMessageId,
  type InterviewSession,
  type InterviewMessage,
} from "@/lib/interview-engine";
import {
  saveInterview,
  getInterviewById,
  getInterviewsByJdId,
  getActiveInterview,
  type StoredInterview,
} from "@/lib/interview-storage";
import { getSavedAnalyses, type SavedAnalysis } from "@/lib/jd-storage";
import { Suspense } from "react";

// 从JD分析结果生成面试上下文摘要
function buildAnalysisSummary(analysis: SavedAnalysis): string {
  const r = analysis.result;
  const parts: string[] = [];
  
  // 基本信息
  parts.push(`岗位: ${r.job_title || analysis.jobTitle}`);
  if (r.company_name) parts.push(`公司: ${r.company_name}`);
  parts.push(`适配度评分: ${r.score}/10`);
  
  // 综合评价
  if (r.overall_review) {
    parts.push(`\n综合评价: ${r.overall_review}`);
  }
  
  // 技能分析
  if (r.owned_skills && r.owned_skills.length > 0) {
    parts.push(`\n已具备技能: ${r.owned_skills.join("、")}`);
  }
  if (r.missing_skills && r.missing_skills.length > 0) {
    const missing = r.missing_skills.map(s => s.skill);
    parts.push(`待补充技能: ${missing.join("、")}`);
  }
  
  // 补差计划
  if (r.improvement_plan && r.improvement_plan.length > 0) {
    const priorities = r.improvement_plan.slice(0, 3).map(p => p.title);
    if (priorities.length > 0) parts.push(`\n优先提升方向: ${priorities.join("；")}`);
  }
  
  return parts.join("\n");
}

function InterviewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jdId = searchParams.get("jdId");

  const [session, setSession] = useState<InterviewSession | null>(null);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [resumableInterview, setResumableInterview] = useState<StoredInterview | null>(null);
  const [showEmptyState, setShowEmptyState] = useState(true);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // 初始化面试会话
  useEffect(() => {
    if (!jdId) {
      // 检查是否有未完成的面试（active 或 paused）
      const activeInterview = getActiveInterview();
      if (activeInterview) {
        setResumableInterview(activeInterview);
        setShowResumePrompt(true);
      } else {
        setShowEmptyState(true);
      }
      return;
    }

    // 检查是否有进行中的面试
    const existingInterviews = getInterviewsByJdId(jdId);
    const activeInterview = existingInterviews.find((i) => i.status === "active" || i.status === "paused");

    if (activeInterview) {
      // 恢复进行中的面试
      const restoredSession: InterviewSession = {
        id: activeInterview.id,
        jdId: activeInterview.jdId,
        jobTitle: activeInterview.jobTitle,
        companyName: activeInterview.companyName,
        jdText: "",
        resumeText: "",
        portfolioText: "",
        messages: activeInterview.messages,
        status: activeInterview.status,
        startedAt: activeInterview.startedAt,
        pausedAt: activeInterview.pausedAt,
      };
      setSession(restoredSession);
      setShowEmptyState(false);
    } else {
      // 从JD库创建新面试
      const analyses = getSavedAnalyses();
      const analysis = analyses.find((a) => a.id === jdId);
      if (analysis) {
        // 生成分析摘要
        const analysisSummary = buildAnalysisSummary(analysis);
        
        const newSession = createInterviewSession(
          analysis.id,
          analysis.jobTitle,
          analysis.companyName,
          analysis.jdText,
          analysis.resumeText || "",
          analysis.portfolioText || "",
          analysisSummary
        );
        setSession(newSession);
        setShowEmptyState(false);

        // 发送开场白
        sendOpeningMessage(newSession, analysis);
      }
    }
  }, [jdId]);

  // 自动滚动到底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages, streamingText]);

  const sendOpeningMessage = async (
    newSession: InterviewSession,
    analysis: SavedAnalysis
  ) => {
    setIsLoading(true);
    const config = getConfig().text;

    if (!config.apiKey) {
      // 没有配置API Key，使用默认开场白
      const openingMessage: InterviewMessage = {
        id: generateMessageId(),
        role: "assistant",
        content: `您好，我是本次模拟面试的AI面试官。我看到您申请的是**${analysis.jobTitle}**岗位。下面面试正式开始，请先简单介绍一下您自己。`,
        timestamp: Date.now(),
      };
      newSession.messages.push(openingMessage);
      setSession({ ...newSession });
      setIsLoading(false);
      return;
    }

    try {
      const openingPrompt = `候选人已提交材料。请开始面试开场白：
1. 简短自我介绍
2. 说明面试将围绕"${analysis.jobTitle}"岗位进行
3. 请候选人先做自我介绍

注意：开场白要简洁友好，不要太长。`;

      const response = await sendInterviewMessage(
        { ...newSession, messages: [] },
        openingPrompt,
        config,
        (text) => setStreamingText(text)
      );

      const openingMessage: InterviewMessage = {
        id: generateMessageId(),
        role: "assistant",
        content: response,
        timestamp: Date.now(),
      };
      newSession.messages.push(openingMessage);
      setSession({ ...newSession });
      saveInterview(newSession);
    } catch {
      const fallbackMessage: InterviewMessage = {
        id: generateMessageId(),
        role: "assistant",
        content: `您好，我是本次模拟面试的AI面试官。我看到您申请的是**${analysis.jobTitle}**岗位。下面面试正式开始，请先简单介绍一下您自己。`,
        timestamp: Date.now(),
      };
      newSession.messages.push(fallbackMessage);
      setSession({ ...newSession });
    } finally {
      setStreamingText("");
      setIsLoading(false);
    }
  };

  const handleSendMessage = useCallback(async () => {
    if (!inputText.trim() || !session || isLoading) return;

    const userMessage: InterviewMessage = {
      id: generateMessageId(),
      role: "user",
      content: inputText.trim(),
      timestamp: Date.now(),
    };

    const updatedSession = {
      ...session,
      messages: [...session.messages, userMessage],
    };
    setSession(updatedSession);
    setInputText("");
    setIsLoading(true);

    const config = getConfig().text;
    if (!config.apiKey) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await sendInterviewMessage(
        session,
        userMessage.content,
        config,
        (text) => setStreamingText(text)
      );

      const aiMessage: InterviewMessage = {
        id: generateMessageId(),
        role: "assistant",
        content: response,
        timestamp: Date.now(),
      };

      updatedSession.messages.push(aiMessage);
      setSession({ ...updatedSession });
      saveInterview(updatedSession);
    } catch {
      // 错误处理
    } finally {
      setStreamingText("");
      setIsLoading(false);
    }
  }, [inputText, session, isLoading]);

  const handleEndInterview = async () => {
    if (!session) return;

    setShowEndModal(false);
    setIsLoading(true);

    // Create completed session object
    const completedSession: InterviewSession = {
      ...session,
      status: "completed",
      completedAt: Date.now(),
    };

    // Update local state
    setSession(completedSession);

    const config = getConfig().text;
    if (config.apiKey) {
      try {
        const report = await generateInterviewReport(completedSession, config);
        completedSession.report = report;
        saveInterview(completedSession);

        // 跳转到报告页面
        router.push(`/interview-report?id=${completedSession.id}`);
        return;
      } catch {
        // 报告生成失败，仍然保存面试记录
      }
    }

    saveInterview(completedSession);
    setIsLoading(false);
    router.push(`/interview-report?id=${completedSession.id}`);
  };

  // 暂停面试
  const handlePauseInterview = () => {
    if (!session) return;
    const pausedSession = {
      ...session,
      status: "paused" as const,
      pausedAt: Date.now(),
    };
    setSession(pausedSession);
    saveInterview(pausedSession);
  };

  // 恢复面试
  const handleResumeInterview = () => {
    if (!resumableInterview) return;
    const restoredSession: InterviewSession = {
      id: resumableInterview.id,
      jdId: resumableInterview.jdId,
      jobTitle: resumableInterview.jobTitle,
      companyName: resumableInterview.companyName,
      jdText: "",
      resumeText: "",
      portfolioText: "",
      messages: resumableInterview.messages,
      status: "active",
      startedAt: resumableInterview.startedAt,
    };
    setSession(restoredSession);
    setShowResumePrompt(false);
    setResumableInterview(null);
    setShowEmptyState(false);
    saveInterview({ ...restoredSession, status: "active" });
  };

  // 放弃恢复（开始新的或留在空状态）
  const handleDismissResume = () => {
    setShowResumePrompt(false);
    setResumableInterview(null);
    if (!jdId) {
      setShowEmptyState(true);
    }
  };

  // 语音输入
  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      const SpeechRecognitionCtor =
        (window as unknown as { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
      if (!SpeechRecognitionCtor) {
        alert("您的浏览器不支持语音识别");
        return;
      }

      const recognition = new SpeechRecognitionCtor();
      recognition.lang = "zh-CN";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputText(transcript);
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
    }
  };

  // 摄像头
  const toggleCamera = async () => {
    if (isCameraOn) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setIsCameraOn(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsCameraOn(true);
      } catch {
        alert("无法访问摄像头，请检查权限设置");
      }
    }
  };

  // 清理
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      recognitionRef.current?.abort();
    };
  }, []);

  // 恢复面试提示
  if (showResumePrompt && resumableInterview) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-5">
            <Play className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            发现未完成的面试
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-2">
            你有一个正在进行的模拟面试尚未完成
          </p>
          <p className="text-sm font-medium text-foreground mb-6">
            {resumableInterview.jobTitle} · {resumableInterview.companyName}
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleResumeInterview}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all"
            >
              <Play className="w-4 h-4" />
              继续面试
            </button>
            <button
              onClick={handleDismissResume}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/80 active:scale-[0.98] transition-all"
            >
              开始新面试
            </button>
          </div>
        </div>
      </main>
    );
  }

  // 空状态
  if (showEmptyState) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-5">
            <MessageSquare className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            开始模拟面试
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            请先进入JD库，选择一份岗位分析报告，点击&ldquo;模拟面试&rdquo;按钮开始
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

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* 面试顶部栏 */}
      <div className="shrink-0 flex items-center justify-between px-6 py-3 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center">
            <Briefcase className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground">
              {session?.jobTitle || "模拟面试"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {session?.companyName} · 模拟面试
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {session?.status === "active" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/15 text-green-600 dark:text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              面试中
            </span>
          )}
          {session?.status === "paused" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Pause className="w-3 h-3" />
              已暂停
            </span>
          )}
          {session?.status === "active" && (
            <button
              onClick={handlePauseInterview}
              className="bg-muted text-foreground border-none px-4 py-2 rounded-md text-sm font-medium hover:bg-muted/80 active:scale-[0.98] transition-all inline-flex items-center gap-1.5"
            >
              <Pause className="w-3.5 h-3.5" />
              暂停
            </button>
          )}
          {session?.status === "paused" && (
            <button
              onClick={() => {
                const resumedSession = { ...session, status: "active" as const };
                setSession(resumedSession);
                saveInterview(resumedSession);
              }}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all inline-flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              继续面试
            </button>
          )}
          <button
            onClick={() => setShowEndModal(true)}
            className="bg-muted text-foreground border-none px-4 py-2 rounded-md text-sm font-medium hover:bg-muted/80 active:scale-[0.98] transition-all inline-flex items-center gap-1.5"
          >
            <Square className="w-3.5 h-3.5" />
            结束面试
          </button>
        </div>
      </div>

      {/* 聊天消息区域 */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {/* 时间标记 */}
        {session?.messages && session.messages.length > 0 && (
          <div className="flex items-center justify-center py-2">
            <span className="text-xs text-muted-foreground/50 bg-muted px-3 py-1 rounded-full">
              {new Date(session.messages[0].timestamp).toLocaleTimeString(
                "zh-CN",
                { hour: "2-digit", minute: "2-digit" }
              )}
            </span>
          </div>
        )}

        {/* 消息列表 */}
        {session?.messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* AI正在输入 */}
        {isLoading && streamingText && (
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 mt-0.5">
              <img
                src="/interviewer-avatar.jpg"
                alt="AI面试官"
                className="w-full h-full object-cover object-center"
              />
            </div>
            <div className="max-w-[75%]">
              <div className="text-xs text-muted-foreground mb-1.5 font-medium">
                AI面试官
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-foreground leading-relaxed">
                {streamingText}
              </div>
            </div>
          </div>
        )}

        {isLoading && !streamingText && (
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 mt-0.5">
              <img
                src="/interviewer-avatar.jpg"
                alt="AI面试官"
                className="w-full h-full object-cover object-center"
              />
            </div>
            <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1.5 items-center h-5">
                <span className="w-2 h-2 bg-muted-foreground/30 rounded-full animate-bounce" />
                <span
                  className="w-2 h-2 bg-muted-foreground/30 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                />
                <span
                  className="w-2 h-2 bg-muted-foreground/30 rounded-full animate-bounce"
                  style={{ animationDelay: "0.4s" }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* 底部输入区域 */}
      <div className="shrink-0 px-6 py-4 bg-card border-t border-border">
        <div className="flex items-center gap-3">
          {/* 语音输入按钮 */}
          <button
            onClick={toggleRecording}
            disabled={session?.status === "paused"}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${
              isRecording
                ? "bg-red-500 animate-pulse"
                : "bg-muted hover:bg-muted/80"
            } ${session?.status === "paused" ? "opacity-50 cursor-not-allowed" : ""}`}
            title={session?.status === "paused" ? "面试已暂停" : "语音输入"}
          >
            {isRecording ? (
              <MicOff className="w-5 h-5 text-white" />
            ) : (
              <Mic className="w-5 h-5 text-muted-foreground" />
            )}
          </button>

          {/* 摄像头开关 */}
          <button
            onClick={toggleCamera}
            disabled={session?.status === "paused"}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${
              isCameraOn
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            } ${session?.status === "paused" ? "opacity-50 cursor-not-allowed" : ""}`}
            title={session?.status === "paused" ? "面试已暂停" : "摄像头"}
          >
            {isCameraOn ? (
              <VideoOff className="w-5 h-5" />
            ) : (
              <Video className="w-5 h-5 text-muted-foreground" />
            )}
          </button>

          {/* 文字输入框 */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={session?.status === "paused" ? "面试已暂停，请点击「继续面试」恢复" : "输入您的回答..."}
            className="flex-1 min-w-0 bg-muted border-none rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
            disabled={isLoading || session?.status === "paused"}
          />

          {/* 发送按钮 */}
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isLoading || session?.status === "paused"}
            className="w-10 h-10 rounded-full bg-primary flex items-center justify-center hover:opacity-90 active:scale-[0.98] transition-all shrink-0 disabled:opacity-50"
            title="发送"
          >
            <Send className="w-5 h-5 text-primary-foreground" />
          </button>
        </div>

        {/* 输入状态提示 */}
        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-xs text-muted-foreground/50 flex items-center gap-1.5">
            {isRecording ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                正在录音...
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                正在编辑回答...
              </>
            )}
          </span>
          <span className="text-xs text-muted-foreground/40">
            按 Enter 发送
          </span>
        </div>
      </div>

      {/* 摄像头预览窗口 */}
      {isCameraOn && (
        <div className="fixed top-20 right-6 w-52 aspect-[4/3] rounded-xl overflow-hidden shadow-lg z-50 bg-muted">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <button
            onClick={toggleCamera}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
          >
            <X className="w-3.5 h-3.5 text-white" />
          </button>
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/50">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-white font-medium">已开启</span>
          </div>
        </div>
      )}

      {/* 结束面试确认弹窗 */}
      {showEndModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                确认结束面试？
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              结束后系统将自动生成面试报告，对本次面试的表现进行多维度评估。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowEndModal(false)}
                className="bg-muted text-foreground border-none px-5 py-2.5 rounded-md text-sm font-medium hover:bg-muted/80 active:scale-[0.98] transition-all"
              >
                继续面试
              </button>
              <button
                onClick={handleEndInterview}
                className="bg-primary text-primary-foreground px-5 py-2.5 rounded-md text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all inline-flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                确认结束
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 消息气泡组件
function MessageBubble({ message }: { message: InterviewMessage }) {
  const isAI = message.role === "assistant";
  const time = new Date(message.timestamp).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // 简单的Markdown渲染（加粗）
  const renderContent = (content: string) => {
    const parts = content.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i}>{part.slice(2, -2)}</strong>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  if (isAI) {
    return (
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 mt-0.5">
          <img
            src="/interviewer-avatar.jpg"
            alt="AI面试官"
            className="w-full h-full object-cover object-center"
          />
        </div>
        <div className="max-w-[75%]">
          <div className="text-xs text-muted-foreground mb-1.5 font-medium">
            AI面试官
          </div>
          <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-foreground leading-relaxed">
            <p>{renderContent(message.content)}</p>
          </div>
          <div className="text-xs text-muted-foreground/50 mt-1.5">{time}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 flex-row-reverse">
      <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-primary-foreground text-sm font-semibold">
          我
        </span>
      </div>
      <div className="max-w-[75%]">
        <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed">
          <p>{renderContent(message.content)}</p>
        </div>
        <div className="text-xs text-muted-foreground/50 mt-1.5 text-right">
          {time}
        </div>
      </div>
    </div>
  );
}

export default function InterviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
      <InterviewPageContent />
    </Suspense>
  );
}
