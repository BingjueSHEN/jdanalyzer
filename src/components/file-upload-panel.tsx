"use client";
import { useRef } from "react";
import type { AIConfig } from "@/lib/api-client";
import { getConfig } from "@/lib/storage";
import { parsePDFWithVision, processImageWithVision } from "@/lib/pdf-processor";

export interface UploadedFile {
    name: string;
    size: string;
    text: string;
    status: "uploading" | "processing" | "done" | "error" | "paused" | "cancelled";
    progress: number;
    progressText?: string;
}

export function FileUploadPanel({
    title,
    optional,
    file,
    onFileChange,
    maxSizeMB = 20
}: {
    title: string;
    optional?: boolean;
    file: UploadedFile | null;
    onFileChange: (file: UploadedFile | null) => void;
    maxSizeMB?: number;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const originalFileRef = useRef<File | null>(null);
    const pausedDataRef = useRef<{ file: File } | null>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];

        if (!f)
            return;

        await processFile(f);

        if (inputRef.current)
            inputRef.current.value = "";
    };

    const handlePause = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            // 保存原始文件用于恢复
            if (originalFileRef.current) {
                pausedDataRef.current = { file: originalFileRef.current };
            }
            if (file) {
                onFileChange({ ...file, status: "paused", progressText: "已暂停" });
            }
        }
    };

    const handleCancel = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        originalFileRef.current = null;
        onFileChange(null);
        pausedDataRef.current = null;
    };

    const handleResume = async () => {
        if (pausedDataRef.current && file) {
            const { file: originalFile } = pausedDataRef.current;
            pausedDataRef.current = null;
            // 重新开始处理文件，UI会立即切换到uploading状态
            await processFile(originalFile);
        }
    };

    const processFile = async (f: File) => {
        if (f.size > maxSizeMB * 1024 * 1024) {
            alert(`文件大小不能超过 ${maxSizeMB}MB`);
            return;
        }

        // 保存原始文件用于暂停后恢复
        originalFileRef.current = f;

        const uploaded: UploadedFile = {
            name: f.name,
            size: (f.size / 1024 / 1024).toFixed(2) + " MB",
            text: "",
            status: "uploading",
            progress: 0
        };

        onFileChange(uploaded);

        // 创建 AbortController 用于取消上传
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        try {
            const config = getConfig();

            if (!config.vision?.apiKey) {
                throw new Error("请先在设置中配置图像识别 API Key");
            }

            // 检查文件大小，决定是否使用分片上传
            const CHUNK_THRESHOLD = 16 * 1024 * 1024; // 16MB
            const useChunkedUpload = f.size > CHUNK_THRESHOLD;

            let fileToProcess: File | Blob = f;

            // 大文件使用分片上传
            if (useChunkedUpload) {
                onFileChange({
                    ...uploaded,
                    status: "processing",
                    progress: 5,
                    progressText: "正在分片上传大文件..."
                });

                const MAX_CHUNK_SIZE = 4 * 1024 * 1024; // 4MB
                const totalChunks = Math.ceil(f.size / MAX_CHUNK_SIZE);

                // 初始化上传
                const initForm = new FormData();
                initForm.append('action', 'init');
                initForm.append('fileName', f.name);
                initForm.append('fileSize', f.size.toString());

                const initResponse = await fetch('/api/upload', {
                    method: 'POST',
                    body: initForm,
                    signal: abortController.signal
                });
                const initData = await initResponse.json();

                if (!initData.success) {
                    throw new Error('初始化上传失败: ' + initData.error);
                }

                const { uploadId } = initData;

                // 上传分片
                for (let i = 0; i < totalChunks; i++) {
                    const start = i * MAX_CHUNK_SIZE;
                    const end = Math.min(start + MAX_CHUNK_SIZE, f.size);
                    const chunk = f.slice(start, end);

                    const chunkForm = new FormData();
                    chunkForm.append('action', 'chunk');
                    chunkForm.append('uploadId', uploadId);
                    chunkForm.append('chunkIndex', i.toString());
                    chunkForm.append('chunk', chunk, `chunk_${i}`);

                    const chunkResponse = await fetch('/api/upload', {
                        method: 'POST',
                        body: chunkForm,
                        signal: abortController.signal
                    });
                    const chunkData = await chunkResponse.json();

                    if (!chunkData.success) {
                        throw new Error('上传分片失败: ' + chunkData.error);
                    }

                    const progress = Math.round(5 + (i + 1) / totalChunks * 20);
                    onFileChange({
                        ...uploaded,
                        status: "processing",
                        progress,
                        progressText: `正在上传分片 ${i + 1}/${totalChunks}...`
                    });
                }

                // 完成上传，获取合并后的文件
                const completeForm = new FormData();
                completeForm.append('action', 'complete');
                completeForm.append('uploadId', uploadId);

                const completeResponse = await fetch('/api/upload', {
                    method: 'POST',
                    body: completeForm,
                    signal: abortController.signal
                });
                const completeData = await completeResponse.json();

                if (!completeData.success) {
                    throw new Error('完成上传失败: ' + completeData.error);
                }

                // 将 base64 转换回 Blob
                const binaryString = atob(completeData.content);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                fileToProcess = new Blob([bytes], { type: f.type });
            }

            if (f.type === "application/pdf") {
                onFileChange({
                    ...uploaded,
                    status: "processing",
                    progress: useChunkedUpload ? 30 : 10,
                    progressText: "正在转换PDF为图片..."
                });

                const text = await parsePDFWithVision(fileToProcess as File, config.vision, (progress, text) => {
                    const adjustedProgress = useChunkedUpload ? 30 + progress * 0.7 : progress;
                    onFileChange({
                        ...uploaded,
                        status: "processing",
                        progress: adjustedProgress,
                        progressText: text
                    });
                });

                onFileChange({
                    ...uploaded,
                    text,
                    status: "done",
                    progress: 100,
                    progressText: `识别完成，共 ${text.length} 字`
                });
            } else {
                onFileChange({
                    ...uploaded,
                    status: "processing",
                    progress: useChunkedUpload ? 50 : 30,
                    progressText: "正在识别图片内容..."
                });

                const text = await processImageWithVision(fileToProcess as File, config.vision);

                onFileChange({
                    ...uploaded,
                    text,
                    status: "done",
                    progress: 100,
                    progressText: `识别完成，共 ${text.length} 字`
                });
            }
        } catch (err: unknown) {
            // 检查是否是用户主动取消
            if (err instanceof Error && err.name === 'AbortError') {
                onFileChange({
                    ...uploaded,
                    status: "error",
                    progressText: "已取消上传"
                });
                return;
            }
            const msg = err instanceof Error ? err.message : "识别失败";
            console.error("File processing error:", err);

            onFileChange({
                ...uploaded,
                status: "error",
                progressText: msg
            });
        }
    };

    return (
        <div
            className="rounded-lg border border-border bg-card p-5 shadow-card"
            style={{
                borderRadius: "12px"
            }}>
            <div className="mb-3 flex items-center gap-2">
                <h3 className="font-semibold text-foreground">{title}</h3>
                {optional && <span className="text-xs text-muted-foreground">（可选）</span>}
            </div>
            {!file && <div
                onClick={() => inputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 hover:border-primary/50"
                style={{
                    borderRadius: "12px",
                    borderWidth: "1px",
                    borderStyle: "solid",
                    backgroundColor: "var(--card)",
                    minHeight: "160px"
                }}>
                <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="mb-2 text-muted-foreground">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                </svg>
                <p className="text-sm text-muted-foreground">点击或拖拽上传 PDF/图片</p>
                <p className="mt-1 text-xs text-muted-foreground">支持 .pdf, .jpg, .png，最大 {maxSizeMB}MB</p>
            </div>}
            {file && file.status === "done" && <div
                className="flex items-center justify-between rounded-lg bg-muted p-3"
                style={{
                    borderRadius: "8px"
                }}>
                <div className="flex items-center gap-2">
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-green-500">
                        <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <span className="text-sm text-foreground">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{file.size}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{file.progressText}</span>
                    <button
                        onClick={() => onFileChange(null)}
                        className="text-muted-foreground hover:text-foreground">
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>}
            {file && (file.status === "uploading" || file.status === "processing") && <div className="rounded-lg bg-muted p-3">
                <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm text-foreground">{file.name}</span>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{file.progress}%</span>
                        <button
                            onClick={handlePause}
                            className="text-muted-foreground hover:text-foreground"
                            title="暂停">
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2">
                                <rect x="6" y="4" width="4" height="16" />
                                <rect x="14" y="4" width="4" height="16" />
                            </svg>
                        </button>
                        <button
                            onClick={handleCancel}
                            className="text-muted-foreground hover:text-destructive"
                            title="取消">
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
                <div className="mb-2 h-2 overflow-hidden rounded-full bg-border">
                    <div
                        className="h-full bg-primary transition-all"
                        style={{
                            width: `${file.progress}%`
                        }} />
                </div>
                <p className="text-xs text-muted-foreground">{file.progressText}</p>
            </div>}
            {file && file.status === "paused" && <div className="rounded-lg bg-muted p-3">
                <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm text-foreground">{file.name}</span>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{file.progress}%</span>
                        <button
                            onClick={handleCancel}
                            className="text-xs text-muted-foreground hover:text-destructive"
                            title="取消上传">
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
                <div className="mb-2 h-2 overflow-hidden rounded-full bg-border">
                    <div
                        className="h-full bg-muted-foreground transition-all"
                        style={{
                            width: `${file.progress}%`
                        }} />
                </div>
                <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{file.progressText || "已暂停"}</p>
                    <button
                        onClick={handleResume}
                        className="flex h-[15px] w-[15px] items-center justify-center rounded-full bg-foreground hover:bg-foreground/80 transition-colors"
                        title="继续上传">
                        <svg
                            width="8"
                            height="8"
                            viewBox="0 0 24 24"
                            fill="white"
                            stroke="none">
                            <polygon points="6,3 20,12 6,21" />
                        </svg>
                    </button>
                </div>
            </div>}
            {file && file.status === "error" && <div className="rounded-lg bg-destructive/10 p-3">
                <div className="flex items-center justify-between">
                    <span className="text-sm text-destructive">{file.progressText || "识别失败"}</span>
                    <button
                        onClick={() => onFileChange(null)}
                        className="text-xs text-primary hover:underline">重新上传
                    </button>
                </div>
            </div>}
            <input
                ref={inputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                className="hidden" />
        </div>
    );
}
