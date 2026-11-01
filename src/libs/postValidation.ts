import {
  SOCIAL_PLATFORMS,
  type SchedulePostInput,
  type SocialPlatform,
} from '@/src/types/post';
import { isValidTimeZone } from '@/src/libs/timeZones';
import {
  getYouTubeMetadata,
  orderedPlatforms,
  TIKTOK_CAPTION_MAX_LENGTH,
  TIKTOK_PRIVACY_LEVELS,
  YOUTUBE_DESCRIPTION_MAX_BYTES,
} from '@/src/libs/publishPlanning';

const MAX_CAPTION_LENGTH = 5000;
const MAX_MEDIA_FILES = 10;
const VIDEO_FILE_PATTERN = /\.(mp4|mov|webm)$/i;

function isTikTokPrivacyLevel(value: unknown): value is SchedulePostInput['tiktokPrivacyLevel'] {
  return (
    typeof value === 'string' &&
    (TIKTOK_PRIVACY_LEVELS as readonly string[]).includes(value)
  );
}

function isSocialPlatform(value: unknown): value is SocialPlatform {
  return (
    typeof value === 'string' &&
    (SOCIAL_PLATFORMS as readonly string[]).includes(value)
  );
}

export function getInstagramPublishingIssue(
  caption: string,
  mediaUrls: string[],
): string | null {
  if (caption.length > 2200) {
    return 'Legendas do Instagram podem ter até 2.200 caracteres.';
  }
  if (mediaUrls.length === 0 || mediaUrls.length > 10) {
    return 'Para publicar no Instagram, anexe de 1 a 10 mídias.';
  }
  if (mediaUrls.some((url) => !/\.(jpg|mp4|mov)$/i.test(url))) {
    return 'A publicação no Instagram aceita imagens JPG e vídeos MP4 ou MOV.';
  }
  return null;
}

export function getTikTokPublishingIssue(
  titleOrCaption: string,
  mediaUrls: string[],
): string | null {
  if (titleOrCaption.length > TIKTOK_CAPTION_MAX_LENGTH) {
    return 'Legendas do TikTok podem ter até 2.200 caracteres.';
  }
  if (mediaUrls.length !== 1 || !VIDEO_FILE_PATTERN.test(mediaUrls[0])) {
    return 'Para publicar no TikTok, anexe exatamente um vídeo MP4, MOV ou WEBM.';
  }
  return null;
}

export function getYouTubePublishingIssue(
  caption: string,
  mediaUrls: string[],
): string | null {
  const { title, description } = getYouTubeMetadata(caption);
  if (!title) {
    return 'Para publicar no YouTube, escreva uma legenda: a primeira linha vira o título do vídeo.';
  }
  if (new TextEncoder().encode(description).length > YOUTUBE_DESCRIPTION_MAX_BYTES) {
    return 'A descrição do YouTube pode ter até 5.000 bytes.';
  }
  if (mediaUrls.length !== 1 || !VIDEO_FILE_PATTERN.test(mediaUrls[0])) {
    return 'Para publicar no YouTube, anexe exatamente um vídeo MP4, MOV ou WEBM.';
  }
  return null;
}

export function getPublishingIssue(
  platform: SocialPlatform,
  caption: string,
  mediaUrls: string[],
): string | null {
  if (platform === 'instagram') {
    return getInstagramPublishingIssue(caption, mediaUrls);
  }
  if (platform === 'tiktok') return getTikTokPublishingIssue(caption, mediaUrls);
  return getYouTubePublishingIssue(caption, mediaUrls);
}

export function canRetryPost(post: {
  status: string;
  platforms: string[];
  publishMayHaveSucceeded?: boolean;
  platformStatuses?: {
    platform: string;
    state: string;
    mayHaveSucceeded?: boolean;
  }[];
}) {
  const statuses = post.platformStatuses ?? [];
  return (
    post.status === 'failed' &&
    post.platforms.length > 0 &&
    post.publishMayHaveSucceeded !== true &&
    !statuses.some(
      (record) => record.state === 'failed' && record.mayHaveSucceeded,
    ) &&
    (statuses.length === 0 || statuses.some((record) => record.state === 'failed'))
  );
}

