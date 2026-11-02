import {
  AlertCircle,
  CheckCircle2,
  Link2,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from 'lucide-react';
import {
  FacebookIcon,
  TikTokIcon,
  YoutubeIcon,
} from '@/src/components/icons/SocialIcons';
import {
  disconnectSocialAccount,
  makeDefaultSocialAccount,
  refreshSocialAccount,
} from '@/src/app/actions/socialAccountActions';
import type {
  OAuthPlatform,
  SocialAccountSummary,
} from '@/src/data/socialAccounts';

const platformDetails: Record<
  OAuthPlatform,
  { label: string; Icon: typeof TikTokIcon; tone: string }
> = {
  tiktok: {
    label: 'TikTok',
    Icon: TikTokIcon,
    tone: 'text-cyan-200 border-cyan-400/15 bg-cyan-400/[0.08]',
  },
  facebook: {label:'Facebook Páginas',Icon:FacebookIcon,tone:'text-blue-200 border-blue-400/15 bg-blue-400/10'},
  youtube: {
    label: 'YouTube',
    Icon: YoutubeIcon,
    tone: 'text-red-200 border-red-400/15 bg-red-400/[0.08]',
  },
};

const statusMessages: Record<string, { tone: 'success' | 'error' | 'info'; text: string }> = {
  'tiktok-connected': { tone: 'success', text: 'TikTok conectado. O token foi armazenado com criptografia.' },
  'youtube-connected': { tone: 'success', text: 'YouTube conectado. O token foi armazenado com criptografia.' },
  'tiktok-cancelled': { tone: 'info', text: 'Conexão cancelada no TikTok.' },
  'youtube-cancelled': { tone: 'info', text: 'Conexão cancelada no Google.' },
  'tiktok-invalid-state': { tone: 'error', text: 'A validação de segurança do TikTok expirou. Inicie novamente.' },
  'youtube-invalid-state': { tone: 'error', text: 'A validação de segurança do Google expirou. Inicie novamente.' },
  'tiktok-configuration': { tone: 'error', text: 'Configure TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET e TIKTOK_REDIRECT_URI.' },
  'youtube-configuration': { tone: 'error', text: 'Configure YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET e YOUTUBE_REDIRECT_URI.' },
  'tiktok-permission-required': { tone: 'error', text: 'O TikTok não concedeu as permissões necessárias para publicar.' },
  'youtube-permission-required': { tone: 'error', text: 'O Google não concedeu a permissão necessária para enviar vídeos.' },
  'tiktok-connection-error': { tone: 'error', text: 'Não foi possível conectar ao TikTok. Confira a configuração do app e tente novamente.' },
  'youtube-connection-error': { tone: 'error', text: 'Não foi possível conectar ao YouTube. Confira a configuração do app e tente novamente.' },
  'tiktok-disconnected': { tone: 'success', text: 'Conta TikTok desconectada do FeedSync.' },
  'youtube-disconnected': { tone: 'success', text: 'Conta YouTube desconectada do FeedSync.' },
  'tiktok-token-refreshed': { tone: 'success', text: 'Token do TikTok renovado.' },
  'youtube-token-refreshed': { tone: 'success', text: 'Token do YouTube renovado.' },
  'tiktok-default-updated': { tone: 'success', text: 'Conta padrão do TikTok atualizada.' },
  'youtube-default-updated': { tone: 'success', text: 'Conta padrão do YouTube atualizada.' },
  'tiktok-account-not-found': { tone: 'error', text: 'A conta TikTok não foi encontrada nesta conta FeedSync.' },
  'youtube-account-not-found': { tone: 'error', text: 'A conta YouTube não foi encontrada nesta conta FeedSync.' },
  'tiktok-disconnect-error': { tone: 'error', text: 'Não foi possível desconectar a conta TikTok.' },
  'youtube-disconnect-error': { tone: 'error', text: 'Não foi possível desconectar a conta YouTube.' },
  'tiktok-refresh-error': { tone: 'error', text: 'Não foi possível renovar o token do TikTok. Reconecte a conta se persistir.' },
  'youtube-refresh-error': { tone: 'error', text: 'Não foi possível renovar o token do YouTube. Reconecte a conta se persistir.' },
  'tiktok-default-error': { tone: 'error', text: 'Não foi possível alterar a conta padrão do TikTok.' },
  'youtube-default-error': { tone: 'error', text: 'Não foi possível alterar a conta padrão do YouTube.' },
  'storage-required': { tone: 'error', text: 'Configure MongoDB para armazenar as conexões sociais.' },
  'account-error': { tone: 'error', text: 'Não foi possível atualizar a conta social.' },
};

export default function OAuthSocialAccounts({
  accounts,
  status,
  hasMongo,
  hasEncryptionKey,
  configured,
  canManageAccounts,
}: {
  accounts: Record<OAuthPlatform, SocialAccountSummary[]>;
  status?: string;
  hasMongo: boolean;
  hasEncryptionKey: boolean;
  configured: Record<OAuthPlatform, boolean>;
  canManageAccounts: boolean;
}) {
  const message = status ? statusMessages[status] ?? (status.startsWith('facebook-') ? {tone: status === 'facebook-connected' || status === 'facebook-disconnected' || status === 'facebook-default-updated' ? 'success' : 'error', text: status === 'facebook-connected' ? 'Páginas autorizadas conectadas. Selecione a Página de destino em cada post.' : status === 'facebook-disconnected' ? 'Página desconectada do FeedSync. Para revogar o acesso na Meta, remova o app nas integrações comerciais do Facebook.' : status === 'facebook-default-updated' ? 'Página padrão atualizada.' : 'Conexão Facebook não concluída. Confira permissões e configuração e reconecte a Página.'} : undefined) : undefined;

  return (
    <section className="space-y-5">
      {message && (
        <div
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-2 rounded-xl border p-3 text-xs leading-5 ${
            message.tone === 'success'
              ? 'border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-100'
              : message.tone === 'error'
                ? 'border-rose-400/20 bg-rose-400/[0.05] text-rose-100'
                : 'border-indigo-400/20 bg-indigo-400/[0.05] text-indigo-100'
          }`}
        >
          {message.tone === 'success' ? (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {(['tiktok', 'youtube', 'facebook'] as const).map((platform) => {
        const { label, Icon, tone } = platformDetails[platform];
        const isReady = hasMongo && hasEncryptionKey && configured[platform];
        return (
          <div
            key={platform}
            className="rounded-2xl border border-white/[0.07] bg-[#11151f] p-5 sm:p-7"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${tone}`}>
                  <Icon size={20} />
                </span>
                <div>
                  <h2 className="font-semibold text-white">{label}</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Conecte sua conta para autorizar o FeedSync a preparar publicações.
                  </p>
                </div>
              </div>
              {canManageAccounts ? (
                <a
                  href={`/api/social/${platform}/connect`}
                  aria-disabled={!isReady}
                  className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-xs font-semibold transition ${
                    isReady
                      ? 'bg-indigo-500 text-white hover:bg-indigo-400'
                      : 'pointer-events-none border border-white/10 bg-white/[0.03] text-slate-500'
                  }`}
                >
                  <Link2 size={15} />
                  Conectar {label}
                </a>
              ) : (
                <span className="text-xs text-slate-500">
                  Conexões gerenciadas por admins
                </span>
              )}
            </div>

            {!isReady && (
              <div className="mt-5 space-y-2 rounded-xl border border-amber-300/10 bg-amber-300/[0.035] p-3 text-[11px] leading-5 text-amber-100/75">
                {!hasMongo && <p>Configure MONGODB_URI para armazenar contas.</p>}
                {!hasEncryptionKey && (
                  <p>Configure SOCIAL_TOKEN_ENCRYPTION_KEY com uma chave base64 de 32 bytes.</p>
                )}
                {!configured[platform] && (
                  <p>
                    Configure as credenciais OAuth do {label} no servidor.
                  </p>
                )}
              </div>
            )}

            <div className="mt-6 border-t border-white/[0.06] pt-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-200">Contas conectadas</h3>
                <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] text-slate-400">
                  {accounts[platform].length}
                </span>
              </div>

              {accounts[platform].length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
                  <Icon size={22} className="mx-auto text-slate-600" />
                  <p className="mt-3 text-sm text-slate-400">Nenhuma conta conectada</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {accounts[platform].map((account) => (
                    <div
                      key={account.id}
                      className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone}`}>
                          <Icon size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-100">
                            {account.accountName}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            Token válido até{' '}
                            {new Date(account.accessTokenExpiresAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {account.isDefault ? (
                          <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-2.5 py-1 text-[10px] font-medium text-emerald-200">
                            Padrão
                          </span>
                        ) : canManageAccounts ? (
                          <form action={makeDefaultSocialAccount.bind(null, platform, account.id)}>
                            <button
                              type="submit"
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 text-[11px] text-slate-300 transition hover:bg-white/[0.05]"
                            >
                              Definir padrão
                            </button>
                          </form>
                        ) : null}
                        {canManageAccounts && (
                          <>
                            {platform !== 'facebook' && <form action={refreshSocialAccount.bind(null, platform, account.id)}>
                              <button
                                type="submit"
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 text-[11px] text-slate-300 transition hover:bg-white/[0.05]"
                              >
                                <RefreshCw size={13} />
                                Renovar
                              </button>
                            </form>}
                            <form action={disconnectSocialAccount.bind(null, platform, account.id)}>
                              <button
                                type="submit"
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-400/15 px-2.5 text-[11px] text-rose-200 transition hover:bg-rose-400/[0.08]"
                              >
                                <Unplug size={13} />
                                Desconectar
                              </button>
                            </form>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] leading-5 text-slate-500">
        <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-300/70" />
        Os tokens são armazenados com criptografia AES-256-GCM. Escolha explicitamente a
        conta de destino em cada agendamento.
      </div>
    </section>
  );
}
