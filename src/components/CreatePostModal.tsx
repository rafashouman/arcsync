'use client';
import {historyEventLabel} from '@/src/libs/postHistory';

import Image from 'next/image';
import { listPostAccounts } from '@/src/app/actions/destinationActions';
import { POST_FORMATS } from '@/src/libs/postFormats';
import type { PostDestination } from '@/src/types/post';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Check,
  Clock3,
  Copy,
  Film,
  FileText,
  ImagePlus,
  LoaderCircle,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { useSchedulerStore } from '@/src/store/useSchedulerStore';
import { getTikTokCreatorInfoForPost } from '@/src/app/actions/socialAccountActions';
import {
  createScheduledPost,
  deleteScheduledPost,
  duplicatePostAsDraft,
  retryFailedPost,
  updateScheduledPost,
} from '@/src/app/actions/postActions';
import { uploadMediaFiles } from '@/src/app/actions/uploadActions';
import {
  InstagramIcon,
  FacebookIcon,
  TikTokIcon,
  YoutubeIcon,
} from '@/src/components/icons/SocialIcons';
import {
  getDateTimeInputValues,
  isValidTimeZone,
  zonedDateTimeToIso,
} from '@/src/libs/timeZones';
import {
  canRetryPost,
  getInstagramPublishingIssue,
} from '@/src/libs/postValidation';
import type {
  PostRecord,
  SocialPlatform,
  TikTokPrivacyLevel,
} from '@/src/types/post';

const platforms: {
  id: SocialPlatform;
  label: string;
  Icon: typeof InstagramIcon;
  activeClass: string;
}[] = [
  {id:'facebook',label:'Facebook',Icon:FacebookIcon,activeClass:'border-blue-400/40 bg-blue-400/10 text-blue-200'},
  {
    id: 'instagram',
    label: 'Instagram',
    Icon: InstagramIcon,
    activeClass: 'border-pink-400/40 bg-pink-400/[0.08] text-pink-200',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    Icon: TikTokIcon,
    activeClass: 'border-cyan-300/40 bg-cyan-300/[0.08] text-cyan-100',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    Icon: YoutubeIcon,
    activeClass: 'border-red-400/40 bg-red-400/[0.08] text-red-200',
  },
];

const MAX_FILES = 10;
const MAX_TOTAL_UPLOAD_BYTES = 95 * 1024 * 1024;
const MAX_CAPTION_LENGTH = 5000;
const INSTAGRAM_CAPTION_LIMIT = 2200;
const TIKTOK_PRIVACY_LABELS: Record<TikTokPrivacyLevel, string> = {
  PUBLIC_TO_EVERYONE: 'Público',
  FOLLOWER_OF_CREATOR: 'Seguidores',
  MUTUAL_FOLLOW_FRIENDS: 'Amigos',
  SELF_ONLY: 'Somente você',
};
const COMMON_TIME_ZONES = [
  'UTC',
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Mexico_City',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
];

type PendingAction =
  | 'schedule'
  | 'draft'
  | 'duplicate'
  | 'retry'
  | 'delete'
  | null;

