// 导出工具 - PDF 和图片导出（完整内容捕获）
// 使用 modern-screenshot 替代 html2canvas，支持现代 CSS 颜色函数（oklab/oklch）

export async function exportToPdf(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const { domToPng } = await import("modern-screenshot");
  const { jsPDF } = await import("jspdf");

  // 保存原始样式
  const originalStyle = element.style.cssText;
  
  // 临时展开元素以捕获完整内容
  element.style.height = "auto";
  element.style.maxHeight = "none";
  element.style.overflow = "visible";
  element.style.width = "800px";
  
  // 等待样式应用
  await new Promise(resolve => setTimeout(resolve, 200));

  const dataUrl = await domToPng(element, {
    scale: 3,
    backgroundColor: "#ffffff",
    width: 800,
    height: element.scrollHeight,
  });

  // 恢复原始样式
  element.style.cssText = originalStyle;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  
  // 获取图片尺寸
  const img = new Image();
  img.src = dataUrl;
  await new Promise(resolve => { img.onload = resolve; });
  
  const imgWidth = pdfWidth;
  const imgHeight = (img.height * imgWidth) / img.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(dataUrl, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pdfHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(dataUrl, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;
  }

  pdf.save(`${filename}.pdf`);
}

export async function exportToImage(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const { domToPng } = await import("modern-screenshot");

  // 保存原始样式
  const originalStyle = element.style.cssText;
  
  // 临时展开元素以捕获完整内容
  element.style.height = "auto";
  element.style.maxHeight = "none";
  element.style.overflow = "visible";
  element.style.width = "800px";
  
  // 等待样式应用
  await new Promise(resolve => setTimeout(resolve, 200));

  const dataUrl = await domToPng(element, {
    scale: 3,
    backgroundColor: "#ffffff",
    width: 800,
    height: element.scrollHeight,
  });

  // 恢复原始样式
  element.style.cssText = originalStyle;

  const link = document.createElement("a");
  link.download = `${filename}.png`;
  link.href = dataUrl;
  link.click();
}

/**
 * 导出为独立 HTML 文件（可在 GitHub Pages 直接查看）
 */
export function exportToHtml(
  element: HTMLElement,
  filename: string
): void {
  // 克隆内容
  const content = element.cloneNode(true) as HTMLElement;

  // 移除不需要导出的元素（如按钮等交互元素）
  content.querySelectorAll("button").forEach((el) => el.remove());

  // 生成 HTML 文档
  const htmlDoc = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${filename}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root {
      --background: #FAFAFA;
      --foreground: #1A1A1A;
      --card: #FFFFFF;
      --card-foreground: #1A1A1A;
      --primary: #1A1A1A;
      --primary-foreground: #ffffff;
      --muted: #F0F0F0;
      --muted-foreground: #666666;
      --accent: #F97316;
      --accent-foreground: #ffffff;
      --border: #E5E5E5;
      --destructive: #ef4444;
      --green-500: #22c55e;
      --green-600: #16a34a;
      --orange-500: #f97316;
      --orange-600: #ea580c;
      --red-500: #ef4444;
    }
    * { border-color: var(--border); }
    body {
      background-color: var(--background);
      color: var(--foreground);
      font-family: 'Inter', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
      letter-spacing: 0.05em;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }
    .bg-background { background-color: var(--background); }
    .bg-card { background-color: var(--card); }
    .bg-primary { background-color: var(--primary); }
    .bg-muted { background-color: var(--muted); }
    .bg-muted\\/60 { background-color: rgba(240, 240, 240, 0.6); }
    .bg-green-500\\/10 { background-color: rgba(34, 197, 94, 0.1); }
    .bg-orange-500\\/10 { background-color: rgba(249, 115, 22, 0.1); }
    .text-foreground { color: var(--foreground); }
    .text-card-foreground { color: var(--card-foreground); }
    .text-primary-foreground { color: var(--primary-foreground); }
    .text-muted-foreground { color: var(--muted-foreground); }
    .text-accent { color: var(--accent); }
    .text-green-600 { color: var(--green-600); }
    .text-orange-600 { color: var(--orange-600); }
    .text-destructive { color: var(--destructive); }
    .border-border { border-color: var(--border); }
    .border { border-width: 1px; border-style: solid; }
    .rounded-lg { border-radius: 0.5rem; }
    .rounded-xl { border-radius: 0.75rem; }
    .rounded-full { border-radius: 9999px; }
    .rounded-md { border-radius: 0.375rem; }
    .rounded-sm { border-radius: 0.125rem; }
    .shadow-card { box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .shadow-sm { box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .p-3 { padding: 0.75rem; }
    .p-4 { padding: 1rem; }
    .p-5 { padding: 1.25rem; }
    .p-6 { padding: 1.5rem; }
    .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
    .px-2\\.5 { padding-left: 0.625rem; padding-right: 0.625rem; }
    .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
    .py-0\\.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; }
    .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
    .mb-1 { margin-bottom: 0.25rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-3 { margin-bottom: 0.75rem; }
    .mb-4 { margin-bottom: 1rem; }
    .mb-5 { margin-bottom: 1.25rem; }
    .mb-6 { margin-bottom: 1.5rem; }
    .mt-1 { margin-top: 0.25rem; }
    .mt-3 { margin-top: 0.75rem; }
    .mt-6 { margin-top: 1.5rem; }
    .pt-3 { padding-top: 0.75rem; }
    .pt-6 { padding-top: 1.5rem; }
    .space-y-1 > * + * { margin-top: 0.25rem; }
    .space-y-2 > * + * { margin-top: 0.5rem; }
    .space-y-3 > * + * { margin-top: 0.75rem; }
    .space-y-4 > * + * { margin-top: 1rem; }
    .space-y-6 > * + * { margin-top: 1.5rem; }
    .gap-1 { gap: 0.25rem; }
    .gap-1\\.5 { gap: 0.375rem; }
    .gap-2 { gap: 0.5rem; }
    .gap-3 { gap: 0.75rem; }
    .flex { display: flex; }
    .grid { display: grid; }
    .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .flex-col { flex-direction: column; }
    .flex-wrap { flex-wrap: wrap; }
    .items-center { align-items: center; }
    .items-start { align-items: start; }
    .justify-center { justify-content: center; }
    .text-center { text-align: center; }
    .text-xs { font-size: 0.75rem; line-height: 1rem; }
    .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
    .text-base { font-size: 1rem; line-height: 1.5rem; }
    .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
    .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
    .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
    .text-4xl { font-size: 2.25rem; line-height: 2.5rem; }
    .font-medium { font-weight: 500; }
    .font-semibold { font-weight: 600; }
    .font-bold { font-weight: 700; }
    .leading-relaxed { line-height: 1.625; }
    .leading-loose { line-height: 2; }
    .whitespace-pre-wrap { white-space: pre-wrap; }
    .w-6 { width: 1.5rem; }
    .w-16 { width: 4rem; }
    .h-6 { height: 1.5rem; }
    .shrink-0 { flex-shrink: 0; }
    .inline-flex { display: inline-flex; }
    .border-t { border-top: 1px solid var(--border); }
    .border-t-border { border-top-color: var(--border); }
    .border\\/50 { border-color: rgba(229, 229, 229, 0.5); }
    .border-green-500\\/20 { border-color: rgba(34, 197, 94, 0.2); }
    .border-orange-500\\/20 { border-color: rgba(249, 115, 22, 0.2); }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  ${content.innerHTML}
  <footer style="text-align: center; margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid var(--border); color: var(--muted-foreground); font-size: 0.75rem;">
    <p>由 JD分析器 生成 · ${new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}</p>
  </footer>
</body>
</html>`;

  // 下载 HTML 文件
  const blob = new Blob([htmlDoc], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = `${filename}.html`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}
