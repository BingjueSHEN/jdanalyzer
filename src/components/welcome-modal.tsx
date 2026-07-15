"use client";

export function WelcomeModal({ onConfigure }: { onConfigure: () => void }) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
                className="w-full max-w-md rounded-lg bg-card p-6 text-center shadow-dialog">
                <div className="mb-4 text-4xl">👋</div>
                <h2 className="mb-2 text-xl font-bold text-foreground">欢迎使用 JD分析器</h2>
                <p className="mb-4 text-muted-foreground">本工具需要接入 AI 服务商的 API Key 才能使用
                </p>
                <div className="mb-6 rounded-lg bg-muted p-4 text-left text-sm">
                    <ul className="space-y-2 text-muted-foreground">
                        <li className="flex items-start gap-2">
                            <span className="text-primary">✓</span>
                            <span>支持豆包、通义千问、Kimi、DeepSeek、OpenAI 等</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-primary">✓</span>
                            <span>费用根据您的 API 账户计费，本工具不收取任何费用</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-primary">✓</span>
                            <span>API Key 仅存储在您的浏览器，不会上传到服务器</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-primary">✓</span>
                            <span>推荐使用国产模型，性价比更高</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-amber-500">⚠</span>
                            <span className="text-amber-600">为安全起见，建议定期更换 API Key</span>
                        </li>
                    </ul>
                </div>
                <button
                    onClick={onConfigure}
                    className="mb-3 w-full rounded-lg bg-primary py-3 font-medium text-primary-foreground hover:bg-primary/90">立即配置 API Key
                </button>
                <p className="text-xs text-muted-foreground">也可稍后在右上角设置中配置
                </p>
            </div>
        </div>
    );
}
