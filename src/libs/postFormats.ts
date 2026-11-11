import type { PostDestination, SocialPlatform } from '@/src/types/post';
export const POST_FORMATS: Record<SocialPlatform, { value: PostDestination['format']; label: string }[]> = {
  facebook: [{value:'feed',label:'Feed da Página (texto ou uma foto)'},{value:'video',label:'Vídeo da Página (MP4)'}],
  instagram: [{value:'feed',label:'Post no feed (foto)'},{value:'carousel',label:'Carrossel'},{value:'reel',label:'Reel'},{value:'story',label:'Story'}],
  tiktok: [{value:'video',label:'Vídeo'}],
  youtube: [{value:'video',label:'Vídeo (Shorts é classificado pelo YouTube)'}],
};
export function formatIssue(platform: SocialPlatform, format: string, media: string[]) {
  if (!POST_FORMATS[platform].some(f => f.value === format)) return 'Formato indisponível nesta rede.';
  if (platform === 'facebook') {
    if (format === 'video') {
      return media.length === 1 && /\.mp4$/i.test(media[0])
        ? null
        : 'Vídeo do Facebook exige exatamente um arquivo MP4.';
    }
    return media.length <= 1 && media.every(file => /\.(jpg|png)$/i.test(file))
      ? null
      : 'O feed do Facebook aceita texto ou uma foto JPG/PNG.';
  }
  if (platform !== 'instagram') return null;
  if (format === 'carousel' && (media.length < 2 || media.length > 10)) return 'Carrossel exige de 2 a 10 mídias.';
  if (format !== 'carousel' && media.length !== 1) return 'Este formato exige exatamente uma mídia.';
  if (format === 'feed' && !/\.jpg$/i.test(media[0])) return 'Post no feed exige uma foto JPG. Para vídeo, selecione Reel.';
  if (format === 'reel' && !/\.(mp4|mov)$/i.test(media[0])) return 'Reel exige um vídeo MP4 ou MOV.';
  return null;
}
