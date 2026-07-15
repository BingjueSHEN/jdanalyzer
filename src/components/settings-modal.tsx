"use client";
import { useState, useEffect } from "react";
import { AI_PROVIDERS } from "@/lib/ai-providers";
import { getConfig, saveConfig } from "@/lib/storage";

export function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [visionProvider, setVisionProvider] = useState<string>("doubao");
    const [visionModel, setVisionModel] = useState<string>("doubao-seed-2-0-pro-260215");
    const [visionKey, setVisionKey] = useState("");
    const [visionEndpoint, setVisionEndpoint] = useState("");
    const [isCustomVisionModel, setIsCustomVisionModel] = useState(false);
    const [customVisionModel, setCustomVisionModel] = useState("");
    const [textProvider, setTextProvider] = useState<string>("deepseek");
    const [textModel, setTextModel] = useState<string>("deepseek-chat");
    const [textKey, setTextKey] = useState("");
    const [textEndpoint, setTextEndpoint] = useState("");
    const [isCustomTextModel, setIsCustomTextModel] = useState(false);
    const [customTextModel, setCustomTextModel] = useState("");

    useEffect(() => {
        if (isOpen) {
            const config = getConfig();

            if (config.vision) {
                setVisionProvider(config.vision.provider);
                setVisionKey(config.vision.apiKey);
                setVisionEndpoint(config.vision.endpoint);
                const provider = AI_PROVIDERS.find(p => p.id === config.vision.provider);
                const presetModels = provider?.models.filter(m => m.vision) || [];
                const isPreset = presetModels.some(m => m.id === config.vision.model);

                if (isPreset) {
                    setVisionModel(config.vision.model);
                    setIsCustomVisionModel(false);
                    setCustomVisionModel("");
                } else {
                    setIsCustomVisionModel(true);
                    setCustomVisionModel(config.vision.model);
                }
            }

            if (config.text) {
                setTextProvider(config.text.provider);
                setTextKey(config.text.apiKey);
                setTextEndpoint(config.text.endpoint);
                const provider = AI_PROVIDERS.find(p => p.id === config.text.provider);
                const presetModels = provider?.models || [];
                const isPreset = presetModels.some(m => m.id === config.text.model);

                if (isPreset) {
                    setTextModel(config.text.model);
                    setIsCustomTextModel(false);
                    setCustomTextModel("");
                } else {
                    setIsCustomTextModel(true);
                    setCustomTextModel(config.text.model);
                }
            }
        }
    }, [isOpen]);

    const handleVisionProviderChange = (providerId: string) => {
        setVisionProvider(providerId);
        const provider = AI_PROVIDERS.find(p => p.id === providerId);

        if (provider) {
            setVisionEndpoint(provider.endpoint);
            const visionModels = provider.models.filter(m => m.vision);

            if (visionModels.length > 0) {
                setVisionModel(visionModels[0].id);
            }
        }
    };

    const handleTextProviderChange = (providerId: string) => {
        setTextProvider(providerId);
        const provider = AI_PROVIDERS.find(p => p.id === providerId);

        if (provider) {
            setTextEndpoint(provider.endpoint);
            setTextModel(provider.models[0].id);
        }
    };

    const handleSave = () => {
        saveConfig({
            vision: {
                provider: visionProvider,
                endpoint: visionEndpoint,
                apiKey: visionKey,
                model: isCustomVisionModel ? customVisionModel : visionModel
            },

            text: {
                provider: textProvider,
                endpoint: textEndpoint,
                apiKey: textKey,
                model: isCustomTextModel ? customTextModel : textModel
            }
        });

        onClose();
    };

    const handleUseVisionConfig = () => {
        setTextProvider(visionProvider);
        setTextEndpoint(visionEndpoint);
        setTextKey(visionKey);
        setIsCustomTextModel(isCustomVisionModel);

        if (isCustomVisionModel) {
            setCustomTextModel(customVisionModel);
        } else {
            setTextModel(visionModel);
        }
    };

    if (!isOpen)
        return null;

    const visionProviderData = AI_PROVIDERS.find(p => p.id === visionProvider);
    const textProviderData = AI_PROVIDERS.find(p => p.id === textProvider);
    const visionModels = visionProviderData?.models.filter(m => m.vision) || [];
    const textModels = textProviderData?.models || [];

    const getModelPlaceholder = (providerId: string): string => {
        const examples: Record<string, string> = {
            "doubao": "doubao-seed-2-0-lite",
            "qwen": "qwen-vl-max",
            "kimi": "moonshot-v1-128k-vision",
            "deepseek": "deepseek-chat",
            "zhipu": "glm-4v-plus",
            "openai": "gpt-4o",
            "custom": "your-model-name"
        };

        return examples[providerId] || "your-model-name";
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
                className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-card p-6 shadow-dialog">
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-foreground">API 配置</h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="mb-6 rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                    <p className="mb-2">本工具需要接入 AI 服务商的 API Key 才能使用</p>
                    <ul className="space-y-1">
                        <li>所有调用直接连接 AI 服务商，费用根据您的账户计费</li>
                        <li>API Key 仅存储在您的浏览器中，不会上传到任何服务器</li>
                        <li>推荐使用国产模型，性价比更高</li>
                        <li className="text-amber-600">为安全起见，建议定期更换 API Key</li>
                    </ul>
                </div>
                {}
                <div className="mb-6 rounded-lg border border-border p-4">
                    <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <path d="M21 15l-5-5L5 21" />
                        </svg>图像识别配置
                        <span className="text-xs font-normal text-muted-foreground">（用于 PDF/图片识别）</span>
                    </h3>
                    <p className="mb-3 text-xs text-amber-600">需要选择支持图像识别的模型，如 doubao-seed-2-0-pro、gpt-4o、qwen-vl-max 等
                    </p>
                    <div className="space-y-3">
                        <div>
                            <label className="mb-1 block text-sm text-muted-foreground">服务商</label>
                            <select
                                value={visionProvider}
                                onChange={e => handleVisionProviderChange(e.target.value)}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                                {AI_PROVIDERS.filter(p => p.models.some(m => m.vision)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                <option value="custom">其他（自定义）</option>
                            </select>
                        </div>
                        {visionProvider === "custom" ? <div>
                            <label className="mb-1 block text-sm text-muted-foreground">API 端点</label>
                            <input
                                type="text"
                                value={visionEndpoint}
                                onChange={e => setVisionEndpoint(e.target.value)}
                                placeholder="https://api.example.com/v1"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                        </div> : <div>
                            <div className="mb-2 flex items-center gap-4">
                                <label
                                    className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                                    <input
                                        type="radio"
                                        name="visionModelType"
                                        checked={!isCustomVisionModel}
                                        onChange={() => setIsCustomVisionModel(false)}
                                        className="accent-primary" />预设模型
                                </label>
                                <label
                                    className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                                    <input
                                        type="radio"
                                        name="visionModelType"
                                        checked={isCustomVisionModel}
                                        onChange={() => setIsCustomVisionModel(true)}
                                        className="accent-primary" />自定义模型
                                </label>
                            </div>
                            {isCustomVisionModel ? <div>
                                <label className="mb-1 block text-sm text-muted-foreground">模型名称</label>
                                <input
                                    type="text"
                                    value={customVisionModel}
                                    onChange={e => setCustomVisionModel(e.target.value)}
                                    placeholder={`输入模型名称，如 ${getModelPlaceholder(visionProvider)}`}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                                <p className="mt-1 text-xs text-muted-foreground">请确保模型名称正确，否则调用会失败</p>
                            </div> : <div>
                                <label className="mb-1 block text-sm text-muted-foreground">模型</label>
                                <select
                                    value={visionModel}
                                    onChange={e => setVisionModel(e.target.value)}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                                    {visionModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>}
                        </div>}
                        <div>
                            <label className="mb-1 block text-sm text-muted-foreground">API Key</label>
                            <input
                                type="password"
                                value={visionKey}
                                onChange={e => setVisionKey(e.target.value)}
                                placeholder="输入您的 API Key"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                            {visionProviderData?.keyUrl && <a
                                href={visionProviderData.keyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 inline-block text-xs text-primary hover:underline">没有 Key？点这里申请 →
                            </a>}
                        </div>
                    </div>
                </div>
                {}
                <div className="mb-6 rounded-lg border border-border p-4">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="flex items-center gap-2 font-semibold text-foreground">
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                            </svg>文本分析配置
                            <span className="text-xs font-normal text-muted-foreground">（用于 JD 分析）</span>
                        </h3>
                        <button
                            type="button"
                            onClick={handleUseVisionConfig}
                            disabled={!visionKey || !visionProvider}
                            className="self-start rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto">使用图像识别配置 →
                        </button>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <label className="mb-1 block text-sm text-muted-foreground">服务商</label>
                            <select
                                value={textProvider}
                                onChange={e => handleTextProviderChange(e.target.value)}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                                {AI_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        {textProvider === "custom" ? <div>
                            <label className="mb-1 block text-sm text-muted-foreground">API 端点</label>
                            <input
                                type="text"
                                value={textEndpoint}
                                onChange={e => setTextEndpoint(e.target.value)}
                                placeholder="https://api.example.com/v1"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                        </div> : <div>
                            <div className="mb-2 flex items-center gap-4">
                                <label
                                    className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                                    <input
                                        type="radio"
                                        name="textModelType"
                                        checked={!isCustomTextModel}
                                        onChange={() => setIsCustomTextModel(false)}
                                        className="accent-primary" />预设模型
                                </label>
                                <label
                                    className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                                    <input
                                        type="radio"
                                        name="textModelType"
                                        checked={isCustomTextModel}
                                        onChange={() => setIsCustomTextModel(true)}
                                        className="accent-primary" />自定义模型
                                </label>
                            </div>
                            {isCustomTextModel ? <div>
                                <label className="mb-1 block text-sm text-muted-foreground">模型名称</label>
                                <input
                                    type="text"
                                    value={customTextModel}
                                    onChange={e => setCustomTextModel(e.target.value)}
                                    placeholder={`输入模型名称，如 ${getModelPlaceholder(textProvider)}`}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                                <p className="mt-1 text-xs text-muted-foreground">请确保模型名称正确，否则调用会失败</p>
                            </div> : <div>
                                <label className="mb-1 block text-sm text-muted-foreground">模型</label>
                                <select
                                    value={textModel}
                                    onChange={e => setTextModel(e.target.value)}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                                    {textModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>}
                        </div>}
                        <div>
                            <label className="mb-1 block text-sm text-muted-foreground">API Key</label>
                            <input
                                type="password"
                                value={textKey}
                                onChange={e => setTextKey(e.target.value)}
                                placeholder="输入您的 API Key"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                            {textProviderData?.keyUrl && <a
                                href={textProviderData.keyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 inline-block text-xs text-primary hover:underline">没有 Key？点这里申请 →
                            </a>}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted">取消
                    </button>
                    <button
                        onClick={handleSave}
                        className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">保存配置
                    </button>
                </div>
            </div>
        </div>
    );
}
