import 'server-only';

import { open, stat } from 'fs/promises';
import {
  getMediaContentType,
  getMediaFilePath,
  getMediaOwnerKey,
} from '@/src/libs/mediaStorage';
import { PlatformPublishError } from '@/src/libs/publishTypes';

export interface OwnedLocalVideo {
  filePath: string;
  size: number;
  contentType: string;
}

export async function getOwnedLocalVideo(post: {
  userId: string;
  workspaceId?: string;
  mediaOwnerKeys?: string[];
  mediaUrls: string[];
}): Promise<OwnedLocalVideo> {
  if (post.mediaUrls.length !== 1) {
    throw new PlatformPublishError('A publicação exige exatamente um vídeo.');
  }

  const match =
    /^\/api\/media\/([a-f\d]{64})\/([a-f\d-]{36}\.(?:mp4|mov|webm))$/i.exec(
      post.mediaUrls[0],
    );
  if (!match) {
    throw new PlatformPublishError('Anexe um vídeo MP4, MOV ou WEBM válido.');
  }
  const allowedOwnerKeys = new Set([
    ...(post.mediaOwnerKeys ?? []),
    getMediaOwnerKey(post.userId),
    ...(post.workspaceId ? [getMediaOwnerKey(post.workspaceId)] : []),
  ]);
  if (!allowedOwnerKeys.has(match[1])) {
    throw new PlatformPublishError('O post contém uma mídia que não pertence à conta.');
  }

  const filePath = getMediaFilePath(match[1], match[2]);
  const contentType = getMediaContentType(match[2]);
  if (!filePath || !contentType) {
    throw new PlatformPublishError('O vídeo anexado é inválido.');
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile() || info.size === 0) {
      throw new PlatformPublishError('O vídeo anexado está vazio ou indisponível.');
    }
    return { filePath, size: info.size, contentType };
  } catch (error) {
    if (error instanceof PlatformPublishError) throw error;
    throw new PlatformPublishError(
      'O arquivo de vídeo não foi encontrado no servidor.',
    );
  }
}

export async function readFileRange(
  filePath: string,
  start: number,
  endInclusive: number,
) {
  const length = endInclusive - start + 1;
  const buffer = Buffer.alloc(length);
  const handle = await open(filePath, 'r');
  try {
    let offset = 0;
    while (offset < length) {
      const { bytesRead } = await handle.read(
        buffer,
        offset,
        length - offset,
        start + offset,
      );
      if (bytesRead === 0) {
        throw new PlatformPublishError('O vídeo foi alterado durante o envio.');
      }
      offset += bytesRead;
    }
  } finally {
    await handle.close();
  }
  return buffer;
}
