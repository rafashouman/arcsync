import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { Readable } from 'stream';
import {
  getMediaContentType,
  getMediaFilePath,
  getMediaOwnerKey,
  verifySignedMediaUrl,
} from '@/src/libs/mediaStorage';
import { getWorkspaceContext } from '@/src/data/workspaces';
import { getCurrentUser } from '@/src/libs/authSession';

interface RouteContext {
  params: Promise<{ ownerKey: string; filename: string }>;
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR')
  );
}

function rangeNotSatisfiable(size: number) {
  return new Response(null, {
    status: 416,
    headers: {
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, no-store',
      'Content-Range': `bytes */${size}`,
    },
  });
}

async function serveMedia(request: Request, { params }: RouteContext, headOnly = false) {
  const { ownerKey, filename } = await params;
  const url = new URL(request.url);
  const hasSignature = url.searchParams.has('signature') || url.searchParams.has('expires');

  if (hasSignature) {
    if (
      !verifySignedMediaUrl(
        ownerKey,
        filename,
        url.searchParams.get('expires'),
        url.searchParams.get('signature'),
      )
    ) {
      return new Response('Arquivo não encontrado.', { status: 404 });
    }
  } else {
    const user = await getCurrentUser();
    if (!user) {
      return new Response('Não autenticado.', { status: 401 });
    }
    const workspace = await getWorkspaceContext(user.uid, user.email);
    if (ownerKey !== getMediaOwnerKey(user.uid) && ownerKey !== getMediaOwnerKey(workspace.workspaceId)) {
      return new Response('Arquivo não encontrado.', { status: 404 });
    }
  }

  const filePath = getMediaFilePath(ownerKey, filename);
  const contentType = getMediaContentType(filename);
  if (!filePath || !contentType) {
    return new Response('Arquivo não encontrado.', { status: 404 });
  }

  let fileSize: number;
  try {
    fileSize = (await stat(filePath)).size;
  } catch (error) {
    if (isMissingFileError(error)) {
      return new Response('Arquivo não encontrado.', { status: 404 });
    }
    console.error('Erro ao acessar arquivo de mídia:', error);
    return new Response('Não foi possível carregar o arquivo.', { status: 500 });
  }

  let start = 0;
  let end = fileSize - 1;
  let status = 200;
  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store',
    'Content-Disposition': `inline; filename="${filename}"`,
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
  });

  const range = request.headers.get('range');
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2]) || fileSize === 0) {
      return rangeNotSatisfiable(fileSize);
    }

    if (match[1]) {
      start = Number(match[1]);
      end = match[2] ? Number(match[2]) : fileSize - 1;
    } else {
      const suffixLength = Number(match[2]);
      start = Math.max(0, fileSize - suffixLength);
    }

    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      end < start ||
      start >= fileSize
    ) {
      return rangeNotSatisfiable(fileSize);
    }

    end = Math.min(end, fileSize - 1);
    status = 206;
    headers.set('Content-Range', `bytes ${start}-${end}/${fileSize}`);
  }

  headers.set('Content-Length', String(end - start + 1));
  if (headOnly) {
    return new Response(null, { status, headers });
  }
  const stream = createReadStream(filePath, { start, end });
  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
    status,
    headers,
  });
}

export async function GET(request: Request, context: RouteContext) {
  return serveMedia(request, context);
}

export async function HEAD(request: Request, context: RouteContext) {
  return serveMedia(request, context, true);
}
