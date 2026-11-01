'use server';

import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { getCurrentUser } from '@/src/libs/authSession';
import { getWorkspaceContext } from '@/src/data/workspaces';
import { canCreateWorkspacePosts } from '@/src/libs/workspacePermissions';
import {
  getMediaOwnerKey,
  getUploadsDirectory,
  MEDIA_TYPE_EXTENSIONS,
} from '@/src/libs/mediaStorage';

const MAX_FILE_SIZE = 95 * 1024 * 1024;
const MAX_TOTAL_SIZE = 95 * 1024 * 1024;
const MAX_FILES = 10;

export async function uploadMediaFiles(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Sua sessão expirou. Entre novamente.' };
  }
  const workspace = await getWorkspaceContext(user.uid, user.email);
  if (!canCreateWorkspacePosts(workspace.role)) {
    return { success: false, error: 'Seu papel não permite enviar mídias.' };
  }

  const entries = formData.getAll('files');
  if (entries.length === 0) {
    return { success: false, error: 'Selecione ao menos um arquivo.' };
  }

  if (entries.length > MAX_FILES || !entries.every((entry) => entry instanceof File)) {
    return { success: false, error: 'Envie até 10 arquivos de imagem ou vídeo.' };
  }

  const files = entries as File[];
  const totalSize = files.reduce((total, file) => total + file.size, 0);
  if (files.some((file) => file.size === 0 || file.size > MAX_FILE_SIZE)) {
    return { success: false, error: 'Cada arquivo deve ter até 95 MB.' };
  }

  if (totalSize > MAX_TOTAL_SIZE) {
    return { success: false, error: 'O tamanho total dos arquivos deve ser até 95 MB.' };
  }

  if (files.some((file) => !MEDIA_TYPE_EXTENSIONS[file.type])) {
    return {
      success: false,
      error: 'Formato não suportado. Use JPG, PNG, WEBP, GIF, MP4, MOV ou WEBM.',
    };
  }

  try {
    const ownerKey = getMediaOwnerKey(workspace.workspaceId);
    const uploadDir = path.join(getUploadsDirectory(), ownerKey);
    await mkdir(uploadDir, { recursive: true });

    const uploadedUrls: string[] = [];
    for (const file of files) {
      const extension = MEDIA_TYPE_EXTENSIONS[file.type];
      const filename = `${randomUUID()}${extension}`;
      const bytes = await file.arrayBuffer();
      await writeFile(path.join(uploadDir, filename), Buffer.from(bytes), {
        flag: 'wx',
      });
      uploadedUrls.push(`/api/media/${ownerKey}/${filename}`);
    }

    return { success: true, urls: uploadedUrls };
  } catch (error) {
    console.error('Erro ao salvar arquivos enviados:', error);
    return { success: false, error: 'Não foi possível salvar os arquivos enviados.' };
  }
}
