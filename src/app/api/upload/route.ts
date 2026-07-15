import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

// 配置
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const CHUNKS_DIR = path.join(UPLOAD_DIR, 'chunks');
const MAX_CHUNK_SIZE = 4 * 1024 * 1024; // 4MB
const CHUNK_THRESHOLD = 16 * 1024 * 1024; // 16MB

// 确保目录存在
async function ensureDir(dir: string) {
    if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
    }
}

// 生成唯一ID
function generateId(): string {
    return crypto.randomUUID();
}

// POST: 处理上传请求
export async function POST(request: NextRequest) {
    try {
        await ensureDir(UPLOAD_DIR);
        await ensureDir(CHUNKS_DIR);

        const formData = await request.formData();
        const action = formData.get('action') as string;

        // 初始化上传
        if (action === 'init') {
            const fileName = formData.get('fileName') as string;
            const fileSize = parseInt(formData.get('fileSize') as string);
            const totalChunks = Math.ceil(fileSize / MAX_CHUNK_SIZE);
            const uploadId = generateId();

            // 创建上传记录目录
            const uploadDir = path.join(CHUNKS_DIR, uploadId);
            await mkdir(uploadDir, { recursive: true });

            // 保存上传元信息
            const metadata = {
                uploadId,
                fileName,
                fileSize,
                totalChunks,
                uploadedChunks: 0,
                createdAt: Date.now()
            };
            await writeFile(
                path.join(uploadDir, 'metadata.json'),
                JSON.stringify(metadata)
            );

            return NextResponse.json({
                success: true,
                uploadId,
                totalChunks,
                chunkSize: MAX_CHUNK_SIZE
            });
        }

        // 上传分片
        if (action === 'chunk') {
            const uploadId = formData.get('uploadId') as string;
            const chunkIndex = parseInt(formData.get('chunkIndex') as string);
            const chunk = formData.get('chunk') as Blob;

            if (!uploadId || isNaN(chunkIndex) || !chunk) {
                return NextResponse.json(
                    { success: false, error: '缺少必要参数' },
                    { status: 400 }
                );
            }

            const uploadDir = path.join(CHUNKS_DIR, uploadId);
            if (!existsSync(uploadDir)) {
                return NextResponse.json(
                    { success: false, error: '上传不存在或已过期' },
                    { status: 404 }
                );
            }

            // 保存分片
            const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
            await writeFile(
                path.join(uploadDir, `chunk_${chunkIndex}`),
                chunkBuffer
            );

            // 更新元信息
            const metadataPath = path.join(uploadDir, 'metadata.json');
            const metadata = JSON.parse(await readFile(metadataPath, 'utf-8'));
            metadata.uploadedChunks++;
            await writeFile(metadataPath, JSON.stringify(metadata));

            return NextResponse.json({
                success: true,
                chunkIndex,
                uploadedChunks: metadata.uploadedChunks,
                totalChunks: metadata.totalChunks
            });
        }

        // 完成上传，合并分片并处理
        if (action === 'complete') {
            const uploadId = formData.get('uploadId') as string;

            if (!uploadId) {
                return NextResponse.json(
                    { success: false, error: '缺少 uploadId' },
                    { status: 400 }
                );
            }

            const uploadDir = path.join(CHUNKS_DIR, uploadId);
            if (!existsSync(uploadDir)) {
                return NextResponse.json(
                    { success: false, error: '上传不存在或已过期' },
                    { status: 404 }
                );
            }

            // 读取元信息
            const metadataPath = path.join(uploadDir, 'metadata.json');
            const metadata = JSON.parse(await readFile(metadataPath, 'utf-8'));

            if (metadata.uploadedChunks !== metadata.totalChunks) {
                return NextResponse.json(
                    { success: false, error: '分片上传不完整' },
                    { status: 400 }
                );
            }

            // 合并分片
            const chunks: Buffer[] = [];
            for (let i = 0; i < metadata.totalChunks; i++) {
                const chunkPath = path.join(uploadDir, `chunk_${i}`);
                const chunkData = await readFile(chunkPath);
                chunks.push(chunkData);
            }

            const mergedBuffer = Buffer.concat(chunks);

            // 清理分片
            for (let i = 0; i < metadata.totalChunks; i++) {
                const chunkPath = path.join(uploadDir, `chunk_${i}`);
                await unlink(chunkPath);
            }
            await unlink(metadataPath);
            try {
                const { rmdir } = await import('fs/promises');
                await rmdir(uploadDir);
            } catch {
                // 忽略
            }

            // 返回文件内容作为 base64
            const base64Content = mergedBuffer.toString('base64');

            return NextResponse.json({
                success: true,
                fileName: metadata.fileName,
                fileSize: metadata.fileSize,
                content: base64Content
            });
        }

        return NextResponse.json(
            { success: false, error: '未知的 action' },
            { status: 400 }
        );

    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json(
            { success: false, error: '上传失败' },
            { status: 500 }
        );
    }
}

// GET: 获取上传状态
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const uploadId = searchParams.get('uploadId');

    if (!uploadId) {
        return NextResponse.json(
            { success: false, error: '缺少 uploadId' },
            { status: 400 }
        );
    }

    const uploadDir = path.join(CHUNKS_DIR, uploadId);
    if (!existsSync(uploadDir)) {
        return NextResponse.json(
            { success: false, error: '上传不存在或已过期' },
            { status: 404 }
        );
    }

    try {
        const metadataPath = path.join(uploadDir, 'metadata.json');
        const metadata = JSON.parse(await readFile(metadataPath, 'utf-8'));

        return NextResponse.json({
            success: true,
            ...metadata
        });
    } catch {
        return NextResponse.json(
            { success: false, error: '读取状态失败' },
            { status: 500 }
        );
    }
}
