import { callAIForVision, type AIConfig } from "@/lib/api-client";

// PDF.js type declarations (fallback for non-worker path)
interface PDFPageProxy {
    getViewport(options: { scale: number }): { width: number; height: number };
    render(options: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }): { promise: Promise<void> };
}
interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
}

interface WorkerPageCountResponse {
    type: "pageCount";
    numPages: number;
}

interface WorkerPageRenderedResponse {
    type: "pageRendered";
    pageNumber: number;
    blob: Blob;
}

interface WorkerErrorResponse {
    type: "error";
    error: string;
}

type WorkerResponse = WorkerPageCountResponse | WorkerPageRenderedResponse | WorkerErrorResponse;

/**
 * Creates a PDF worker and returns a promise-based interface
 */
function createPdfWorker(): {
    getPageCount: (pdfData: ArrayBuffer) => Promise<number>;
    renderPage: (pdfData: ArrayBuffer, pageNumber: number, scale: number) => Promise<Blob>;
    terminate: () => void;
} {
    // Use webpack/vite worker creation or fallback to inline worker
    const workerCode = `
        let pdfjsLib = null;
        let cachedPdfData = null;
        let cachedPdf = null;

        async function loadPdfJs() {
            if (pdfjsLib) return pdfjsLib;
            pdfjsLib = await import("pdfjs-dist");
            pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs";
            return pdfjsLib;
        }

        self.onmessage = async (e) => {
            const lib = await loadPdfJs();
            const { type, pdfData } = e.data;

            try {
                if (type === "getPageCount") {
                    const pdf = await lib.getDocument({
                        data: new Uint8Array(pdfData),
                        isEvalSupported: false
                    }).promise;

                    cachedPdfData = pdfData;
                    cachedPdf = pdf;

                    self.postMessage({
                        type: "pageCount",
                        numPages: pdf.numPages
                    });
                } else if (type === "renderPage") {
                    const { pageNumber, scale } = e.data;

                    let pdf;
                    if (cachedPdfData === pdfData && cachedPdf) {
                        pdf = cachedPdf;
                    } else {
                        pdf = await lib.getDocument({
                            data: new Uint8Array(pdfData),
                            isEvalSupported: false
                        }).promise;
                        cachedPdfData = pdfData;
                        cachedPdf = pdf;
                    }

                    const page = await pdf.getPage(pageNumber);
                    const viewport = page.getViewport({ scale });

                    const canvas = new OffscreenCanvas(viewport.width, viewport.height);
                    const ctx = canvas.getContext("2d");

                    await page.render({
                        canvasContext: ctx,
                        viewport
                    }).promise;

                    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 });

                    self.postMessage({
                        type: "pageRendered",
                        pageNumber,
                        blob
                    }, [blob]);
                }
            } catch (error) {
                self.postMessage({
                    type: "error",
                    error: error instanceof Error ? error.message : "Unknown error"
                });
            }
        };
    `;

    // Create worker from blob URL (works in all bundlers)
    const blob = new Blob([workerCode], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl, { type: "module" });

    let requestId = 0;
    const pendingRequests = new Map<number, { resolve: (value: number | Blob) => void; reject: (error: Error) => void }>();

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const data = e.data;
        if (data.type === "error") {
            // Reject all pending requests on error
            for (const [, pending] of pendingRequests) {
                pending.reject(new Error(data.error));
            }
            pendingRequests.clear();
        }
        // For simplicity, resolve the oldest pending request
        // In a more robust implementation, we'd use request IDs
    };

    const getPageCount = (pdfData: ArrayBuffer): Promise<number> => {
        return new Promise((resolve, reject) => {
            const id = ++requestId;
            pendingRequests.set(id, { resolve: resolve as (value: number | Blob) => void, reject });

            const handler = (e: MessageEvent<WorkerResponse>) => {
                if (e.data.type === "pageCount") {
                    worker.removeEventListener("message", handler);
                    pendingRequests.delete(id);
                    resolve(e.data.numPages);
                } else if (e.data.type === "error") {
                    worker.removeEventListener("message", handler);
                    pendingRequests.delete(id);
                    reject(new Error(e.data.error));
                }
            };
            worker.addEventListener("message", handler);
            worker.postMessage({ type: "getPageCount", pdfData }, [pdfData]);
        });
    };

    const renderPage = (pdfData: ArrayBuffer, pageNumber: number, scale: number): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const id = ++requestId;
            pendingRequests.set(id, { resolve: resolve as (value: number | Blob) => void, reject });

            const handler = (e: MessageEvent<WorkerResponse>) => {
                if (e.data.type === "pageRendered" && e.data.pageNumber === pageNumber) {
                    worker.removeEventListener("message", handler);
                    pendingRequests.delete(id);
                    resolve(e.data.blob);
                } else if (e.data.type === "error") {
                    worker.removeEventListener("message", handler);
                    pendingRequests.delete(id);
                    reject(new Error(e.data.error));
                }
            };
            worker.addEventListener("message", handler);

            // We need to send a copy since we'll reuse the data for multiple pages
            const dataCopy = pdfData.slice(0);
            worker.postMessage({ type: "renderPage", pdfData: dataCopy, pageNumber, scale }, [dataCopy]);
        });
    };

    const terminate = () => {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
    };

    return { getPageCount, renderPage, terminate };
}

/**
 * Parse PDF using Web Worker for rendering (non-blocking)
 */
export async function parsePDFWithVision(
    file: File,
    config: AIConfig,
    onProgress: (progress: number, text: string) => Promise<void> | void
): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const worker = createPdfWorker();

    try {
        // Get page count
        const numPages = await worker.getPageCount(arrayBuffer.slice(0));
        const allTexts: string[] = [];

        // Render each page in the worker, then call vision API on main thread
        for (let i = 1; i <= numPages; i++) {
            onProgress(Math.round(i / numPages * 90), `正在识别第 ${i}/${numPages} 页...`);

            // Render page in worker (non-blocking for main thread)
            const blob = await worker.renderPage(arrayBuffer.slice(0), i, 1.5);

            // Call vision API on main thread
            const text = await callAIForVision(blob, config);
            allTexts.push(text);
        }

        return allTexts.join("\n\n");
    } finally {
        worker.terminate();
    }
}

/**
 * Fallback: Parse PDF on main thread (for environments without Worker support)
 */
export async function parsePDFWithVisionFallback(
    file: File,
    config: AIConfig,
    onProgress: (progress: number, text: string) => Promise<void> | void
): Promise<string> {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs";
    const arrayBuffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
        isEvalSupported: false
    }).promise as unknown as PDFDocumentProxy;

    const numPages = pdf.numPages;
    const allTexts: string[] = [];

    for (let i = 1; i <= numPages; i++) {
        onProgress(Math.round(i / numPages * 90), `正在识别第 ${i}/${numPages} 页...`);
        const page = await pdf.getPage(i);

        const viewport = page.getViewport({
            scale: 1.5
        });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;

        await page.render({
            canvasContext: ctx,
            viewport
        }).promise;

        const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), "image/jpeg", 0.8));
        const text = await callAIForVision(blob, config);
        allTexts.push(text);
    }

    return allTexts.join("\n\n");
}

export async function processImageWithVision(file: File, config: AIConfig): Promise<string> {
    return callAIForVision(file, config);
}
