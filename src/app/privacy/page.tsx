import PublicInfoLayout from '@/src/components/PublicInfoLayout';
export default function PrivacyPage() {
  return <PublicInfoLayout title="Privacidade">
    <p>O Arcsync utiliza os dados da sua conta, participação em equipes, identificadores das contas sociais, autorizações, textos, mídias e histórico de agendamentos para oferecer o serviço.</p>
    <p>As autorizações sociais ficam armazenadas com criptografia no servidor. Os integrantes autorizados do workspace podem acessar os conteúdos conforme seu papel. Mídias destinadas à publicação são disponibilizadas aos provedores por links assinados com validade limitada.</p>
    <p>Ao agendar um conteúdo, seus dados e mídias são enviados à rede escolhida. Após o envio, a rede também trata esses dados conforme suas próprias políticas. O serviço utiliza hospedagem, armazenamento e e-mail de recuperação de acesso para operar.</p>
    <p>Excluir um post do calendário preserva o registro no histórico interno. Isso não apaga publicações já enviadas à rede. Para solicitar remoção dos dados armazenados pelo Arcsync, consulte a página de exclusão de dados.</p>
    <p>As conexões podem ser removidas nas configurações do Arcsync e revogadas diretamente na rede. Para Google e YouTube, também é possível revogar o acesso em <a className="underline" href="https://myaccount.google.com/permissions">Permissões da Conta Google</a>. Consulte a <a className="underline" href="https://policies.google.com/privacy">Política de Privacidade do Google</a>.</p>
  </PublicInfoLayout>;
}
