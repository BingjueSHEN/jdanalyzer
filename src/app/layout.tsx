import type { Metadata } from 'next';
import './globals.css';
import { Navigation } from '@/components/navigation';
import { ThemeProvider } from '@/components/theme-provider';

export const metadata: Metadata = {
  title: 'JD分析器 - 智能拆解招聘需求',
  description: '智能拆解招聘需求，匹配你的优势与短板。上传JD和简历，AI帮你分析适配度、缺失技能和补差计划。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <Navigation />
          {/* 桌面端顶部留白 */}
          <div className="hidden md:block h-14" />
          {children}
          {/* 移动端底部留白 */}
          <div className="md:hidden h-16" />
        </ThemeProvider>
      </body>
    </html>
  );
}