export function validatePostInput(
  input: unknown,
  ownerKeys: string | readonly string[],
  saveAsDraft: boolean,
  now = Date.now(),
  existingMediaUrls: readonly string[] = [],
): SchedulePostInput | string {
  if (!input || typeof input !== 'object') {
    return 'Dados do post inválidos.';
  }

  const data = input as Record<string, unknown>;
  const allowedOwnerKeys =
    typeof ownerKeys === 'string' ? [ownerKeys] : [...ownerKeys];
  if (typeof data.caption !== 'string' || data.caption.length > MAX_CAPTION_LENGTH) {
    return `A legenda deve ter até ${MAX_CAPTION_LENGTH} caracteres.`;
  }
  if (
    data.tiktokTitle !== undefined &&
    data.tiktokTitle !== null &&
    typeof data.tiktokTitle !== 'string'
  ) {
    return 'O título do TikTok é inválido.';
  }
  const tiktokTitle =
    typeof data.tiktokTitle === 'string' ? data.tiktokTitle : '';
  if (tiktokTitle.length > TIKTOK_CAPTION_MAX_LENGTH) {
    return 'O título do TikTok pode ter até 2.200 caracteres.';
  }
  const tiktokPrivacyLevel = data.tiktokPrivacyLevel;
  if (
    tiktokPrivacyLevel !== undefined &&
    tiktokPrivacyLevel !== null &&
    !isTikTokPrivacyLevel(tiktokPrivacyLevel)
  ) {
    return 'Selecione uma opção de privacidade válida para o TikTok.';
  }
  const booleanTikTokFields = [
    'tiktokAllowComments',
    'tiktokAllowDuet',
    'tiktokAllowStitch',
    'tiktokCommercialContent',
    'tiktokBrandOrganic',
    'tiktokBrandContent',
    'tiktokConsent',
  ];
  if (
    booleanTikTokFields.some(
      (field) => data[field] !== undefined && typeof data[field] !== 'boolean',
    )
  ) {
    return 'As opções de publicação do TikTok são inválidas.';
  }
  const tiktokAllowComments = data.tiktokAllowComments === true;
  const tiktokAllowDuet = data.tiktokAllowDuet === true;
  const tiktokAllowStitch = data.tiktokAllowStitch === true;
  const tiktokCommercialContent = data.tiktokCommercialContent === true;
  const tiktokBrandOrganic = data.tiktokBrandOrganic === true;
  const tiktokBrandContent = data.tiktokBrandContent === true;

  if (
    !Array.isArray(data.platforms) ||
    !data.platforms.every(isSocialPlatform)
  ) {
    return 'Selecione ao menos uma plataforma válida.';
  }
  if (!saveAsDraft && data.platforms.length === 0) {
    return 'Selecione ao menos uma plataforma válida.';
  }
  if (!isValidTimeZone(data.timeZone)) {
    return 'O fuso horário do agendamento é inválido. Atualize a página e tente novamente.';
  }

  let scheduledFor: string | null = null;
  if (!saveAsDraft) {
    if (
      typeof data.scheduledFor !== 'string' ||
      Number.isNaN(Date.parse(data.scheduledFor))
    ) {
      return 'Data e hora do agendamento inválidas.';
    }

    const scheduledDate = new Date(data.scheduledFor);
    if (scheduledDate.getTime() <= now) {
      return 'Escolha uma data e horário no futuro.';
    }
    scheduledFor = scheduledDate.toISOString();
  }

  if (
    !Array.isArray(data.mediaUrls) ||
    data.mediaUrls.length > MAX_MEDIA_FILES ||
    !data.mediaUrls.every(
      (url) =>
        typeof url === 'string' &&
        (allowedOwnerKeys.some((ownerKey) =>
          url.startsWith(`/api/media/${ownerKey}/`),
        ) ||
          existingMediaUrls.includes(url)) &&
        /^\/api\/media\/[a-f\d]{64}\/[a-f\d-]{36}\.(jpg|png|webp|gif|mp4|mov|webm)$/i.test(url),
    )
  ) {
    return 'Os arquivos de mídia enviados são inválidos.';
  }
  if (!saveAsDraft) {
    for (const platform of orderedPlatforms(data.platforms)) {
      const issue =
        platform === 'tiktok'
          ? getTikTokPublishingIssue(
              tiktokTitle.trim() || data.caption,
              data.mediaUrls,
            )
          : getPublishingIssue(platform, data.caption, data.mediaUrls);
      if (issue) return issue;
    }
    if (data.platforms.includes('tiktok')) {
      if (!isTikTokPrivacyLevel(tiktokPrivacyLevel)) {
        return 'Escolha manualmente a privacidade da publicação no TikTok.';
      }
      if (data.tiktokConsent !== true) {
        return 'Confirme o envio do vídeo ao TikTok e a declaração de uso de música.';
      }
      if (
        tiktokCommercialContent &&
        !tiktokBrandOrganic &&
        !tiktokBrandContent
      ) {
        return 'Indique se o conteúdo promove sua marca, conteúdo de terceiros ou ambos.';
      }
      if (!tiktokCommercialContent && (tiktokBrandOrganic || tiktokBrandContent)) {
        return 'Ative a divulgação de conteúdo comercial antes de selecionar uma marca.';
      }
      if (
        tiktokPrivacyLevel === 'SELF_ONLY' &&
        tiktokBrandContent
      ) {
        return 'Conteúdo de marca de terceiros não pode ter privacidade “Somente você”.';
      }
    }
  }
  if (
    saveAsDraft &&
    !data.caption.trim() &&
    data.platforms.length === 0 &&
    data.mediaUrls.length === 0
  ) {
    return 'Adicione uma legenda, selecione uma rede ou anexe uma mídia para salvar o rascunho.';
  }

  return {
    caption: data.caption.trim(),
    platforms: [...new Set(data.platforms)],
    scheduledFor,
    timeZone: data.timeZone,
    mediaUrls: [...data.mediaUrls],
    tiktokTitle: data.platforms.includes('tiktok') ? tiktokTitle.trim() : null,
    tiktokPrivacyLevel: data.platforms.includes('tiktok')
      ? (isTikTokPrivacyLevel(tiktokPrivacyLevel) ? tiktokPrivacyLevel : null)
      : null,
    tiktokAllowComments: data.platforms.includes('tiktok')
      ? tiktokAllowComments
      : false,
    tiktokAllowDuet: data.platforms.includes('tiktok')
      ? tiktokAllowDuet
      : false,
    tiktokAllowStitch: data.platforms.includes('tiktok')
      ? tiktokAllowStitch
      : false,
    tiktokCommercialContent: data.platforms.includes('tiktok')
      ? tiktokCommercialContent
      : false,
    tiktokBrandOrganic: data.platforms.includes('tiktok')
      ? tiktokBrandOrganic
      : false,
    tiktokBrandContent: data.platforms.includes('tiktok')
      ? tiktokBrandContent
      : false,
    tiktokConsentAt:
      !saveAsDraft && data.platforms.includes('tiktok') && data.tiktokConsent === true
        ? new Date(now).toISOString()
        : null,
  };
}