function isVideoMediaUrl(url: string): boolean {
  return /\.(mp4|mov|webm)(?:[?#]|$)/i.test(url);
}

function getDeviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function initialScheduledDate(
  selectedPost: PostRecord | null,
  selectedDate: Date | null,
) {
  const date = selectedPost?.scheduledFor
    ? new Date(selectedPost.scheduledFor)
    : new Date(selectedDate ?? new Date());
  if (!selectedPost?.scheduledFor) {
    date.setHours(12, 0, 0, 0);
    if (date <= new Date()) date.setDate(date.getDate() + 1);
  }
  return date;
}

export default function CreatePostModal() {
  const { isModalOpen, selectedDate, selectedPost } = useSchedulerStore();
  if (!isModalOpen) return null;

  return (
    <PostModalContent
      key={`${selectedPost?._id ?? 'new'}:${selectedDate?.getTime() ?? 0}`}
      selectedDate={selectedDate}
      selectedPost={selectedPost}
    />
  );
}

function PostModalContent({
  selectedDate,
  selectedPost,
}: {
  selectedDate: Date | null;
  selectedPost: PostRecord | null;
}) {
  const router = useRouter();
  const { closeModal, openModal } = useSchedulerStore();
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog?.showModal();
    return () => {dialog?.close();document.body.style.overflow = overflow;previous?.focus();};
  }, []);
  const [timeZone, setTimeZone] = useState(() => {
    const storedTimeZone = selectedPost?.timeZone;
    return typeof storedTimeZone === 'string' && isValidTimeZone(storedTimeZone)
      ? storedTimeZone
      : getDeviceTimeZone();
  });
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(
    () => selectedPost?.platforms ?? [],
  );
  const [destinations, setDestinations] = useState<PostDestination[]>(selectedPost?.destinations ?? []);
  const [accounts, setAccounts] = useState<Awaited<ReturnType<typeof listPostAccounts>>['accounts']>([]);
  const [accountNotice, setAccountNotice] = useState('Carregando contas...');
  useEffect(() => { let active = true; void listPostAccounts().then(result => { if (active) { setAccounts(result.accounts); setAccountNotice(result.error || (result.accounts.length ? '' : 'Conecte as redes na etapa final. Por enquanto, salve como rascunho.')); } }).catch(() => { if(active) setAccountNotice('Não foi possível carregar as contas.'); }); return () => { active = false; }; }, []);
  function updateDestination(platform: SocialPlatform, patch: Partial<PostDestination>) {
    if (platform === 'tiktok') {
      setTikTokConsent(false);
      if ('mediaUrls' in patch) setVideoDurationSeconds(null);
      if ('accountId' in patch) { setTikTokCreatorInfo(null); setTikTokPrivacyLevel(''); }
    }
    setDestinations(current => [...current.filter(d => d.platform !== platform), { platform, accountId:'', format:(platform === 'instagram' || platform === 'facebook') ? 'feed' : 'video', ...current.find(d => d.platform === platform), ...patch }]);
  }
  const [previewPlatform, setPreviewPlatform] = useState<SocialPlatform>(
    () => selectedPost?.platforms?.[0] ?? 'instagram',
  );
  const [initialDateTime] = useState(() => {
    if (selectedPost?.scheduledFor) {
      const zone =
        typeof selectedPost.timeZone === 'string' &&
        isValidTimeZone(selectedPost.timeZone)
          ? selectedPost.timeZone
          : getDeviceTimeZone();
      return getDateTimeInputValues(selectedPost.scheduledFor, zone);
    }
    return {
      date: dateInputValue(initialScheduledDate(selectedPost, selectedDate)),
      time: '12:00',
    };
  });
  const [scheduledDate, setScheduledDate] = useState(initialDateTime.date);
  const [time, setTime] = useState(initialDateTime.time);
  const [caption, setCaption] = useState(selectedPost?.caption ?? '');
  const [tiktokTitle, setTikTokTitle] = useState(selectedPost?.tiktokTitle ?? '');
  const [tiktokPrivacyLevel, setTikTokPrivacyLevel] = useState<
    TikTokPrivacyLevel | ''
  >(selectedPost?.tiktokPrivacyLevel ?? '');
  const [tiktokAllowComments, setTikTokAllowComments] = useState(
    selectedPost?.tiktokAllowComments ?? false,
  );
  const [tiktokAllowDuet, setTikTokAllowDuet] = useState(
    selectedPost?.tiktokAllowDuet ?? false,
  );
  const [tiktokAllowStitch, setTikTokAllowStitch] = useState(
    selectedPost?.tiktokAllowStitch ?? false,
  );
  const [tiktokCommercialContent, setTikTokCommercialContent] = useState(
    selectedPost?.tiktokCommercialContent ?? false,
  );
  const [tiktokBrandOrganic, setTikTokBrandOrganic] = useState(
    selectedPost?.tiktokBrandOrganic ?? false,
  );
  const [tiktokBrandContent, setTikTokBrandContent] = useState(
    selectedPost?.tiktokBrandContent ?? false,
  );
  const [tiktokConsentSelection, setTikTokConsent] = useState<string | false>(false);
  const [tiktokCreatorInfo, setTikTokCreatorInfo] = useState<{
    creatorNickname: string;
    privacyLevelOptions: string[];
    commentDisabled: boolean;
    duetDisabled: boolean;
    stitchDisabled: boolean;
    maxVideoPostDurationSeconds: number;
  } | null>(null);
  const [tiktokPublicPostingAllowed, setTikTokPublicPostingAllowed] =
    useState(false);
  const [tiktokCreatorInfoError, setTikTokCreatorInfoError] = useState('');
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number | null>(
    null,
  );
  const [mediaUrls, setMediaUrls] = useState<string[]>(
    () => selectedPost?.mediaUrls ?? [],
  );
  const [isUploading, setIsUploading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasTikTokSelected = selectedPlatforms.includes('tiktok');
  const tiktokConsentKey = JSON.stringify({destination: destinations.find(d => d.platform === 'tiktok'), caption, mediaUrls, tiktokTitle, tiktokPrivacyLevel, tiktokAllowComments, tiktokAllowDuet, tiktokAllowStitch, tiktokCommercialContent, tiktokBrandOrganic, tiktokBrandContent});
  const tiktokConsent = tiktokConsentSelection === tiktokConsentKey;
  const tiktokDisclosureMissing = hasTikTokSelected && tiktokCommercialContent && !tiktokBrandOrganic && !tiktokBrandContent;

  const tiktokAccountId = destinations.find(d => d.platform === 'tiktok')?.accountId;
  const tiktokMediaUrl = (destinations.find(d => d.platform === 'tiktok')?.mediaUrls ?? mediaUrls)[0];
  useEffect(() => {
    if (!hasTikTokSelected || !tiktokMediaUrl) return;
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => setVideoDurationSeconds(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => setVideoDurationSeconds(null);
    video.src = tiktokMediaUrl;
    return () => { video.onloadedmetadata = null; video.onerror = null; video.removeAttribute('src'); video.load(); };
  }, [hasTikTokSelected, tiktokMediaUrl]);
  useEffect(() => {
    if (!hasTikTokSelected || !tiktokAccountId) return;

    let active = true;
    void getTikTokCreatorInfoForPost(tiktokAccountId)
      .then((result) => {
        if (!active) return;
        if (!result.success) {
          setTikTokCreatorInfo(null);
          setTikTokCreatorInfoError(result.error);
          return;
        }

        const { creatorInfo } = result;
        setTikTokCreatorInfo(creatorInfo);
        setTikTokCreatorInfoError('');
        setTikTokPublicPostingAllowed(result.publicPostingAllowed);
        setTikTokAllowComments((value) =>
          creatorInfo.commentDisabled ? false : value,
        );
        setTikTokAllowDuet((value) => (creatorInfo.duetDisabled ? false : value));
        setTikTokAllowStitch((value) =>
          creatorInfo.stitchDisabled ? false : value,
        );
        setTikTokPrivacyLevel((current) =>
          current &&
          creatorInfo.privacyLevelOptions.includes(current) &&
          (result.publicPostingAllowed || current === 'SELF_ONLY')
            ? current
            : '',
        );
      })
      .catch((error) => {
        console.error('Erro ao carregar as opções do TikTok:', error);
        if (active) {
          setTikTokCreatorInfo(null);
          setTikTokCreatorInfoError(
            'Não foi possível consultar a conta TikTok. Tente novamente.',
          );
        }
      });

    return () => {
      active = false;
    };
  }, [hasTikTokSelected, tiktokAccountId]);

  const isBusy = pendingAction !== null;
  const lockedPost =
    selectedPost?.status === 'published' ||
    selectedPost?.status === 'processing' ||
    selectedPost?.publishMayHaveSucceeded === true;
  const timeZoneOptions = [...new Set([timeZone, ...COMMON_TIME_ZONES])].sort();
  const previewDestinationTime = destinations.find(d => d.platform === previewPlatform)?.scheduledFor;
  const previewDateTime = previewDestinationTime ? getDateTimeInputValues(previewDestinationTime,timeZone) : {date:scheduledDate,time};
  const previewMediaUrls = destinations.find(d => d.platform === previewPlatform)?.mediaUrls ?? mediaUrls;
  const previewPlatformDetails =
    platforms.find((platform) => platform.id === previewPlatform) ??
    platforms[0];
  const instagramPublishingIssue = getInstagramPublishingIssue(
    destinations.find(d => d.platform === 'instagram')?.caption || caption,
    destinations.find(d => d.platform === 'instagram')?.mediaUrls ?? mediaUrls,
  );
  const minDateValue = getDateTimeInputValues(
    new Date().toISOString(),
    timeZone,
  ).date;

  const togglePlatform = (platform: SocialPlatform) => {
    setSelectedPlatforms((current) => {
      const isSelected = current.includes(platform);
      const next = isSelected
        ? current.filter((value) => value !== platform)
        : [...current, platform];

      if (!isSelected && current.length === 0) {
        setPreviewPlatform(platform);
      } else if (isSelected && previewPlatform === platform && next.length > 0) {
        setPreviewPlatform(next[0]);
      }

      return next;
    });
  };

  const handleFileChange = async (files: FileList | null) => {
    if (!files?.length) return;

    const selectedFiles = Array.from(files);
    if (mediaUrls.length + selectedFiles.length > MAX_FILES) {
      setErrorMessage(`Você pode anexar até ${MAX_FILES} arquivos por post.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const totalBytes = selectedFiles.reduce(
      (total, file) => total + file.size,
      0,
    );
    if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) {
      setErrorMessage('O tamanho total dos arquivos deve ser até 95 MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    setErrorMessage('');
    setVideoDurationSeconds(null);
    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append('files', file));

      const result = await uploadMediaFiles(formData);
      if (result.success && result.urls) {
        setMediaUrls((current) => {
          const combined = [...current, ...result.urls];
          return [...new Set(combined)].slice(0, MAX_FILES);
        });
      } else {
        setErrorMessage(
          result.error ?? 'Não foi possível enviar os arquivos.',
        );
      }
    } catch (error) {
      console.error('Erro ao enviar mídia:', error);
      setErrorMessage('Não foi possível enviar a mídia. Tente novamente.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async (asDraft: boolean, publishNow = false) => {
    if (!asDraft && selectedPlatforms.length === 0) {
      setErrorMessage('Selecione ao menos uma rede social.');
      return;
    }

    if (
      !asDraft &&
      selectedPlatforms.includes('instagram') &&
      instagramPublishingIssue
    ) {
      setErrorMessage(instagramPublishingIssue);
      return;
    }
    if (!asDraft && hasTikTokSelected) {
      if (!tiktokCreatorInfo) {
        setErrorMessage(
          tiktokCreatorInfoError ||
            'Aguarde a consulta das opções da sua conta TikTok antes de agendar.',
        );
        return;
      }
      if (
        (videoDurationSeconds === null ||
        videoDurationSeconds > tiktokCreatorInfo.maxVideoPostDurationSeconds)
      ) {
        setErrorMessage(
          videoDurationSeconds === null
            ? 'Aguarde a prévia do vídeo carregar para validar a duração.'
            : `O vídeo excede o limite de ${tiktokCreatorInfo.maxVideoPostDurationSeconds} segundos da sua conta TikTok.`,
        );
        return;
      }
      if (!tiktokConsent) {
        setErrorMessage(
          'Confirme que você tem autorização para enviar o vídeo e os direitos de uso da música.',
        );
        return;
      }
    }

    const scheduledFor = asDraft
      ? null
      : publishNow ? new Date(Date.now() + 30_000).toISOString() : zonedDateTimeToIso(scheduledDate, time, timeZone);

    if (!asDraft) {
      if (!scheduledFor) {
        setErrorMessage(
          'Esse horário não existe no fuso selecionado (mudança de horário de verão). Escolha outro horário.',
        );
        return;
      }
      if (new Date(scheduledFor).getTime() <= Date.now()) {
        setErrorMessage('Escolha uma data e horário no futuro.');
        return;
      }
    }

    setPendingAction(asDraft ? 'draft' : 'schedule');
    setErrorMessage('');
    try {
      const input = {
        caption,
        platforms: selectedPlatforms,
        destinations: selectedPlatforms.map(platform => destinations.find(d => d.platform === platform) ?? {platform, accountId:'', format:(platform === 'instagram' || platform === 'facebook') ? 'feed' : 'video'}),
        scheduledFor,
        timeZone,
        mediaUrls,
        tiktokTitle,
        tiktokPrivacyLevel: tiktokPrivacyLevel || null,
        tiktokAllowComments,
        tiktokAllowDuet,
        tiktokAllowStitch,
        tiktokCommercialContent,
        tiktokBrandOrganic,
        tiktokBrandContent,
        tiktokConsent,
      };
      const result = selectedPost
        ? await updateScheduledPost(selectedPost._id, input, asDraft)
        : await createScheduledPost(input, asDraft);

      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }

      closeModal();
      router.refresh();
    } catch (error) {
      console.error('Erro ao salvar agendamento:', error);
      setErrorMessage(
        'Não foi possível salvar. Verifique sua conexão e tente novamente.',
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleDelete = async () => {
    if (
      !selectedPost ||
      !window.confirm('Deseja excluir este agendamento?')
    ) {
      return;
    }

    setPendingAction('delete');
    setErrorMessage('');
    try {
      const result = await deleteScheduledPost(selectedPost._id);
      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }
      closeModal();
      router.refresh();
    } catch (error) {
      console.error('Erro ao excluir agendamento:', error);
      setErrorMessage(
        'Não foi possível excluir o agendamento. Tente novamente.',
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleDuplicate = async () => {
    if (!selectedPost) return;

    setPendingAction('duplicate');
    setErrorMessage('');
    try {
      const result = await duplicatePostAsDraft(selectedPost._id, timeZone);
      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }

      openModal(new Date(), result.post);
      router.refresh();
    } catch (error) {
      console.error('Erro ao duplicar post:', error);
      setErrorMessage('Não foi possível duplicar o post. Tente novamente.');
    } finally {
      setPendingAction(null);
    }
  };

  const handleRetry = async () => {
    if (
      !selectedPost ||
      !window.confirm(
        'Tentar novamente as plataformas com falha confirmada? Plataformas já publicadas serão preservadas.',
      )
    ) {
      return;
    }

    setPendingAction('retry');
    setErrorMessage('');
    try {
      const result = await retryFailedPost(selectedPost._id);
      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }

      closeModal();
      router.refresh();
    } catch (error) {
      console.error('Erro ao tentar novamente a publicação:', error);
      setErrorMessage('Não foi possível tentar novamente. Tente outra vez.');
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="post-modal-title"
      aria-modal="true"
      onCancel={event => {
        event.preventDefault();
        if (!isBusy && !isUploading) closeModal();
      }}
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          'button, a[href], input, select, textarea, [tabindex]',
        )).filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && event.target === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && event.target === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-center justify-center bg-[#05070c]/75 p-3 text-slate-200 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !isBusy &&
          !isUploading
        ) {
          closeModal();
        }
      }}
    >
      <section
        className="custom-scrollbar max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#11151f] shadow-2xl shadow-black/50"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.07] bg-[#11151f]/95 px-5 py-4 backdrop-blur sm:px-7">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-300">
              Planejamento de conteúdo
            </p>
            <h2
              id="post-modal-title"
              className="mt-1 text-lg font-semibold text-white"
            >
              {selectedPost ? 'Editar agendamento' : 'Novo agendamento'}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeModal}
            disabled={isBusy || isUploading}
            aria-label="Fechar"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
          >
            <X size={19} />
          </button>
        </div>

        <div className="space-y-6 p-5 sm:p-7">
          {selectedPost?.errorLog && (
            <div
              role="alert"
              className="rounded-xl border border-rose-400/15 bg-rose-400/[0.05] p-3 text-xs leading-5 text-rose-100/85"
            >
              {selectedPost.publishMayHaveSucceeded && (
                <strong className="font-semibold">Resultado incerto: </strong>
              )}
              {selectedPost.errorLog}
            </div>
          )}
          {lockedPost && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-3 text-xs leading-5 text-amber-100/80">
              <AlertCircle
                size={16}
                className="mt-0.5 shrink-0 text-amber-200"
              />
              {selectedPost?.publishMayHaveSucceeded
                ? 'Uma rede pode ter publicado este post. Ele está bloqueado para evitar uma publicação duplicada.'
                : 'Publicações em andamento ou já publicadas não podem ser alteradas.'}
            </div>
          )}

          {selectedPost?.platformStatuses?.length ? <section aria-label="Resultado por rede" className="space-y-2 rounded-xl border border-white/10 p-4">
            <h3 className="font-medium">Resultado por rede</h3>
            {selectedPost.platformStatuses.map(result => <div key={result.platform} className="text-sm">
              <strong className="capitalize">{result.platform}</strong>: {result.mayHaveSucceeded ? 'Resultado incerto — confira na rede antes de qualquer reenvio' : ({published:'Publicado',failed:'Falha',uploading:'Enviando',processing:'Processando'})[result.state]}
              {result.error && <p className="text-amber-200">{result.error}</p>}
              {result.state === 'published' && result.platform === 'youtube' && result.externalId && <a className="ml-2 underline" target="_blank" rel="noopener noreferrer" href={`https://www.youtube.com/watch?v=${encodeURIComponent(result.externalId)}`}>Ver publicação</a>}
            </div>)}
          </section> : null}
          {selectedPost?.history?.length ? <details className="rounded border border-white/10 p-3"><summary>Histórico de processamento ({selectedPost.history.length})</summary><ol>{selectedPost.history.map((h,i) => <li key={i} className="py-1 text-xs">{h.at} — {historyEventLabel(h.event)} {h.states?.map(s => `${s.platform}: ${s.state}`).join(', ')}</li>)}</ol></details> : null}
          <fieldset
            disabled={lockedPost || isBusy || isUploading}
            className="space-y-6"
          >
            <div>
              <div className="mb-2.5 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-200">
                  Redes sociais
                </p>
                <span className="text-[11px] text-slate-500">
                  Selecione uma ou mais
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {platforms.map(({ id, label, Icon, activeClass }) => {
                  const isSelected = selectedPlatforms.includes(id);
                  return (
                    <button
                      type="button"
                      key={id}
                      aria-pressed={isSelected}
                      onClick={() => togglePlatform(id)}
                      className={`flex min-h-[72px] items-center justify-center gap-2 rounded-xl border text-sm font-medium transition ${
                        isSelected
                          ? activeClass
                          : 'border-white/[0.08] bg-white/[0.02] text-slate-400 hover:border-white/20 hover:text-slate-200'
                      }`}
                    >
                      <Icon size={18} />
                      {label}
                      {isSelected && <Check size={14} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {accountNotice && <p role="status" className="text-sm text-amber-200">{accountNotice}</p>}
            {selectedPlatforms.map(platform => {
              const d = destinations.find(item => item.platform === platform);
              return <section key={platform} className="space-y-3 rounded-xl border border-white/10 p-4">
                <h3 className="font-medium capitalize">{platform}</h3>
                <label className="block text-sm">Conta de destino
                  <select aria-label={`Conta ${platform}`} className="mt-1 w-full rounded bg-slate-900 p-2" value={d?.accountId ?? ''} onChange={e => updateDestination(platform, {accountId:e.target.value})}>
                    <option value="">Selecione uma conta</option>
                    {accounts.filter(a => a.platform === platform).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </label>
                <label className="block text-sm">Horário próprio (no fuso {timeZone})
                  <input type="datetime-local" aria-label={`Horário ${platform}`} className="mt-1 w-full rounded bg-slate-900 p-2" value={d?.scheduledFor ? (() => { const v = getDateTimeInputValues(d.scheduledFor, timeZone); return `${v.date}T${v.time}`; })() : ''} onChange={e => { const [date, time] = e.target.value.split('T'); const iso = date && time ? zonedDateTimeToIso(date,time,timeZone) : null; updateDestination(platform,{scheduledFor:iso ?? undefined}); }} />
                </label>
                <label className="block text-sm">Mídias próprias (opcional)
                  <input type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" aria-label={`Mídias ${platform}`} onChange={async e => { const files = Array.from(e.target.files ?? []); if (!files.length) return; setIsUploading(true); try { const form = new FormData(); files.forEach(file => form.append('files', file)); const result = await uploadMediaFiles(form); if (result.success) updateDestination(platform,{mediaUrls:result.urls}); else setErrorMessage(result.error ?? 'Falha no upload.'); } catch {setErrorMessage('Falha no upload do destino.');} finally {setIsUploading(false);} }} />
                </label>
                {d?.mediaUrls && <div className="text-xs">{d.mediaUrls.length} mídia(s) próprias <button type="button" onClick={() => updateDestination(platform,{mediaUrls:undefined})}>Usar mídias comuns</button></div>}
                <label className="block text-sm">Tipo de publicação
                  <select aria-label={`Formato ${platform}`} className="mt-1 w-full rounded bg-slate-900 p-2" value={d?.format ?? ((platform === 'instagram' || platform === 'facebook') ? 'feed' : 'video')} onChange={e => updateDestination(platform, {format:e.target.value as PostDestination['format']})}>
                    {POST_FORMATS[platform].map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </label>
                {d?.format === 'story' && <p className="text-xs text-amber-200">Story aceita uma foto ou vídeo. A legenda não aparece no Story; prepare o texto na própria mídia. A disponibilidade depende da conta e das permissões da Meta.</p>}
                {platform === 'youtube' && <div className="space-y-3">
                  <p className="text-xs text-slate-400">Sem personalização, a primeira linha da legenda vira o título e o vídeo será privado.</p>
                  <label className="flex gap-2 text-sm"><input type="checkbox" checked={Boolean(d?.youtube)} onChange={e => updateDestination(platform, {youtube: e.target.checked ? {title: (d?.caption || caption).split('\n')[0].slice(0,100) || 'Novo vídeo', description: (d?.caption || caption).split('\n').slice(1).join('\n'), privacyStatus:'private', madeForKids:false, containsSyntheticMedia:false} : undefined})} />Personalizar configurações do YouTube</label>
                  {d?.youtube && <>
                    <label className="block text-sm">Título do vídeo<input className="mt-1 w-full rounded bg-slate-900 p-2" maxLength={100} value={d.youtube.title} onChange={e => updateDestination(platform,{youtube:{...d.youtube!,title:e.target.value}})} /></label>
                    <label className="block text-sm">Descrição do vídeo<textarea className="mt-1 w-full rounded bg-slate-900 p-2" maxLength={5000} value={d.youtube.description} onChange={e => updateDestination(platform,{youtube:{...d.youtube!,description:e.target.value}})} /></label>
                    <label className="block text-sm">Visibilidade<select className="mt-1 w-full rounded bg-slate-900 p-2" value={d.youtube.privacyStatus} onChange={e => updateDestination(platform,{youtube:{...d.youtube!,privacyStatus:e.target.value as 'private' | 'unlisted' | 'public'}})}><option value="private">Privado</option><option value="unlisted">Não listado</option><option value="public">Público</option></select></label>
                    <label className="flex gap-2 text-sm"><input type="checkbox" checked={d.youtube.madeForKids} onChange={e => updateDestination(platform,{youtube:{...d.youtube!,madeForKids:e.target.checked}})} />Este vídeo é destinado a crianças</label>
                    <label className="flex gap-2 text-sm"><input type="checkbox" checked={d.youtube.containsSyntheticMedia} onChange={e => updateDestination(platform,{youtube:{...d.youtube!,containsSyntheticMedia:e.target.checked}})} />Contém conteúdo realista alterado ou sintético</label>
                  </>}
                </div>}
                {!d?.youtube && <label className="block text-sm">{platform === 'youtube' ? 'Título na primeira linha e descrição abaixo' : 'Legenda específica (opcional)'}
                  <textarea aria-label={`Texto ${platform}`} className="mt-1 w-full rounded bg-slate-900 p-2" maxLength={5000} value={d?.caption ?? ''} placeholder="Em branco, usa a legenda principal" onChange={e => updateDestination(platform,{caption:e.target.value})} />
                </label>}
              </section>;
            })}

            <div>
              <div className="mb-2.5 flex items-center justify-between">
                <label
                  htmlFor="post-caption"
                  className="text-sm font-medium text-slate-200"
                >
                  Legenda
                </label>
                <span
                  className={`text-[11px] ${
                    caption.length > MAX_CAPTION_LENGTH
                      ? 'text-rose-300'
                      : 'text-slate-500'
                  }`}
                >
                  {caption.length}/{MAX_CAPTION_LENGTH}
                </span>
              </div>
              <textarea
                id="post-caption"
                value={caption}
                maxLength={MAX_CAPTION_LENGTH}
                onChange={(event) => setCaption(event.target.value)}
                placeholder="Escreva a legenda do seu post..."
                rows={4}
                className="w-full resize-y rounded-xl border border-white/[0.09] bg-[#0c1018] px-3.5 py-3 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/10"
              />
              {(previewPlatform === 'instagram' ||
                selectedPlatforms.includes('instagram')) && (
                <p
                  className={`mt-1.5 text-right text-[10px] ${
                    caption.length > INSTAGRAM_CAPTION_LIMIT
                      ? 'text-rose-300'
                      : 'text-slate-600'
                  }`}
                >
                  {caption.length}/{INSTAGRAM_CAPTION_LIMIT} caracteres para
                  Instagram
                </p>
              )}
            </div>

            {hasTikTokSelected && (
              <section className="space-y-4 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.025] p-4">
                <div>
                  <h3 className="text-sm font-medium text-cyan-100">
                    Configurações do TikTok
                  </h3>
                  {!tiktokCreatorInfo && !tiktokCreatorInfoError ? (
                    <p className="mt-1 text-xs text-slate-400">
                      Consultando as opções atuais da sua conta...
                    </p>
                  ) : tiktokCreatorInfoError ? (
                    <p role="alert" className="mt-1 text-xs text-rose-200">
                      {tiktokCreatorInfoError}
                    </p>
                  ) : tiktokCreatorInfo ? (
                    <p className="mt-1 text-xs text-slate-400">
                      Publicando como{' '}
                      <span className="font-medium text-slate-200">
                        {tiktokCreatorInfo.creatorNickname}
                      </span>
                      {' · '}limite de vídeo:{' '}
                      {tiktokCreatorInfo.maxVideoPostDurationSeconds}s
                    </p>
                  ) : null}
                </div>

                {!tiktokPublicPostingAllowed && (
                  <p className="rounded-lg border border-amber-300/15 bg-amber-300/[0.05] p-3 text-xs leading-5 text-amber-100/80">
                    Este app ainda não foi auditado pelo TikTok. A API restringe
                    publicações a “Somente você”; as demais opções aparecem
                    desabilitadas.
                  </p>
                )}

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label
                      htmlFor="tiktok-title"
                      className="text-xs font-medium text-slate-200"
                    >
                      Título/legenda do TikTok
                    </label>
                    <span className="text-[10px] text-slate-500">
                      {tiktokTitle.length}/2.200
                    </span>
                  </div>
                  <textarea
                    id="tiktok-title"
                    value={tiktokTitle}
                    maxLength={2200}
                    onChange={(event) => setTikTokTitle(event.target.value)}
                    placeholder="Opcional; se vazio, será usada a legenda acima."
                    rows={2}
                    className="w-full resize-y rounded-lg border border-white/[0.09] bg-[#0c1018] px-3 py-2.5 text-sm leading-5 text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
                  />
                </div>

                <div>
                  <label
                    htmlFor="tiktok-privacy"
                    className="mb-1.5 block text-xs font-medium text-slate-200"
                  >
                    Quem pode assistir? <span className="text-rose-300">*</span>
                  </label>
                  <select
                    id="tiktok-privacy"
                    value={tiktokPrivacyLevel}
                    onChange={(event) =>
                      setTikTokPrivacyLevel(
                        event.target.value as TikTokPrivacyLevel | '',
                      )
                    }
                    disabled={!tiktokCreatorInfo}
                    className="h-10 w-full rounded-lg border border-white/10 bg-[#171c28] px-3 text-sm text-slate-200 outline-none focus:border-cyan-300/40 disabled:opacity-50"
                  >
                    <option value="">Escolha uma opção...</option>
                    {tiktokCreatorInfo?.privacyLevelOptions
                      .filter(
                        (value): value is TikTokPrivacyLevel =>
                          Object.prototype.hasOwnProperty.call(
                            TIKTOK_PRIVACY_LABELS,
                            value,
                          ),
                      )
                      .map((value) => (
                        <option
                          key={value}
                          value={value}
                          disabled={
                            (!tiktokPublicPostingAllowed && value !== 'SELF_ONLY') ||
                            (tiktokBrandContent && value === 'SELF_ONLY')
                          }
                        >
                          {TIKTOK_PRIVACY_LABELS[value]}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-2.5">
                  <p className="text-xs font-medium text-slate-200">
                    Permitir interações
                  </p>
                  {[
                    {
                      id: 'tiktok-comments',
                      label: 'Comentários',
                      checked: tiktokAllowComments,
                      setChecked: setTikTokAllowComments,
                      disabled: tiktokCreatorInfo?.commentDisabled ?? true,
                    },
                    {
                      id: 'tiktok-duet',
                      label: 'Dueto',
                      checked: tiktokAllowDuet,
                      setChecked: setTikTokAllowDuet,
                      disabled: tiktokCreatorInfo?.duetDisabled ?? true,
                    },
                    {
                      id: 'tiktok-stitch',
                      label: 'Costurar (Stitch)',
                      checked: tiktokAllowStitch,
                      setChecked: setTikTokAllowStitch,
                      disabled: tiktokCreatorInfo?.stitchDisabled ?? true,
                    },
                  ].map((item) => (
                    <label
                      key={item.id}
                      htmlFor={item.id}
                      className="flex items-center gap-2 text-xs text-slate-300"
                    >
                      <input
                        id={item.id}
                        type="checkbox"
                        checked={item.checked}
                        disabled={!tiktokCreatorInfo || item.disabled}
                        onChange={(event) =>
                          item.setChecked(event.target.checked)
                        }
                        className="accent-cyan-300"
                      />
                      {item.label}
                      {item.disabled && tiktokCreatorInfo && (
                        <span className="text-[10px] text-slate-500">
                          indisponível nesta conta
                        </span>
                      )}
                    </label>
                  ))}
                </div>

                <div className="space-y-2.5 border-t border-white/[0.07] pt-3">
                  <label
                    htmlFor="tiktok-commercial-content"
                    className="flex items-start gap-2 text-xs leading-5 text-slate-300"
                  >
                    <input
                      id="tiktok-commercial-content"
                      type="checkbox"
                      checked={tiktokCommercialContent}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setTikTokCommercialContent(checked);
                        if (!checked) {
                          setTikTokBrandOrganic(false);
                          setTikTokBrandContent(false);
                        }
                      }}
                      className="mt-1 accent-cyan-300"
                    />
                    Este conteúdo promove uma marca, produto ou serviço.
                  </label>
                  {tiktokCommercialContent && (
                    <div className="ml-6 space-y-2">
                      <label
                        htmlFor="tiktok-brand-organic"
                        className="flex items-center gap-2 text-xs text-slate-300"
                      >
                        <input
                          id="tiktok-brand-organic"
                          type="checkbox"
                          checked={tiktokBrandOrganic}
                          onChange={(event) =>
                            setTikTokBrandOrganic(event.target.checked)
                          }
                          className="accent-cyan-300"
                        />
                        Minha própria marca (conteúdo orgânico)
                      </label>
                      <label
                        htmlFor="tiktok-brand-content"
                        className="flex items-center gap-2 text-xs text-slate-300"
                      >
                        <input
                          id="tiktok-brand-content"
                          type="checkbox"
                          disabled={tiktokPrivacyLevel === 'SELF_ONLY'}
                          checked={tiktokBrandContent}
                          onChange={(event) =>
                            setTikTokBrandContent(event.target.checked)
                          }
                          className="accent-cyan-300"
                        />
                        Marca de terceiros (conteúdo patrocinado)
                      </label>
                      {tiktokPrivacyLevel === 'SELF_ONLY' && <p className="text-xs text-amber-200">Conteúdo patrocinado não pode ter visibilidade “Somente você”.</p>}
                      {(tiktokBrandOrganic || tiktokBrandContent) && <p className="text-xs text-cyan-100">O vídeo será identificado como {tiktokBrandContent ? '“Parceria paga”' : '“Conteúdo promocional”'} no TikTok.</p>}
                      {tiktokDisclosureMissing && <p role="status" className="text-xs text-amber-200">Indique se o conteúdo promove sua marca, terceiros ou ambos para poder agendar.</p>}
                    </div>
                  )}
                </div>

                <label
                  htmlFor="tiktok-consent"
                  className="flex items-start gap-2 border-t border-white/[0.07] pt-3 text-xs leading-5 text-slate-300"
                >
                  <input
                    id="tiktok-consent"
                    type="checkbox"
                    checked={tiktokConsent}
                    onChange={(event) => setTikTokConsent(event.target.checked ? tiktokConsentKey : false)}
                    className="mt-1 accent-cyan-300"
                  />
                  <span>Confirmo que tenho autorização para enviar este vídeo, que
                  possuo os direitos necessários sobre o conteúdo e a música e
                  que as informações comerciais acima são corretas. O TikTok
                  pode publicar o vídeo em meu nome. Ao publicar, concordo com a <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noopener noreferrer" className="underline">Confirmação de Uso de Música do TikTok</a>{tiktokBrandContent && <> e com a <a href="https://www.tiktok.com/legal/page/global/bc-policy/en" target="_blank" rel="noopener noreferrer" className="underline">Política de Conteúdo de Marca do TikTok</a></>}.</span>
                </label>
              </section>
            )}

            <div>
              <div className="mb-2.5 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-200">
                  Mídia
                </label>
                <span className="text-[11px] text-slate-500">
                  Até 10 arquivos · 95 MB por envio
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
                className="hidden"
                onChange={(event) => void handleFileChange(event.target.files)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (!isUploading && !lockedPost && !isBusy) {
                    void handleFileChange(event.dataTransfer.files);
                  }
                }}
                disabled={
                  isUploading ||
                  lockedPost ||
                  isBusy ||
                  mediaUrls.length >= MAX_FILES
                }
                className="flex min-h-[100px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.015] text-center transition hover:border-indigo-400/40 hover:bg-indigo-400/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUploading ? (
                  <LoaderCircle
                    size={21}
                    className="animate-spin text-indigo-300"
                  />
                ) : (
                  <ImagePlus size={21} className="text-slate-400" />
                )}
                <span className="text-xs text-slate-400">
                  {isUploading
                    ? 'Enviando arquivos...'
                    : mediaUrls.length >= MAX_FILES
                      ? 'Limite de 10 arquivos atingido'
                      : 'Arraste arquivos aqui ou clique para selecionar'}
                </span>
                <span className="text-[10px] text-slate-600">
                  JPG, PNG, WEBP, GIF, MP4, MOV ou WEBM
                </span>
              </button>

              {mediaUrls.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {mediaUrls.map((url, index) => {
                    const isVideo = isVideoMediaUrl(url);
                    return (
                      <div
                        key={`${url}-${index}`}
                        className="group relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-[#0b0e14]"
                      >
                        {isVideo ? (
                          <video
                            src={url}
                            aria-label="Prévia do vídeo anexado"
                            className="h-full w-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                          />
                        ) : (
                          <Image
                            src={url}
                            alt="Prévia da imagem anexada"
                            fill
                            sizes="(max-width: 640px) 30vw, 120px"
                            unoptimized
                            className="object-cover"
                          />
                        )}
                        {isVideo && (
                          <span className="absolute bottom-1 left-1 rounded bg-black/70 p-1 text-white">
                            <Film size={12} />
                          </span>
                        )}
                        {!lockedPost && (
                          <button
                            type="button"
                            onClick={() =>
                              {
                                setVideoDurationSeconds(null);
                                setMediaUrls((current) =>
                                  current.filter((_, i) => i !== index),
                                );
                              }
                            }
                            aria-label="Remover mídia"
                            className="absolute right-1 top-1 rounded-md bg-black/70 p-1.5 text-white opacity-100 transition hover:bg-rose-500 sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 rounded-xl border border-white/[0.07] bg-[#0c1018] p-3 sm:p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-slate-200">
                      Prévia do conteúdo
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      Representação aproximada; a exibição final depende da
                      plataforma.
                    </p>
                  </div>
                  <label className="sr-only" htmlFor="preview-platform">
                    Plataforma da prévia
                  </label>
                  <select
                    id="preview-platform"
                    value={previewPlatform}
                    onChange={(event) =>
                      setPreviewPlatform(event.target.value as SocialPlatform)
                    }
                    className="h-8 rounded-lg border border-white/10 bg-[#171c28] px-2.5 text-[11px] text-slate-300 outline-none focus:border-indigo-400/50"
                  >
                    {platforms.map((platform) => (
                      <option key={platform.id} value={platform.id}>
                        {platform.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mx-auto max-w-sm overflow-hidden rounded-xl border border-slate-200/10 bg-white text-slate-900">
                  <div className="flex items-center gap-2.5 px-3 py-2.5">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full border ${previewPlatformDetails.activeClass}`}
                    >
                      <previewPlatformDetails.Icon size={15} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">
                        {previewPlatformDetails.label}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Prévia do post
                      </p>
                    </div>
                  </div>
                  {previewMediaUrls.length > 0 ? (
                    <div
                      className={`grid overflow-hidden bg-slate-100 ${
                        previewMediaUrls.length === 1
                          ? 'aspect-[4/5]'
                          : 'aspect-square grid-cols-2'
                      }`}
                    >
                      {previewMediaUrls.slice(0, 4).map((url, index) => {
                        const isVideo = isVideoMediaUrl(url);
                        return (
                          <div
                            key={`${url}-${index}`}
                            className={`relative min-h-0 min-w-0 overflow-hidden ${
                              previewMediaUrls.length === 1 ? '' : 'aspect-square'
                            }`}
                          >
                            {isVideo ? (
                              <video
                                src={url}
                                aria-label={`Prévia do vídeo ${index + 1}`}
                                className="h-full w-full object-cover"
                                muted
                                playsInline
                              />
                            ) : (
                              <Image
                                src={url}
                                alt={`Prévia da imagem ${index + 1}`}
                                fill
                                sizes="(max-width: 640px) 80vw, 320px"
                                unoptimized
                                className="object-cover"
                              />
                            )}
                            {index === 3 && previewMediaUrls.length > 4 && (
                              <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-lg font-semibold text-white">
                                +{previewMediaUrls.length - 4}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex aspect-[4/5] items-center justify-center bg-slate-100 px-8 text-center text-xs text-slate-500">
                      A mídia do post aparecerá aqui
                    </div>
                  )}
                  <div className="space-y-1.5 px-3 py-3">
                    <p className="whitespace-pre-wrap break-words text-xs leading-5">
                      {destinations.find(d => d.platform === previewPlatform)?.format === 'story' ? 'Story: texto incorporado na mídia' : previewPlatform === 'youtube' && destinations.find(d => d.platform === 'youtube')?.youtube ? `${destinations.find(d => d.platform === 'youtube')!.youtube!.title}\n${destinations.find(d => d.platform === 'youtube')!.youtube!.description}` : destinations.find(d => d.platform === previewPlatform)?.caption || caption || 'A legenda aparecerá aqui'}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {previewMediaUrls.length}{' '}
                      {previewMediaUrls.length === 1 ? 'mídia' : 'mídias'}
                      {scheduledDate &&
                        time &&
                        ` · ${previewDateTime.date} às ${previewDateTime.time}`}
                    </p>
                  </div>
                </div>

                {(previewPlatform === 'instagram' ||
                  selectedPlatforms.includes('instagram')) &&
                  instagramPublishingIssue && (
                    <p className="mt-3 rounded-lg border border-amber-300/15 bg-amber-300/[0.04] p-2.5 text-[11px] leading-5 text-amber-100/80">
                      {instagramPublishingIssue}
                    </p>
                  )}
                {previewPlatform !== 'instagram' && (
                  <p className="mt-3 rounded-lg border border-indigo-300/15 bg-indigo-300/[0.04] p-2.5 text-[11px] leading-5 text-indigo-100/75">
                    Prévia para planejamento. O envio depende da conexão da conta e das permissões da rede. O processamento pode levar alguns minutos.
                  </p>
                )}
              </div>
            </div>

            <div>
              <div className="mb-2.5 flex items-center gap-2">
                <Clock3 size={15} className="text-slate-500" />
                <p className="text-sm font-medium text-slate-200">
                  Data e horário
                </p>
              </div>
              <label className="mb-3 block space-y-1.5">
                <span className="text-[11px] text-slate-500">Fuso horário</span>
                <select
                  value={timeZone}
                  onChange={(event) => setTimeZone(event.target.value)}
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0c1018] px-3 py-2.5 text-sm text-slate-200 outline-none transition focus:border-indigo-400/50"
                >
                  {timeZoneOptions.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5">
                  <span className="text-[11px] text-slate-500">Data</span>
                  <input
                    type="date"
                    value={scheduledDate}
                    min={minDateValue}
                    onChange={(event) => setScheduledDate(event.target.value)}
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0c1018] px-3 py-2.5 text-sm text-slate-200 outline-none transition focus:border-indigo-400/50"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[11px] text-slate-500">Horário</span>
                  <input
                    type="time"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0c1018] px-3 py-2.5 text-sm text-slate-200 outline-none transition focus:border-indigo-400/50"
                  />
                </label>
              </div>
              <p className="mt-2 text-[10px] text-slate-600">
                Data e horário serão interpretados no fuso {timeZone}. Se o
                horário não existir por mudança de horário de verão, escolha
                outro horário. Em horários repetidos, será usada a primeira
                ocorrência.
              </p>
            </div>
          </fieldset>

          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-3 text-xs leading-5 text-rose-200"
            >
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              {errorMessage}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center sm:justify-between">
            {selectedPost ? (
              <div className="flex flex-wrap gap-1">
                {canRetryPost(selectedPost) && (
                  <button
                    type="button"
                    onClick={() => void handleRetry()}
                    disabled={isBusy || isUploading}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-medium text-indigo-200 transition hover:bg-indigo-400/[0.08] disabled:opacity-50"
                  >
                    {pendingAction === 'retry' ? (
                      <LoaderCircle size={15} className="animate-spin" />
                    ) : (
                      <RotateCcw size={14} />
                    )}
                    Tentar novamente
                  </button>
                )}
                {!lockedPost && (
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={isBusy || isUploading}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-medium text-rose-300 transition hover:bg-rose-400/[0.08] disabled:opacity-50"
                  >
                    {pendingAction === 'delete' ? (
                      <LoaderCircle size={15} className="animate-spin" />
                    ) : (
                      <Trash2 size={15} />
                    )}
                    {selectedPost.status === 'draft'
                      ? 'Excluir rascunho'
                      : 'Excluir agendamento'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleDuplicate()}
                  disabled={isBusy || isUploading}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-medium text-slate-300 transition hover:bg-white/[0.05] disabled:opacity-50"
                >
                  {pendingAction === 'duplicate' ? (
                    <LoaderCircle size={15} className="animate-spin" />
                  ) : (
                    <Copy size={14} />
                  )}
                  Duplicar como rascunho
                </button>
              </div>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={isBusy || isUploading}
                className="h-10 rounded-lg border border-white/10 px-4 text-xs font-medium text-slate-300 transition hover:bg-white/[0.04] disabled:opacity-50"
              >
                Fechar
              </button>
              {!lockedPost && (
                <>
                  <button type="button" disabled={isBusy || isUploading || tiktokDisclosureMissing} onClick={() => void handleSave(false, true)} className="rounded-lg border border-indigo-400/30 px-3 py-2 text-sm text-indigo-200">Publicar agora</button>
                  <button
                    type="button"
                    onClick={() => void handleSave(true)}
                    disabled={isBusy || isUploading}
                    className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-white/10 px-3 text-xs font-medium text-slate-300 transition hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pendingAction === 'draft' ? (
                      <LoaderCircle size={15} className="animate-spin" />
                    ) : (
                      <FileText size={14} />
                    )}
                    Salvar rascunho
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave(false)}
                    disabled={isBusy || isUploading || tiktokDisclosureMissing}
                    className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-indigo-500 px-4 text-xs font-semibold text-white shadow-lg shadow-indigo-950/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pendingAction === 'schedule' ? (
                      <LoaderCircle size={15} className="animate-spin" />
                    ) : (
                      <Check size={15} />
                    )}
                    {pendingAction === 'schedule'
                      ? 'Salvando...'
                      : selectedPost && selectedPost.status !== 'draft'
                        ? 'Salvar alterações'
                        : 'Agendar post'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </dialog>
  );
}
