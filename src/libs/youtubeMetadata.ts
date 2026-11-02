import type { YouTubeOptions } from '@/src/types/post';
import { getYouTubeMetadata } from '@/src/libs/publishPlanning';

export function youtubeMetadata(caption: string, options?: YouTubeOptions) {
  const legacy = getYouTubeMetadata(caption);
  return {
    snippet: {
      title: options ? options.title.trim() : legacy.title,
      description: options ? options.description : legacy.description,
      categoryId: '22',
    },
    status: {
      privacyStatus: options?.privacyStatus ?? 'private',
      selfDeclaredMadeForKids: options?.madeForKids ?? false,
      containsSyntheticMedia: options?.containsSyntheticMedia ?? false,
    },
  };
}

export function validateYouTubeOptions(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Configurações do YouTube inválidas.';
  const o = value as Record<string, unknown>;
  if (typeof o.title !== 'string' || !o.title.trim() || o.title.length > 100 || /[<>]/.test(o.title)) return 'O título do YouTube deve ter de 1 a 100 caracteres, sem < ou >.';
  if (typeof o.description !== 'string' || new TextEncoder().encode(o.description).length > 5000 || /[<>]/.test(o.description)) return 'A descrição do YouTube deve ter até 5.000 bytes, sem < ou >.';
  if (!['private', 'unlisted', 'public'].includes(String(o.privacyStatus))) return 'Escolha uma visibilidade válida para o YouTube.';
  if (typeof o.madeForKids !== 'boolean' || typeof o.containsSyntheticMedia !== 'boolean') return 'Informe as declarações de público infantil e conteúdo sintético do YouTube.';
  return null;
}
