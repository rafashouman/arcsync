import 'server-only';

import { listPublishedYouTubeVideosForWorkspace } from '@/src/data/posts';
import { getDefaultSocialAccountForWorkspace } from '@/src/data/socialAccounts';
import { getValidSocialAccessToken } from '@/src/libs/socialTokens';
import {
  parseYouTubeStatistics,
  summarizeYouTubeStatistics,
} from '@/src/libs/analyticsMetrics';
import { isRecord, requestJson } from '@/src/libs/socialOAuth';
import { YOUTUBE_READONLY_SCOPE } from '@/src/libs/youtubeOAuth';
const MAX_VIDEO_IDS_PER_REQUEST = 50;

export type YouTubeAnalyticsResult =
  | {
      state: 'ready';
      trackedVideoCount: number;
      totals: ReturnType<typeof summarizeYouTubeStatistics>;
    }
  | { state: 'unavailable'; message: string }
  | { state: 'error'; message: string };

export async function getYouTubeAnalytics(
  workspaceId: string,
): Promise<YouTubeAnalyticsResult> {
  if (!process.env.MONGODB_URI) {
    return {
      state: 'unavailable',
      message: 'Configure o MongoDB e conecte uma conta do YouTube.',
    };
  }

  let account: Awaited<
    ReturnType<typeof getDefaultSocialAccountForWorkspace>
  >;
  try {
    account = await getDefaultSocialAccountForWorkspace(
      workspaceId,
      'youtube',
    );
  } catch (error) {
    console.error('Erro ao carregar a conta do YouTube para analytics:', error);
    return {
      state: 'error',
      message: 'Não foi possível carregar as métricas do YouTube agora.',
    };
  }
  if (!account) {
    return {
      state: 'unavailable',
      message: 'Conecte uma conta padrão do YouTube para consultar métricas.',
    };
  }
  if (!account.permissions.includes(YOUTUBE_READONLY_SCOPE)) {
    return {
      state: 'unavailable',
      message:
        'Esta conta não concedeu leitura do YouTube. Remova e conecte novamente a conta para atualizar as permissões.',
    };
  }

  let videos: Awaited<
    ReturnType<typeof listPublishedYouTubeVideosForWorkspace>
  >;
  try {
    videos = await listPublishedYouTubeVideosForWorkspace(workspaceId);
  } catch (error) {
    console.error('Erro ao carregar vídeos publicados para analytics:', error);
    return {
      state: 'error',
      message: 'Não foi possível carregar as métricas do YouTube agora.',
    };
  }
  const videoIds = [...new Set(
    videos
      .map((video) => video.videoId)
      .filter((videoId) => /^[A-Za-z0-9_-]{11}$/.test(videoId)),
  )].slice(0, MAX_VIDEO_IDS_PER_REQUEST);
  if (videoIds.length === 0) {
    return {
      state: 'ready',
      trackedVideoCount: 0,
      totals: summarizeYouTubeStatistics([]),
    };
  }

  try {
    const accessToken = await getValidSocialAccessToken(workspaceId, 'youtube');
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'statistics');
    url.searchParams.set('id', videoIds.join(','));
    const response = await requestJson('YouTube', url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.status === 401 || response.status === 403) {
      return {
        state: 'unavailable',
        message:
          'O YouTube não autorizou a leitura das métricas. Reconecte a conta com a permissão de leitura.',
      };
    }
    if (!response.ok) {
      console.error(
        `A API de métricas do YouTube respondeu com HTTP ${response.status}.`,
      );
      return {
        state: 'error',
        message: 'Não foi possível carregar as métricas do YouTube agora.',
      };
    }

    const returnedVideos = parseYouTubeStatistics(response.body).filter((video) =>
      videoIds.includes(video.videoId),
    );
    if (
      isRecord(response.body) &&
      Array.isArray(response.body.items) &&
      returnedVideos.length !== response.body.items.length
    ) {
      console.error('A API do YouTube retornou estatísticas de vídeo inválidas.');
    }
    return {
      state: 'ready',
      trackedVideoCount: videoIds.length,
      totals: summarizeYouTubeStatistics(returnedVideos),
    };
  } catch (error) {
    console.error('Erro ao carregar métricas do YouTube:', error);
    return {
      state: 'error',
      message: 'Não foi possível carregar as métricas do YouTube agora.',
    };
  }
}
