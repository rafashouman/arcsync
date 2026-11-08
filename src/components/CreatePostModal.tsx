'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Bookmark,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Film,
  FileText,
  Hash,
  Heart,
  ImagePlus,
  Info,
  LoaderCircle,
  MessageCircle,
  Plus,
  RotateCcw,
  Send,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import { historyEventLabel } from '@/src/libs/postHistory';
import { listPostAccounts } from '@/src/app/actions/destinationActions';
import { POST_FORMATS } from '@/src/libs/postFormats';
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
  PostDestination,
  PostRecord,
  SocialPlatform,
  TikTokPrivacyLevel,
} from '@/src/types/post';

const platforms: {
  id: SocialPlatform;
  label: string;
  Icon: typeof InstagramIcon;
  activeClass: string;
  badgeClass: string;
}[] = [
  {
    id: 'instagram',
    label: 'Instagram',
    Icon: InstagramIcon,
    activeClass: 'border-pink-400/50 bg-pink-500/15 text-pink-200 shadow-sm shadow-pink-500/10',
    badgeClass: 'bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 text-white',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    Icon: FacebookIcon,
    activeClass: 'border-blue-400/50 bg-blue-500/15 text-blue-200 shadow-sm shadow-blue-500/10',
    badgeClass: 'bg-blue-600 text-white',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    Icon: TikTokIcon,
    activeClass: 'border-cyan-300/50 bg-cyan-400/15 text-cyan-100 shadow-sm shadow-cyan-400/10',
    badgeClass: 'bg-slate-900 border border-cyan-400/40 text-cyan-200',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    Icon: YoutubeIcon,
    activeClass: 'border-red-400/50 bg-red-500/15 text-red-200 shadow-sm shadow-red-500/10',
    badgeClass: 'bg-red-600 text-white',
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
  SELF_ONLY: 'Somente você (Privado)',
};
const COMMON_TIME_ZONES = [
  'America/Sao_Paulo',
  'America/Manaus',
  'UTC',
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
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
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
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
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
  const [destinations, setDestinations] = useState<PostDestination[]>(
    () => selectedPost?.destinations ?? [],
  );

  // Whether the user wants custom per-network dates instead of the unified default date
  const [useCustomSchedulePerNetwork, setUseCustomSchedulePerNetwork] =
    useState<boolean>(() => {
      const dests = selectedPost?.destinations ?? [];
      if (dests.length <= 1) return false;
      const times = dests.map((d) => d.scheduledFor).filter(Boolean);
      return new Set(times).size > 1;
    });

  // Active tab in "Legenda": 'all' or a specific platform
  const [activeCaptionTab, setActiveCaptionTab] = useState<
    'all' | SocialPlatform
  >('all');

  // Toggle for advanced settings drawer/section in column 3
  const profileCount = destinations.filter(d => selectedPlatforms.includes(d.platform) && d.accountId).length;
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(true);
  const [mobilePreview, setMobilePreview] = useState(false);

  // Confirmation dialogs (mLabs-style schedule confirmation & unsaved changes guard)
  const [confirmScheduleModal, setConfirmScheduleModal] = useState<
    null | { publishNow: boolean }
  >(null);
  const [confirmDiscardModal, setConfirmDiscardModal] = useState(false);

  // Preview state
  const [previewPlatform, setPreviewPlatform] = useState<SocialPlatform>(
    () => selectedPost?.platforms?.[0] ?? 'instagram',
  );
  const [previewMediaIndex, setPreviewMediaIndex] = useState(0);

  const [accounts, setAccounts] = useState<
    Awaited<ReturnType<typeof listPostAccounts>>['accounts']
  >([]);
  const [accountNotice, setAccountNotice] = useState('Carregando contas...');

  useEffect(() => {
    let active = true;
    void listPostAccounts()
      .then((result) => {
        if (!active) return;
        setAccounts(result.accounts);
        setAccountNotice(
          result.error ||
            (result.accounts.length
              ? ''
              : 'Nenhuma conta conectada. Você pode salvar como rascunho ou conectar contas em Contas Sociais.'),
        );
        // Auto-assign default connected account for any destination that does not have an accountId yet
        if (result.accounts.length > 0) {
          setDestinations((current) => {
            const next = [...current];
            for (const p of ['instagram', 'facebook', 'tiktok', 'youtube'] as const) {
              const firstAccount = result.accounts.find((a) => a.platform === p);
              if (!firstAccount) continue;
              const existingIdx = next.findIndex((d) => d.platform === p);
              if (existingIdx === -1) {
                next.push({
                  platform: p,
                  accountId: firstAccount.id,
                  format: p === 'instagram' || p === 'facebook' ? 'feed' : 'video',
                });
              } else if (!next[existingIdx].accountId) {
                next[existingIdx] = {
                  ...next[existingIdx],
                  accountId: firstAccount.id,
                };
              }
            }
            return next;
          });
        }
      })
      .catch(() => {
        if (active) setAccountNotice('Não foi possível carregar as contas.');
      });
    return () => {
      active = false;
    };
  }, []);

  function updateDestination(
    platform: SocialPlatform,
    patch: Partial<PostDestination>,
  ) {
    if (platform === 'tiktok') {
      if ('mediaUrls' in patch) setVideoDurationSeconds(null);
      if ('accountId' in patch) {
        setTikTokCreatorInfo(null);
        setTikTokPrivacyLevel('');
      }
    }
    setDestinations((current) => {
      const existing = current.find((d) => d.platform === platform);
      const defaultAccountId =
        existing?.accountId ||
        accounts.find((a) => a.platform === platform)?.id ||
        '';
      const defaultFormat =
        platform === 'instagram' || platform === 'facebook' ? 'feed' : 'video';
      return [
        ...current.filter((d) => d.platform !== platform),
        {
          platform,
          accountId: defaultAccountId,
          format: defaultFormat,
          ...existing,
          ...patch,
        },
      ];
    });
  }

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
  const [tiktokTitle, setTikTokTitle] = useState(
    selectedPost?.tiktokTitle ?? '',
  );
  const [tiktokPrivacyLevel, setTikTokPrivacyLevel] = useState<
    TikTokPrivacyLevel | ''
  >(selectedPost?.tiktokPrivacyLevel ?? '');
  const [tiktokAllowComments, setTikTokAllowComments] = useState(
    selectedPost?.tiktokAllowComments ?? true,
  );
  const [tiktokAllowDuet, setTikTokAllowDuet] = useState(
    selectedPost?.tiktokAllowDuet ?? true,
  );
  const [tiktokAllowStitch, setTikTokAllowStitch] = useState(
    selectedPost?.tiktokAllowStitch ?? true,
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
  const [tiktokConsent, setTikTokConsent] = useState<boolean>(
    Boolean(selectedPost?.tiktokConsentAt),
  );
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
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<
    number | null
  >(null);
  const [mediaUrls, setMediaUrls] = useState<string[]>(
    () => selectedPost?.mediaUrls ?? [],
  );
  const [isUploading, setIsUploading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasTikTokSelected = selectedPlatforms.includes('tiktok');
  const tiktokDisclosureMissing =
    hasTikTokSelected &&
    tiktokCommercialContent &&
    !tiktokBrandOrganic &&
    !tiktokBrandContent;

  const tiktokAccountId =
    destinations.find((d) => d.platform === 'tiktok')?.accountId ||
    accounts.find((a) => a.platform === 'tiktok')?.id;
  const tiktokMediaUrl = (destinations.find((d) => d.platform === 'tiktok')
    ?.mediaUrls ?? mediaUrls)[0];

  useEffect(() => {
    if (!hasTikTokSelected || !tiktokMediaUrl) return;
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () =>
      setVideoDurationSeconds(
        Number.isFinite(video.duration) ? video.duration : null,
      );
    video.onerror = () => setVideoDurationSeconds(null);
    video.src = tiktokMediaUrl;
    return () => {
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute('src');
      video.load();
    };
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
        setTikTokAllowDuet((value) =>
          creatorInfo.duetDisabled ? false : value,
        );
        setTikTokAllowStitch((value) =>
          creatorInfo.stitchDisabled ? false : value,
        );
        setTikTokPrivacyLevel((current) => {
          if (
            current &&
            creatorInfo.privacyLevelOptions.includes(current) &&
            (result.publicPostingAllowed || current === 'SELF_ONLY')
          ) {
            return current;
          }
          // Auto-select default valid privacy level so the user isn't blocked unnecessarily
          if (!result.publicPostingAllowed && creatorInfo.privacyLevelOptions.includes('SELF_ONLY')) {
            return 'SELF_ONLY';
          }
          const firstValid = creatorInfo.privacyLevelOptions.find((opt) =>
            Object.prototype.hasOwnProperty.call(TIKTOK_PRIVACY_LABELS, opt),
          ) as TikTokPrivacyLevel | undefined;
          return firstValid ?? '';
        });
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

  // Detect if user has unsaved work to protect against accidental close
  const hasUnsavedChanges = useMemo(() => {
    if (lockedPost) return false;
    if (!selectedPost) {
      return (
        caption.trim().length > 0 ||
        mediaUrls.length > 0 ||
        selectedPlatforms.length > 0
      );
    }
    return (
      caption !== (selectedPost.caption ?? '') ||
      mediaUrls.length !== (selectedPost.mediaUrls?.length ?? 0) ||
      selectedPlatforms.join(',') !== (selectedPost.platforms ?? []).join(',')
    );
  }, [lockedPost, selectedPost, caption, mediaUrls, selectedPlatforms]);

  const handleRequestClose = () => {
    if (isBusy || isUploading) return;
    if (hasUnsavedChanges) {
      setConfirmDiscardModal(true);
      return;
    }
    closeModal();
  };

  const timeZoneOptions = [...new Set([timeZone, ...COMMON_TIME_ZONES])];
  const previewDest = destinations.find((d) => d.platform === previewPlatform);
  const previewDestinationTime = useCustomSchedulePerNetwork
    ? previewDest?.scheduledFor
    : undefined;
  const previewDateTime = previewDestinationTime
    ? getDateTimeInputValues(previewDestinationTime, timeZone)
    : { date: scheduledDate, time };
  const previewMediaUrls = previewDest?.mediaUrls ?? mediaUrls;
  const previewPlatformDetails =
    platforms.find((platform) => platform.id === previewPlatform) ??
    platforms[0];
  const previewAccountName =
    accounts.find((a) => a.id === previewDest?.accountId)?.name ||
    accounts.find((a) => a.platform === previewPlatform)?.name ||
    previewPlatformDetails.label;

  const instagramPublishingIssue = getInstagramPublishingIssue(
    destinations.find((d) => d.platform === 'instagram')?.caption || caption,
    destinations.find((d) => d.platform === 'instagram')?.mediaUrls ??
      mediaUrls,
  );
  const minDateValue = getDateTimeInputValues(
    new Date().toISOString(),
    timeZone,
  ).date;

  const imageCount = mediaUrls.filter((u) => !isVideoMediaUrl(u)).length;
  const videoCount = mediaUrls.filter((u) => isVideoMediaUrl(u)).length;

  const currentTabText =
    activeCaptionTab === 'all'
      ? caption
      : activeCaptionTab === 'tiktok'
        ? tiktokTitle
        : (destinations.find((d) => d.platform === activeCaptionTab)?.caption ??
          '');

  const hashtagCount = (
    (currentTabText || caption).match(/#[\p{L}\p{N}_]+/gu) ?? []
  ).length;

  const togglePlatform = (platform: SocialPlatform) => {
    setSelectedPlatforms((current) => {
      const isSelected = current.includes(platform);
      const next = isSelected
        ? current.filter((value) => value !== platform)
        : [...current, platform];

      if (!isSelected) {
        setPreviewPlatform(platform);
        const firstAcc = accounts.find((a) => a.platform === platform);
        const allVideos =
          mediaUrls.length === 1 && isVideoMediaUrl(mediaUrls[0]);
        const defaultFormat =
          platform === 'instagram'
            ? mediaUrls.length > 1
              ? 'carousel'
              : allVideos
                ? 'reel'
                : 'feed'
            : platform === 'facebook'
              ? 'feed'
              : 'video';
        setDestinations((dests) => {
          const existing = dests.find((d) => d.platform === platform);
          if (existing && existing.accountId) return dests;
          return [
            ...dests.filter((d) => d.platform !== platform),
            {
              platform,
              accountId: existing?.accountId || firstAcc?.id || '',
              format: existing?.format || defaultFormat,
              ...existing,
            },
          ];
        });
      } else {
        if (previewPlatform === platform && next.length > 0) {
          setPreviewPlatform(next[0]);
        }
        if (activeCaptionTab === platform) {
          setActiveCaptionTab('all');
        }
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
          const nextUrls = [...new Set(combined)].slice(0, MAX_FILES);
          // Smart format adjustment for Instagram based on uploaded media
          setDestinations((dests) =>
            dests.map((d) => {
              if (d.platform !== 'instagram' || d.mediaUrls?.length) return d;
              if (nextUrls.length > 1 && d.format !== 'carousel') {
                return { ...d, format: 'carousel' };
              }
              if (
                nextUrls.length === 1 &&
                isVideoMediaUrl(nextUrls[0]) &&
                d.format === 'feed'
              ) {
                return { ...d, format: 'reel' };
              }
              return d;
            }),
          );
          return nextUrls;
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

  const validateBeforeSchedule = (asDraft: boolean, publishNow = false) => {
    if (!asDraft && selectedPlatforms.length === 0) {
      setErrorMessage('Selecione ao menos um canal (rede social) para agendar.');
      return false;
    }

    if (
      !asDraft &&
      selectedPlatforms.includes('instagram') &&
      instagramPublishingIssue
    ) {
      setErrorMessage(instagramPublishingIssue);
      return false;
    }

    if (!asDraft && hasTikTokSelected) {
      if (!tiktokCreatorInfo) {
        setErrorMessage(
          tiktokCreatorInfoError ||
            'Aguarde a consulta das opções da sua conta TikTok antes de agendar.',
        );
        setShowAdvancedSettings(true);
        return false;
      }
      if (
        videoDurationSeconds === null ||
        videoDurationSeconds > tiktokCreatorInfo.maxVideoPostDurationSeconds
      ) {
        setErrorMessage(
          videoDurationSeconds === null
            ? 'Anexe um vídeo válido e aguarde carregar a duração para o TikTok.'
            : `O vídeo excede o limite de ${tiktokCreatorInfo.maxVideoPostDurationSeconds} segundos da sua conta TikTok.`,
        );
        return false;
      }
      if (!tiktokPrivacyLevel) {
        setErrorMessage(
          'Selecione quem pode assistir ao vídeo nas Configurações Avançadas do TikTok.',
        );
        setShowAdvancedSettings(true);
        return false;
      }
      if (!tiktokConsent) {
        setErrorMessage(
          'Marque a confirmação de direitos de uso do TikTok na coluna direita (Configurações avançadas) antes de agendar.',
        );
        setShowAdvancedSettings(true);
        return false;
      }
    }

    if (!asDraft && !publishNow) {
      const unifiedIso = zonedDateTimeToIso(scheduledDate, time, timeZone);
      if (!unifiedIso) {
        setErrorMessage(
          'Esse horário não existe no fuso selecionado. Escolha outro horário.',
        );
        return false;
      }
      if (new Date(unifiedIso).getTime() <= Date.now()) {
        setErrorMessage('Escolha uma data e horário no futuro.');
        return false;
      }
    }

    return true;
  };

  const executeSave = async (asDraft: boolean, publishNow = false) => {
    setConfirmScheduleModal(null);
    if (!validateBeforeSchedule(asDraft, publishNow)) return;

    const scheduledFor = asDraft
      ? null
      : publishNow
        ? new Date(Date.now() + 5_000).toISOString()
        : zonedDateTimeToIso(scheduledDate, time, timeZone);

    setPendingAction(asDraft ? 'draft' : 'schedule');
    setErrorMessage('');
    try {
      const normalizedDestinations = selectedPlatforms.map((platform) => {
        const existing = destinations.find((d) => d.platform === platform);
        const fallbackAccountId =
          existing?.accountId ||
          accounts.find((a) => a.platform === platform)?.id ||
          '';
        const defaultFormat =
          platform === 'instagram' || platform === 'facebook'
            ? 'feed'
            : 'video';
        return {
          platform,
          accountId: fallbackAccountId,
          format: existing?.format ?? defaultFormat,
          ...existing,
          // Default behavior: ALL networks share the exact same date/time unless custom per-network schedule is enabled
          scheduledFor:
            useCustomSchedulePerNetwork && !publishNow && !asDraft
              ? existing?.scheduledFor || undefined
              : undefined,
        };
      });

      const input = {
        caption,
        platforms: selectedPlatforms,
        destinations: normalizedDestinations,
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
        ? await updateScheduledPost(
            selectedPost._id,
            input,
            asDraft,
            publishNow,
          )
        : await createScheduledPost(input, asDraft, publishNow);

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

  const cyclePreviewPlatform = (direction: -1 | 1) => {
    const pool = selectedPlatforms.length > 0 ? selectedPlatforms : platforms.map((p) => p.id);
    const idx = pool.indexOf(previewPlatform);
    const nextIdx = (idx + direction + pool.length) % pool.length;
    setPreviewPlatform(pool[nextIdx]);
    setPreviewMediaIndex(0);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="post-modal-title"
      aria-modal="true"
      onCancel={(event) => {
        // Prevent Esc from closing immediately and losing user data
        event.preventDefault();
        handleRequestClose();
      }}
      className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-center justify-center bg-[#05070c]/85 p-2 text-slate-200 backdrop-blur-md sm:p-4"
    >
      <section className="relative flex h-[95dvh] w-[98vw] max-w-[1400px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#11151f] shadow-2xl shadow-black/70">
        {/* Top Header */}
        <header className="flex shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#11151f] px-5 py-3.5 sm:px-7">
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline rounded-lg bg-indigo-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
              Estúdio de Publicação
            </span>
            <h2
              id="post-modal-title"
              className="text-base font-semibold text-white sm:text-lg"
            >
              {selectedPost ? 'Editar publicação' : 'Agendar publicação'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-slate-500 sm:inline">
              Proteção ativa: clicar fora não fecha a janela
            </span>
            <button
              type="button"
              onClick={handleRequestClose}
              disabled={isBusy || isUploading}
              aria-label="Fechar"
              className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Status Banners (if editing an existing post with errors/history) */}
        {(selectedPost?.errorLog ||
          lockedPost ||
          selectedPost?.platformStatuses?.length) && (
          <div className="shrink-0 space-y-2 border-b border-white/[0.07] bg-[#0c1018] px-5 py-3 sm:px-7">
            {selectedPost?.errorLog && (
              <div
                role="alert"
                className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-3 text-xs leading-5 text-rose-100"
              >
                {selectedPost.publishMayHaveSucceeded && (
                  <strong className="font-semibold">Resultado incerto: </strong>
                )}
                {selectedPost.errorLog}
              </div>
            )}
            {lockedPost && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-2.5 text-xs text-amber-100">
                <AlertCircle size={15} className="shrink-0 text-amber-200" />
                {selectedPost?.publishMayHaveSucceeded
                  ? 'Uma rede pode ter publicado este post. Ele está bloqueado para evitar duplicidade.'
                  : 'Publicações em andamento ou já publicadas não podem ser alteradas.'}
              </div>
            )}
            {selectedPost?.platformStatuses?.length ? (
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="font-semibold text-slate-300">
                  Status por canal:
                </span>
                {selectedPost.platformStatuses.map((result) => (
                  <span
                    key={result.platform}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#171c28] px-2.5 py-1"
                  >
                    <strong className="capitalize text-white">
                      {result.platform}:
                    </strong>{' '}
                    <span>
                      {result.mayHaveSucceeded
                        ? 'Incerto'
                        : {
                            published: 'Publicado',
                            failed: 'Falha',
                            uploading: 'Enviando',
                            processing: 'Processando',
                          }[result.state]}
                    </span>
                    {result.state === 'published' &&
                      result.platform === 'youtube' &&
                      result.externalId && (
                        <a
                          className="ml-1 text-indigo-300 underline"
                          target="_blank"
                          rel="noopener noreferrer"
                          href={`https://www.youtube.com/watch?v=${encodeURIComponent(result.externalId)}`}
                        >
                          Ver vídeo
                        </a>
                      )}
                  </span>
                ))}
                {selectedPost?.history?.length ? (
                  <details className="text-xs text-slate-400">
                    <summary className="cursor-pointer hover:text-slate-200">
                      Histórico ({selectedPost.history.length})
                    </summary>
                    <ol className="mt-1 space-y-0.5 rounded-lg border border-white/10 bg-[#11151f] p-2">
                      {selectedPost.history.map((h, i) => (
                        <li key={i} className="text-[11px]">
                          {h.at} — {historyEventLabel(h.event)}{' '}
                          {h.states
                            ?.map((s) => `${s.platform}: ${s.state}`)
                            .join(', ')}
                        </li>
                      ))}
                    </ol>
                  </details>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        {/* Main 3-Column mLabs-style Studio Workspace */}
        <fieldset
          disabled={lockedPost || isBusy || isUploading}
          className="custom-scrollbar flex-1 overflow-y-auto"
        >
          <div className="studio-layout">
            <section className="studio-targets">
              <h3>Onde publicar?</h3>
              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">
                    Redes sociais
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Clique para ativar/desativar
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {platforms.map(({ id, label, Icon, activeClass, badgeClass }) => {
                    const isSelected = selectedPlatforms.includes(id);
                    return (
                      <button
                        type="button"
                        key={id}
                        aria-pressed={isSelected}
                        onClick={() => togglePlatform(id)}
                        className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition ${
                          isSelected
                            ? activeClass
                            : 'border-white/[0.08] bg-[#0c1018] text-slate-400 hover:border-white/20 hover:text-slate-200'
                        }`}
                      >
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                            isSelected
                              ? badgeClass
                              : 'bg-white/[0.06] text-slate-400'
                          }`}
                        >
                          <Icon size={16} />
                        </span>
                        <span className="flex items-center gap-1">
                          {label}
                          {isSelected && <Check size={12} />}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Format selector row for selected platforms (e.g. Feed / Reels / Carrossel / Story) */}
                {selectedPlatforms.length > 0 && (
                  <div className="mt-3 space-y-2 rounded-xl border border-white/[0.07] bg-[#0c1018] p-3">
                    {selectedPlatforms.map((platform) => {
                      const meta = platforms.find((p) => p.id === platform)!;
                      const dest = destinations.find(
                        (d) => d.platform === platform,
                      );
                      const currentFormat =
                        dest?.format ??
                        (platform === 'instagram' || platform === 'facebook'
                          ? 'feed'
                          : 'video');
                      const formats = POST_FORMATS[platform];
                      return (
                        <div
                          key={platform}
                          className="flex flex-wrap items-center justify-between gap-2 text-xs"
                        >
                          <span className="font-medium text-slate-300">
                            Formato {meta.label}:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {formats.map((f) => (
                              <button
                                key={f.value}
                                type="button"
                                onClick={() =>
                                  updateDestination(platform, {
                                    format: f.value,
                                  })
                                }
                                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                                  currentFormat === f.value
                                    ? 'bg-indigo-500 text-white'
                                    : 'bg-[#171c28] text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                {f.value === 'feed'
                                  ? 'Feed'
                                  : f.value === 'reel'
                                    ? 'Reels'
                                    : f.value === 'carousel'
                                      ? 'Carrossel'
                                      : f.value === 'story'
                                        ? 'Story'
                                        : 'Vídeo'}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {destinations.find((d) => d.platform === 'instagram')
                      ?.format === 'story' && (
                      <p className="text-[11px] text-amber-200">
                        Story aceita 1 foto ou vídeo e não exibe legenda de
                        texto.
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">
                    Perfis de destino
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {accounts.length}{' '}
                    {accounts.length === 1 ? 'conta ativa' : 'contas ativas'}
                  </span>
                </div>

                {accountNotice ? (
                  <div
                    role="status"
                    className="rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-3 text-xs text-amber-200"
                  >
                    {accountNotice}
                  </div>
                ) : (
                  <div className="space-y-2 rounded-xl border border-white/[0.08] bg-[#0c1018] p-3">
                    {selectedPlatforms.length === 0 ? (
                      <p className="text-xs text-slate-400">
                        Selecione uma rede acima para escolher o perfil.
                      </p>
                    ) : (
                      selectedPlatforms.map((platform) => {
                        const meta = platforms.find((p) => p.id === platform)!;
                        const platformAccounts = accounts.filter(
                          (a) => a.platform === platform,
                        );
                        const currentDest = destinations.find(d => d.platform === platform);
                        const profileName = platformAccounts.find(a => a.id === currentDest?.accountId)?.name;
                        return (
                          <div
                            key={platform}
                            className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-[#141926] px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`flex h-6 w-6 items-center justify-center rounded-full ${meta.badgeClass}`}
                              >
                                {profileName ? <span aria-hidden="true" className="text-[10px] font-bold">{profileName.replace(/^@/, '').slice(0,2).toLocaleUpperCase('pt-BR')}</span> : <meta.Icon size={13}/>}
                              </span>
                              <span className="text-xs font-medium text-slate-200">
                                <meta.Icon size={12} className="inline"/> {meta.label}
                              </span>
                            </div>
                            <select
                              aria-label={`Conta ${platform}`}
                              value={currentDest?.accountId ?? ''}
                              onChange={(e) =>
                                updateDestination(platform, {
                                  accountId: e.target.value,
                                })
                              }
                              className="max-w-[190px] truncate rounded-md border border-white/10 bg-[#0c1018] px-2.5 py-1 text-xs text-slate-200 outline-none focus:border-indigo-400/50"
                            >
                              <option value="">Selecione uma conta</option>
                              {platformAccounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </section>
            <section className="studio-content">
              <h3>O que publicar?</h3>
              <div className="flex flex-1 flex-col">
                <div className="mb-2 flex items-center justify-between">
                  <label
                    htmlFor="post-caption"
                    className="text-xs font-semibold text-slate-200"
                  >
                    Legenda
                  </label>
                  {activeCaptionTab !== 'all' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (activeCaptionTab === 'tiktok') {
                          setTikTokTitle(caption);
                        } else {
                          updateDestination(activeCaptionTab, { caption });
                        }
                      }}
                      className="text-[11px] font-medium text-indigo-300 hover:text-indigo-200"
                    >
                      Copiar texto da aba &ldquo;Todos&rdquo;
                    </button>
                  )}
                </div>

                {/* Channel Tabs (Todos + selected channels) */}
                <div className="flex items-center gap-1 border-b border-white/[0.08] pb-2">
                  <button
                    type="button"
                    onClick={() => setActiveCaptionTab('all')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      activeCaptionTab === 'all'
                        ? 'border-b-2 border-amber-400 bg-white/[0.06] text-white'
                        : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                    }`}
                  >
                    Todos
                  </button>
                  {selectedPlatforms.map((platform) => {
                    const meta = platforms.find((p) => p.id === platform)!;
                    const hasCustom =
                      platform === 'tiktok'
                        ? Boolean(tiktokTitle.trim())
                        : Boolean(
                            destinations
                              .find((d) => d.platform === platform)
                              ?.caption?.trim(),
                          );
                    return (
                      <button
                        type="button"
                        key={platform}
                        onClick={() => {
                          setActiveCaptionTab(platform);
                          setPreviewPlatform(platform);
                        }}
                        title={`Personalizar texto para ${meta.label}`}
                        className={`relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                          activeCaptionTab === platform
                            ? 'border-b-2 border-amber-400 bg-white/[0.08] text-white'
                            : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full ${meta.badgeClass}`}
                        >
                          <meta.Icon size={11} />
                        </span>
                        {hasCustom && (
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-amber-400"
                            title="Texto personalizado ativo"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Editor Box */}
                <div className="mt-2 flex flex-1 flex-col overflow-hidden rounded-xl border border-white/[0.09] bg-[#0c1018] focus-within:border-indigo-400/50">
                  {activeCaptionTab === 'all' ? (
                    <textarea
                      id="post-caption"
                      value={caption}
                      maxLength={MAX_CAPTION_LENGTH}
                      onChange={(event) => setCaption(event.target.value)}
                      placeholder="Digite o texto principal do seu post (será usado em todas as redes selecionadas)..."
                      rows={9}
                      className="w-full flex-1 resize-none bg-transparent p-3.5 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600"
                    />
                  ) : activeCaptionTab === 'tiktok' ? (
                    <textarea
                      id="tiktok-title"
                      aria-label="Texto tiktok"
                      value={tiktokTitle}
                      maxLength={2200}
                      onChange={(event) => setTikTokTitle(event.target.value)}
                      placeholder={`Texto específico para o TikTok (em branco, usa o texto da aba "Todos")...`}
                      rows={9}
                      className="w-full flex-1 resize-none bg-transparent p-3.5 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600"
                    />
                  ) : (
                    <textarea
                      aria-label={`Texto ${activeCaptionTab}`}
                      value={
                        destinations.find(
                          (d) => d.platform === activeCaptionTab,
                        )?.caption ?? ''
                      }
                      maxLength={MAX_CAPTION_LENGTH}
                      onChange={(event) =>
                        updateDestination(activeCaptionTab, {
                          caption: event.target.value,
                        })
                      }
                      placeholder={`Texto específico para ${
                        platforms.find((p) => p.id === activeCaptionTab)?.label
                      } (em branco, usa o texto da aba "Todos")...`}
                      rows={9}
                      className="w-full flex-1 resize-none bg-transparent p-3.5 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600"
                    />
                  )}

                  {/* Bottom Toolbar inside Text Editor (like mLabs) */}
                  <div className="flex items-center justify-between border-t border-white/[0.07] bg-[#141926] px-3 py-2 text-[11px] text-slate-400">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (activeCaptionTab === 'all') {
                            setCaption((c) => `${c}${c.endsWith(' ') || !c ? '' : ' '}#`);
                          } else if (activeCaptionTab === 'tiktok') {
                            setTikTokTitle((c) => `${c}${c.endsWith(' ') || !c ? '' : ' '}#`);
                          } else {
                            const curr =
                              destinations.find(
                                (d) => d.platform === activeCaptionTab,
                              )?.caption ?? '';
                            updateDestination(activeCaptionTab, {
                              caption: `${curr}${curr.endsWith(' ') || !curr ? '' : ' '}#`,
                            });
                          }
                        }}
                        title="Inserir Hashtag"
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-slate-300 transition hover:bg-white/10"
                      >
                        <Hash size={13} />
                        <span>{hashtagCount} hashtags</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      {(selectedPlatforms.includes('instagram') ||
                        activeCaptionTab === 'instagram') && (
                        <span
                          className={
                            (currentTabText || caption).length >
                            INSTAGRAM_CAPTION_LIMIT
                              ? 'font-semibold text-rose-300'
                              : 'text-slate-400'
                          }
                        >
                          IG: {(currentTabText || caption).length}/
                          {INSTAGRAM_CAPTION_LIMIT}
                        </span>
                      )}
                      <span>
                        {(currentTabText || caption).length}/{MAX_CAPTION_LENGTH}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">
                    Mídias
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {imageCount} {imageCount === 1 ? 'imagem' : 'imagens'} e{' '}
                    {videoCount} {videoCount === 1 ? 'vídeo' : 'vídeos'}
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

                {mediaUrls.length === 0 ? (
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
                    disabled={isUploading || lockedPost || isBusy}
                    className="flex min-h-[116px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-[#0c1018] p-4 text-center transition hover:border-indigo-400/50 hover:bg-indigo-400/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isUploading ? (
                      <LoaderCircle
                        size={22}
                        className="animate-spin text-indigo-300"
                      />
                    ) : (
                      <ImagePlus size={22} className="text-slate-400" />
                    )}
                    <span className="text-xs font-medium text-slate-300">
                      {isUploading
                        ? 'Enviando arquivos...'
                        : 'Clique para enviar ou clique e arraste'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Envie imagens (JPG, PNG, WEBP) ou vídeos (MP4, MOV) · até
                      95 MB
                    </span>
                  </button>
                ) : (
                  <div
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (!isUploading && !lockedPost && !isBusy) {
                        void handleFileChange(event.dataTransfer.files);
                      }
                    }}
                    className="grid grid-cols-3 gap-2.5 rounded-xl border border-white/[0.08] bg-[#0c1018] p-3"
                  >
                    {mediaUrls.map((url, index) => {
                      const isVideo = isVideoMediaUrl(url);
                      return (
                        <div
                          key={`${url}-${index}`}
                          onClick={() => setPreviewMediaIndex(index)}
                          className={`group relative aspect-square cursor-pointer overflow-hidden rounded-lg border bg-[#0b0e14] ${
                            previewMediaIndex === index
                              ? 'border-indigo-400 ring-2 ring-indigo-400/20'
                              : 'border-white/10'
                          }`}
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
                              sizes="120px"
                              unoptimized
                              className="object-cover"
                            />
                          )}
                          {isVideo && (
                            <span className="absolute bottom-1 left-1 rounded bg-black/75 p-1 text-white">
                              <Film size={12} />
                            </span>
                          )}
                          {!lockedPost && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setVideoDurationSeconds(null);
                                setMediaUrls((current) =>
                                  current.filter((_, i) => i !== index),
                                );
                                setPreviewMediaIndex(0);
                              }}
                              aria-label="Remover mídia"
                              className="absolute right-1 top-1 rounded-md bg-black/75 p-1.5 text-white transition hover:bg-rose-500"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* mLabs-style "+ Adicionar" tile */}
                    {!lockedPost && mediaUrls.length < MAX_FILES && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/15 bg-white/[0.02] text-xs font-medium text-indigo-300 transition hover:border-indigo-400/50 hover:bg-indigo-400/[0.05]"
                      >
                        {isUploading ? (
                          <LoaderCircle size={18} className="animate-spin" />
                        ) : (
                          <Plus size={18} />
                        )}
                        <span>Adicionar</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button type="button" className="dashboard-link lg:hidden" aria-expanded={mobilePreview} aria-controls="studio-preview" onClick={() => setMobilePreview(!mobilePreview)}>{mobilePreview ? 'Ocultar prévia' : 'Ver prévia'}</button>
            </section>
            <section id="studio-preview" className={`studio-preview ${mobilePreview ? '' : 'hidden lg:block'}`}>
              <div className="flex flex-1 flex-col">
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">
                    Prévia
                  </span>
                  <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#141926] px-1.5 py-1">
                    <button
                      type="button"
                      onClick={() => cyclePreviewPlatform(-1)}
                      aria-label="Canal anterior"
                      className="rounded p-0.5 text-slate-400 hover:bg-white/10 hover:text-white"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="min-w-[90px] text-center text-[11px] font-medium text-slate-200">
                      {previewPlatformDetails.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => cyclePreviewPlatform(1)}
                      aria-label="Próximo canal"
                      className="rounded p-0.5 text-slate-400 hover:bg-white/10 hover:text-white"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                {/* Social Feed Card Simulation */}
                <div className="mx-auto w-full max-w-[360px] overflow-hidden rounded-2xl border border-slate-200/15 bg-white text-slate-900 shadow-lg">
                  {/* Card Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${previewPlatformDetails.badgeClass}`}
                      >
                        <previewPlatformDetails.Icon size={15} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-900">
                          {previewAccountName}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {previewDateTime.date} às {previewDateTime.time}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card Media Area */}
                  {previewMediaUrls.length > 0 ? (
                    <div className="relative aspect-[4/5] w-full overflow-hidden bg-slate-950">
                      {(() => {
                        const safeIdx = Math.min(
                          previewMediaIndex,
                          previewMediaUrls.length - 1,
                        );
                        const currentUrl = previewMediaUrls[safeIdx];
                        const isVideo = isVideoMediaUrl(currentUrl);
                        return isVideo ? (
                          <video
                            key={currentUrl}
                            src={currentUrl}
                            controls
                            muted
                            playsInline
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <Image
                            key={currentUrl}
                            src={currentUrl}
                            alt="Prévia da publicação"
                            fill
                            sizes="360px"
                            unoptimized
                            className="object-cover"
                          />
                        );
                      })()}

                      {previewMediaUrls.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewMediaIndex(
                                (i) =>
                                  (i - 1 + previewMediaUrls.length) %
                                  previewMediaUrls.length,
                              )
                            }
                            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewMediaIndex(
                                (i) => (i + 1) % previewMediaUrls.length,
                              )
                            }
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                          >
                            <ChevronRight size={16} />
                          </button>
                          <span className="absolute right-2.5 top-2.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
                            {Math.min(
                              previewMediaIndex + 1,
                              previewMediaUrls.length,
                            )}
                            /{previewMediaUrls.length}
                          </span>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-slate-100 px-6 text-center text-xs text-slate-500">
                      <ImagePlus size={24} className="text-slate-400" />
                      <span>
                        Aguardando conteúdo. Informe os canais e as mídias
                        desejadas para visualização.
                      </span>
                    </div>
                  )}

                  {/* Social Action Icons Row */}
                  <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2.5 text-slate-700">
                    <div className="flex items-center gap-3.5">
                      <Heart size={18} />
                      <MessageCircle size={18} />
                      <Send size={18} />
                    </div>
                    <Bookmark size={18} />
                  </div>

                  {/* Card Caption */}
                  <div className="max-h-36 overflow-y-auto px-3.5 py-2.5">
                    <p className="whitespace-pre-wrap break-words text-xs leading-5 text-slate-800">
                      {previewDest?.format === 'story'
                        ? 'Story: texto incorporado na própria mídia'
                        : previewPlatform === 'youtube' && previewDest?.youtube
                          ? `${previewDest.youtube.title}\n${previewDest.youtube.description}`
                          : previewPlatform === 'tiktok' && tiktokTitle.trim()
                            ? tiktokTitle
                            : previewDest?.caption ||
                              caption ||
                              'A legenda da sua publicação aparecerá aqui...'}
                    </p>
                  </div>
                </div>
              </div>
            </section>
            <section className="studio-schedule">
              <h3>Quando publicar?</h3>
              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">
                    Data, horário e fuso
                  </span>
                  <select
                    value={timeZone}
                    onChange={(event) => setTimeZone(event.target.value)}
                    aria-label="Fuso horário"
                    className="rounded-lg border border-white/10 bg-[#0c1018] px-2 py-1 text-[11px] text-slate-300 outline-none focus:border-indigo-400/50"
                  >
                    {timeZoneOptions.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Unified Schedule Box (mLabs style with channel icons + Date + Time) */}
                <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.03] p-3.5">
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-amber-200/90">
                      {useCustomSchedulePerNetwork
                        ? 'Horário base padrão'
                        : 'Mesma data e horário para todas as redes'}
                    </span>
                    <div className="flex items-center gap-1">
                      {selectedPlatforms.length > 0 ? (
                        selectedPlatforms.map((platform) => {
                          const meta = platforms.find(
                            (p) => p.id === platform,
                          )!;
                          return (
                            <span
                              key={platform}
                              className={`flex h-5 w-5 items-center justify-center rounded-full ${meta.badgeClass}`}
                              title={meta.label}
                            >
                              <meta.Icon size={11} />
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-[11px] text-slate-500">
                          Nenhum canal selecionado
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="space-y-1">
                      <span className="flex items-center gap-1 text-[11px] text-slate-400">
                        <CalendarIcon size={12} /> Data
                      </span>
                      <input
                        type="date"
                        value={scheduledDate}
                        min={minDateValue}
                        onChange={(event) => {
                          const nextDate = event.target.value;
                          setScheduledDate(nextDate);
                          if (!useCustomSchedulePerNetwork) {
                            setDestinations((current) =>
                              current.map((d) => ({
                                ...d,
                                scheduledFor: undefined,
                              })),
                            );
                          }
                        }}
                        className="w-full rounded-lg border border-white/10 bg-[#0c1018] px-3 py-2 text-xs font-medium text-slate-100 outline-none focus:border-indigo-400/50"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock3 size={12} /> Horário
                      </span>
                      <input
                        type="time"
                        value={time}
                        onChange={(event) => {
                          const nextTime = event.target.value;
                          setTime(nextTime);
                          if (!useCustomSchedulePerNetwork) {
                            setDestinations((current) =>
                              current.map((d) => ({
                                ...d,
                                scheduledFor: undefined,
                              })),
                            );
                          }
                        }}
                        className="w-full rounded-lg border border-white/10 bg-[#0c1018] px-3 py-2 text-xs font-medium text-slate-100 outline-none focus:border-indigo-400/50"
                      />
                    </label>
                  </div>
                </div>

                {/* Toggle for per-network custom date/time (like mLabs "⊕ Incluir mais dias e horários") */}
                {selectedPlatforms.length > 1 && (
                  <div className="mt-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setUseCustomSchedulePerNetwork((prev) => {
                          const next = !prev;
                          if (!next) {
                            // Clear custom schedules so all networks use the unified date/time
                            setDestinations((current) =>
                              current.map((d) => ({
                                ...d,
                                scheduledFor: undefined,
                              })),
                            );
                          }
                          return next;
                        });
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-300 underline-offset-4 hover:text-indigo-200 hover:underline"
                    >
                      <Plus size={14} />
                      {useCustomSchedulePerNetwork
                        ? 'Usar a mesma data e horário para todas as redes'
                        : 'Personalizar datas e horários diferentes por rede'}
                    </button>

                    {useCustomSchedulePerNetwork && (
                      <div className="mt-2.5 space-y-2 rounded-xl border border-white/[0.08] bg-[#0c1018] p-3">
                        {selectedPlatforms.map((platform) => {
                          const meta = platforms.find(
                            (p) => p.id === platform,
                          )!;
                          const d = destinations.find(
                            (item) => item.platform === platform,
                          );
                          const currentVal = d?.scheduledFor
                            ? (() => {
                                const v = getDateTimeInputValues(
                                  d.scheduledFor,
                                  timeZone,
                                );
                                return `${v.date}T${v.time}`;
                              })()
                            : `${scheduledDate}T${time}`;
                          return (
                            <div
                              key={platform}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="flex items-center gap-1.5 font-medium text-slate-300">
                                <span
                                  className={`flex h-5 w-5 items-center justify-center rounded-full ${meta.badgeClass}`}
                                >
                                  <meta.Icon size={11} />
                                </span>
                                {meta.label}
                              </span>
                              <input
                                type="datetime-local"
                                aria-label={`Horário ${platform}`}
                                value={currentVal}
                                onChange={(e) => {
                                  const [dDate, dTime] =
                                    e.target.value.split('T');
                                  const iso =
                                    dDate && dTime
                                      ? zonedDateTimeToIso(
                                          dDate,
                                          dTime,
                                          timeZone,
                                        )
                                      : null;
                                  updateDestination(platform, {
                                    scheduledFor: iso ?? undefined,
                                  });
                                }}
                                className="rounded-lg border border-white/10 bg-[#141926] px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-400/50"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {(hasTikTokSelected || selectedPlatforms.includes('youtube')) && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedSettings((v) => !v)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-xs font-semibold transition ${
                    showAdvancedSettings ||
                    hasTikTokSelected ||
                    selectedPlatforms.includes('youtube')
                      ? 'border-amber-400/40 bg-amber-400/10 text-amber-200'
                      : 'border-white/10 bg-[#141926] text-slate-300 hover:border-white/20'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Settings2 size={15} />
                    Opções da rede
                  </span>
                  <span className="text-[11px] opacity-80">
                    {showAdvancedSettings ? 'Ocultar' : 'Abrir'}
                  </span>
                </button>

                {/* Auto-show advanced settings when TikTok or YouTube is selected, or when toggled */}
                {(showAdvancedSettings) && (
                  <div className="mt-3 space-y-4">
                    {/* TikTok settings */}
                    {hasTikTokSelected && (
                      <section className="space-y-3 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.03] p-3.5">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-semibold text-cyan-100">
                            Opções obrigatórias do TikTok
                          </h3>
                          {tiktokCreatorInfo && (
                            <span className="text-[11px] text-slate-400">
                              @{tiktokCreatorInfo.creatorNickname} · máx.{' '}
                              {tiktokCreatorInfo.maxVideoPostDurationSeconds}s
                            </span>
                          )}
                        </div>

                        {!tiktokCreatorInfo && !tiktokCreatorInfoError && (
                          <p className="text-xs text-slate-400">
                            Consultando permissões da conta TikTok...
                          </p>
                        )}
                        {tiktokCreatorInfoError && (
                          <p role="alert" className="text-xs text-rose-200">
                            {tiktokCreatorInfoError}
                          </p>
                        )}

                        {!tiktokPublicPostingAllowed && tiktokCreatorInfo && (
                          <p className="rounded-lg border border-amber-300/15 bg-amber-300/[0.05] p-2 text-[11px] leading-4 text-amber-100/90">
                            Modo Sandbox / Não auditado: o TikTok exige
                            visibilidade &ldquo;Somente você (Privado)&rdquo;.
                          </p>
                        )}

                        <div>
                          <label
                            htmlFor="tiktok-privacy"
                            className="mb-1 block text-[11px] font-medium text-slate-300"
                          >
                            Quem pode assistir?{' '}
                            <span className="text-rose-300">*</span>
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
                            className="h-9 w-full rounded-lg border border-white/10 bg-[#171c28] px-2.5 text-xs text-slate-200 outline-none focus:border-cyan-300/40 disabled:opacity-50"
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
                                    (!tiktokPublicPostingAllowed &&
                                      value !== 'SELF_ONLY') ||
                                    (tiktokBrandContent &&
                                      value === 'SELF_ONLY')
                                  }
                                >
                                  {TIKTOK_PRIVACY_LABELS[value]}
                                </option>
                              ))}
                          </select>
                        </div>

                        <div className="flex flex-wrap gap-3 pt-1">
                          {[
                            {
                              id: 'tiktok-comments',
                              label: 'Comentários',
                              checked: tiktokAllowComments,
                              setChecked: setTikTokAllowComments,
                              disabled:
                                tiktokCreatorInfo?.commentDisabled ?? true,
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
                              label: 'Stitch',
                              checked: tiktokAllowStitch,
                              setChecked: setTikTokAllowStitch,
                              disabled:
                                tiktokCreatorInfo?.stitchDisabled ?? true,
                            },
                          ].map((item) => (
                            <label
                              key={item.id}
                              htmlFor={item.id}
                              className="flex items-center gap-1.5 text-xs text-slate-300"
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
                            </label>
                          ))}
                        </div>

                        <div className="space-y-1.5 border-t border-white/[0.07] pt-2">
                          <label
                            htmlFor="tiktok-commercial-content"
                            className="flex items-start gap-2 text-[11px] text-slate-300"
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
                              className="mt-0.5 accent-cyan-300"
                            />
                            Conteúdo promocional ou parceria de marca
                          </label>
                          {tiktokCommercialContent && (
                            <div className="ml-5 space-y-1.5">
                              <label className="flex items-center gap-2 text-[11px] text-slate-300">
                                <input
                                  type="checkbox"
                                  checked={tiktokBrandOrganic}
                                  onChange={(e) =>
                                    setTikTokBrandOrganic(e.target.checked)
                                  }
                                  className="accent-cyan-300"
                                />
                                Minha própria marca
                              </label>
                              <label className="flex items-center gap-2 text-[11px] text-slate-300">
                                <input
                                  type="checkbox"
                                  disabled={tiktokPrivacyLevel === 'SELF_ONLY'}
                                  checked={tiktokBrandContent}
                                  onChange={(e) =>
                                    setTikTokBrandContent(e.target.checked)
                                  }
                                  className="accent-cyan-300"
                                />
                                Marca de terceiros (patrocinado)
                              </label>
                              {tiktokDisclosureMissing && (
                                <p className="text-[11px] text-amber-200">
                                  Marque ao menos uma opção de marca acima.
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        <label
                          htmlFor="tiktok-consent"
                          className="flex items-start gap-2 border-t border-white/[0.07] pt-2 text-[11px] leading-4 text-slate-300"
                        >
                          <input
                            id="tiktok-consent"
                            type="checkbox"
                            checked={tiktokConsent}
                            onChange={(event) =>
                              setTikTokConsent(event.target.checked)
                            }
                            className="mt-0.5 accent-cyan-300"
                          />
                          <span>
                            Confirmo os direitos sobre o vídeo e a{' '}
                            <a
                              href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline"
                            >
                              Confirmação de Uso de Música do TikTok
                            </a>
                            .
                          </span>
                        </label>
                      </section>
                    )}

                    {/* YouTube settings */}
                    {selectedPlatforms.includes('youtube') && (
                      <section className="space-y-2.5 rounded-xl border border-red-400/20 bg-red-400/[0.03] p-3.5">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-semibold text-red-200">
                            Configurações do YouTube
                          </h3>
                          <label className="flex items-center gap-1.5 text-[11px] text-slate-300">
                            <input
                              type="checkbox"
                              checked={Boolean(
                                destinations.find(
                                  (d) => d.platform === 'youtube',
                                )?.youtube,
                              )}
                              onChange={(e) => {
                                const d = destinations.find(
                                  (item) => item.platform === 'youtube',
                                );
                                updateDestination('youtube', {
                                  youtube: e.target.checked
                                    ? {
                                        title:
                                          (d?.caption || caption)
                                            .split('\n')[0]
                                            .slice(0, 100) || 'Novo vídeo',
                                        description: (d?.caption || caption)
                                          .split('\n')
                                          .slice(1)
                                          .join('\n'),
                                        privacyStatus: 'private',
                                        madeForKids: false,
                                        containsSyntheticMedia: false,
                                      }
                                    : undefined,
                                });
                              }}
                            />
                            Personalizar título/visibilidade
                          </label>
                        </div>
                        {destinations.find((d) => d.platform === 'youtube')
                          ?.youtube ? (
                          <div className="space-y-2 text-xs">
                            <input
                              placeholder="Título do vídeo (máx. 100 caracteres)"
                              maxLength={100}
                              value={
                                destinations.find(
                                  (d) => d.platform === 'youtube',
                                )!.youtube!.title
                              }
                              onChange={(e) => {
                                const yt = destinations.find(
                                  (d) => d.platform === 'youtube',
                                )!.youtube!;
                                updateDestination('youtube', {
                                  youtube: { ...yt, title: e.target.value },
                                });
                              }}
                              className="w-full rounded-lg border border-white/10 bg-[#141926] px-2.5 py-1.5 text-xs text-slate-100"
                            />
                            <select
                              value={
                                destinations.find(
                                  (d) => d.platform === 'youtube',
                                )!.youtube!.privacyStatus
                              }
                              onChange={(e) => {
                                const yt = destinations.find(
                                  (d) => d.platform === 'youtube',
                                )!.youtube!;
                                updateDestination('youtube', {
                                  youtube: {
                                    ...yt,
                                    privacyStatus: e.target.value as
                                      | 'private'
                                      | 'unlisted'
                                      | 'public',
                                  },
                                });
                              }}
                              className="w-full rounded-lg border border-white/10 bg-[#141926] px-2.5 py-1.5 text-xs text-slate-100"
                            >
                              <option value="private">Privado</option>
                              <option value="unlisted">Não listado</option>
                              <option value="public">Público</option>
                            </select>
                            <label className="flex items-center gap-2 text-[11px] text-slate-300">
                              <input
                                type="checkbox"
                                checked={
                                  destinations.find(
                                    (d) => d.platform === 'youtube',
                                  )!.youtube!.madeForKids
                                }
                                onChange={(e) => {
                                  const yt = destinations.find(
                                    (d) => d.platform === 'youtube',
                                  )!.youtube!;
                                  updateDestination('youtube', {
                                    youtube: {
                                      ...yt,
                                      madeForKids: e.target.checked,
                                    },
                                  });
                                }}
                              />
                              Destinado a crianças
                            </label>
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400">
                            A 1ª linha do texto vira o título do vídeo e a
                            visibilidade padrão é Privado.
                          </p>
                        )}
                      </section>
                    )}
                  </div>
                )}
              </div>
              )}
            </section>
          </div>
        </fieldset>

        {/* Error Alert Banner above Footer */}
        {errorMessage && (
          <div
            role="alert"
            className="mx-5 mb-2 flex shrink-0 items-center gap-2 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200 sm:mx-7"
          >
            <AlertCircle size={16} className="shrink-0 text-rose-300" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Bottom Sticky Action Bar (mLabs style) */}
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] bg-[#141926] px-5 py-3.5 sm:px-7">
          <div className="flex flex-wrap items-center gap-2">
            {selectedPost ? (
              <>
                {canRetryPost(selectedPost) && (
                  <button
                    type="button"
                    onClick={() => void handleRetry()}
                    disabled={isBusy || isUploading}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-3 text-xs font-medium text-indigo-200 transition hover:bg-indigo-500/20 disabled:opacity-50"
                  >
                    {pendingAction === 'retry' ? (
                      <LoaderCircle size={14} className="animate-spin" />
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
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-rose-400/20 px-3 text-xs font-medium text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-50"
                  >
                    {pendingAction === 'delete' ? (
                      <LoaderCircle size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                    Excluir
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleDuplicate()}
                  disabled={isBusy || isUploading}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-medium text-slate-300 transition hover:bg-white/[0.05] disabled:opacity-50"
                >
                  {pendingAction === 'duplicate' ? (
                    <LoaderCircle size={14} className="animate-spin" />
                  ) : (
                    <Copy size={14} />
                  )}
                  Duplicar
                </button>
              </>
            ) : null}
            {!lockedPost && <span className="text-xs text-slate-400">{profileCount} {profileCount === 1 ? 'perfil' : 'perfis'} · {useCustomSchedulePerNetwork ? 'Horários por rede' : `${scheduledDate.split('-').reverse().join('/')} às ${time}`} · {timeZone}</span>}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {!lockedPost && (
              <>
                <button
                  type="button"
                  onClick={() => void executeSave(true)}
                  disabled={isBusy || isUploading}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-4 text-xs font-medium text-slate-200 transition hover:bg-white/[0.07] disabled:opacity-50"
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
                  disabled={isBusy || isUploading || tiktokDisclosureMissing}
                  onClick={() => {
                    setErrorMessage('');
                    if (validateBeforeSchedule(false, true)) {
                      setConfirmScheduleModal({ publishNow: true });
                    }
                  }}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-indigo-400/35 bg-indigo-500/10 px-4 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-500/20 disabled:opacity-50"
                >
                  <Send size={14} />
                  Publicar agora
                </button>

                <button
                  type="button"
                  disabled={isBusy || isUploading || tiktokDisclosureMissing}
                  onClick={() => {
                    setErrorMessage('');
                    if (validateBeforeSchedule(false, false)) {
                      setConfirmScheduleModal({ publishNow: false });
                    }
                  }}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-xs font-semibold text-white shadow-lg shadow-blue-950/40 transition hover:bg-blue-500 disabled:opacity-50"
                >
                  {pendingAction === 'schedule' ? (
                    <LoaderCircle size={15} className="animate-spin" />
                  ) : (
                    <CalendarIcon size={15} />
                  )}
                  {pendingAction === 'schedule'
                    ? 'Processando...'
                    : selectedPost && selectedPost.status !== 'draft'
                      ? 'Salvar alterações'
                      : 'Agendar'}
                </button>
              </>
            )}
          </div>
        </footer>

        {/* mLabs-style Confirmation Modal before Scheduling / Publishing (matches Image 3) */}
        {confirmScheduleModal && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#171c28] p-6 text-center shadow-2xl">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-slate-400/40 text-slate-300">
                <Info size={32} />
              </div>
              <h3 className="text-base font-semibold text-white">
                {confirmScheduleModal.publishNow
                  ? 'Tem certeza que deseja publicar agora?'
                  : 'Tem certeza que deseja agendar esta publicação?'}
              </h3>
              <p className="mt-1.5 text-xs text-slate-400">
                {confirmScheduleModal.publishNow
                  ? 'O envio será iniciado imediatamente para todos os canais selecionados.'
                  : useCustomSchedulePerNetwork
                    ? 'A publicação será agendada respeitando os horários personalizados de cada canal.'
                    : 'Confira os perfis e o horário de envio.'}
              </p>
              <ul className="mt-3 space-y-1 text-sm">
                {destinations.filter(d => selectedPlatforms.includes(d.platform)).map(d => {
                  const local = useCustomSchedulePerNetwork && d.scheduledFor ? getDateTimeInputValues(d.scheduledFor, timeZone) : { date: scheduledDate, time };
                  return <li key={d.platform}>{platforms.find(p => p.id === d.platform)?.label} · {accounts.find(a => a.id === d.accountId)?.name || 'Perfil padrão'}{!confirmScheduleModal.publishNow && ` · ${local.date.split('-').reverse().join('/')} às ${local.time} (${timeZone})`}</li>;
                })}
              </ul>
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmScheduleModal(null)}
                  className="min-w-[90px] rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.08]"
                >
                  Não
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void executeSave(false, confirmScheduleModal.publishNow)
                  }
                  className="min-w-[90px] rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white transition hover:bg-blue-500"
                >
                  Sim
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Guard Modal when clicking X with unsaved changes */}
        {confirmDiscardModal && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#171c28] p-6 text-center shadow-2xl">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-300">
                <AlertCircle size={28} />
              </div>
              <h3 className="text-base font-semibold text-white">
                Sair sem salvar?
              </h3>
              <p className="mt-1.5 text-xs text-slate-400">
                Você preencheu informações neste post. Se fechar agora sem
                salvar como rascunho ou agendar, as alterações serão perdidas.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmDiscardModal(false)}
                  className="rounded-lg bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-400"
                >
                  Continuar editando
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDiscardModal(false);
                    void executeSave(true);
                  }}
                  className="rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08]"
                >
                  Salvar rascunho e sair
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDiscardModal(false);
                    closeModal();
                  }}
                  className="rounded-lg border border-rose-400/25 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
                >
                  Descartar alterações
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </dialog>
  );
}
