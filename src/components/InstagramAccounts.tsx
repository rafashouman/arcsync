import {
  AlertCircle,
  CheckCircle2,
  Link2,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from 'lucide-react';
import { InstagramIcon } from '@/src/components/icons/SocialIcons';
import {
  disconnectInstagramAccount,
  makeDefaultInstagramAccount,
  refreshInstagramAccount,
} from '@/src/app/actions/accountActions';
import type { InstagramAccountSummary } from '@/src/data/accounts';

const statusMessages: Record<string, { tone: 'success' | 'error' | 'info'; text: string }> = {
  connected: { tone: 'success', text: 'Instagram conectado. O token foi armazenado com criptografia.' },
  disconnected: { tone: 'success', text: 'Conta desconectada do FeedSync.' },
  'token-refreshed': { tone: 'success', text: 'Token do Instagram renovado por mais até 60 dias.' },
  'default-updated': { tone: 'success', text: 'Conta definida como padrão para publicações do Instagram.' },
  cancelled: { tone: 'info', text: 'Conexão cancelada no Instagram.' },
  'invalid-state': { tone: 'error', text: 'A validação de segurança expirou. Inicie a conexão novamente.' },
  'login-required': { tone: 'error', text: 'Entre novamente para conectar sua conta.' },
  configuration: { tone: 'error', text: 'Configure App ID, App Secret e Redirect URI do Instagram no servidor.' },
  'storage-required': { tone: 'error', text: 'Configure MongoDB para armazenar as conexões sociais com segurança.' },
  'permission-required': { tone: 'error', text: 'A conta não concedeu as permissões necessárias. Reconecte e aceite os acessos solicitados.' },
  'connection-error': { tone: 'error', text: 'Não foi possível conectar. Verifique a configuração do app Meta e tente novamente.' },
  'account-not-found': { tone: 'error', text: 'A conta não foi encontrada ou não pertence a este usuário.' },
  'disconnect-error': { tone: 'error', text: 'Não foi possível desconectar a conta. Tente novamente.' },
  'refresh-too-early': { tone: 'info', text: 'O token precisa ter pelo menos 24 horas antes de ser renovado.' },
  'token-expired': { tone: 'error', text: 'O token expirou e não pode ser renovado. Desconecte e conecte novamente.' },
  'refresh-error': { tone: 'error', text: 'Não foi possível renovar o token. Reconecte a conta se o problema persistir.' },
  'default-error': { tone: 'error', text: 'Não foi possível alterar a conta padrão.' },
};

export default function InstagramAccounts({
  accounts,
  status,
  hasMongo,
  hasEncryptionKey,
  isOAuthConfigured,
  canManageAccounts,
}: {
  accounts: InstagramAccountSummary[];
  status?: string;
  hasMongo: boolean;
  hasEncryptionKey: boolean;
  isOAuthConfigured: boolean;
  canManageAccounts: boolean;
}) {
  const message = status ? statusMessages[status] : undefined;

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

      <div className="rounded-2xl border border-white/[0.07] bg-[#11151f] p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-pink-400/15 bg-pink-400/[0.08] text-pink-200">
              <InstagramIcon size={20} />
            </span>
            <div>
              <h2 className="font-semibold text-white">Instagram</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Conecte uma conta profissional Business ou Creator para preparar a publicação via API.
              </p>
            </div>
          </div>
          {canManageAccounts ? (
            <a
              href="/api/social/meta/connect"
              aria-disabled={!hasMongo || !hasEncryptionKey || !isOAuthConfigured}
              className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-xs font-semibold transition ${
                hasMongo && hasEncryptionKey && isOAuthConfigured
                  ? 'bg-indigo-500 text-white hover:bg-indigo-400'
                  : 'pointer-events-none border border-white/10 bg-white/[0.03] text-slate-500'
              }`}
            >
              <Link2 size={15} />
              Conectar Instagram
            </a>
          ) : (
            <span className="text-xs text-slate-500">
              Conexões gerenciadas por admins
            </span>
          )}
        </div>

        {(!hasMongo || !hasEncryptionKey || !isOAuthConfigured) && (
          <div className="mt-5 space-y-2 rounded-xl border border-amber-300/10 bg-amber-300/[0.035] p-3 text-[11px] leading-5 text-amber-100/75">
            {!hasMongo && <p>Configure MONGODB_URI para armazenar contas.</p>}
            {!hasEncryptionKey && (
              <p>
                Configure SOCIAL_TOKEN_ENCRYPTION_KEY com uma chave aleatória
                base64 de 32 bytes.
              </p>
            )}
            {!isOAuthConfigured && (
              <p>
                Configure INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET e
                INSTAGRAM_REDIRECT_URI no ambiente do servidor.
              </p>
            )}
          </div>
        )}

        <div className="mt-6 border-t border-white/[0.06] pt-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-200">Contas conectadas</h3>
            <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] text-slate-400">
              {accounts.length}
            </span>
          </div>

          {accounts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
              <InstagramIcon size={22} className="mx-auto text-slate-600" />
              <p className="mt-3 text-sm text-slate-400">Nenhuma conta conectada</p>
              <p className="mt-1 text-xs text-slate-600">
                As permissões solicitadas são básicas e de publicação.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => {
                return (
                  <div
                    key={account.id}
                    className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pink-400/10 text-pink-200">
                        <InstagramIcon size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-100">
                          @{account.accountName}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Token válido até{' '}
                          {new Date(account.expiresAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {account.isDefault ? (
                        <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-2.5 py-1 text-[10px] font-medium text-emerald-200">
                          Padrão
                        </span>
                      ) : canManageAccounts ? (
                        <form action={makeDefaultInstagramAccount.bind(null, account.id)}>
                          <button
                            type="submit"
                            className="inline-flex h-8 items-center rounded-lg border border-white/[0.08] px-2.5 text-[11px] text-slate-300 transition hover:bg-white/[0.05]"
                          >
                            Definir padrão
                          </button>
                        </form>
                      ) : null}
                      {canManageAccounts && (
                        <>
                          <form action={refreshInstagramAccount.bind(null, account.id)}>
                            <button
                              type="submit"
                              title="Renovar após 24 horas, enquanto o token ainda for válido"
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 text-[11px] text-slate-300 transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <RefreshCw size={13} />
                              Renovar
                            </button>
                          </form>
                          <form action={disconnectInstagramAccount.bind(null, account.id)}>
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
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] leading-5 text-slate-500">
        <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-300/70" />
        Os tokens são criptografados com AES-256-GCM antes de serem salvos. A
        conta padrão é usada ao publicar posts agendados para o Instagram.
      </div>
    </section>
  );
}
