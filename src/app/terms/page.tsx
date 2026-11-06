import PublicInfoLayout from '@/src/components/PublicInfoLayout';
export default function TermsPage() {
  return <PublicInfoLayout title="Condições de uso">
    <p>Utilize o Arcsync apenas com contas que você tem autorização para gerenciar e conteúdos cujos direitos de uso possui, incluindo imagem, vídeo e música.</p>
    <p>Antes de agendar, confira a conta, a mídia, o texto, o fuso horário e as opções específicas da rede. Membros de equipes devem respeitar os papéis e fluxos de aprovação definidos pelo workspace.</p>
    <p>A publicação depende da disponibilidade, permissões e limites das plataformas. O horário indica quando o envio deve começar; o processamento externo pode levar mais tempo. Consulte o monitoramento para identificar falhas e resultados ainda sem confirmação.</p>
    <p>Os recursos de YouTube utilizam os serviços de API do YouTube. Ao utilizá-los, você concorda também com os <a className="underline" href="https://www.youtube.com/t/terms">Termos de Serviço do YouTube</a>.</p>
    <p>Solicitações sobre acesso, conteúdo ou dados podem ser encaminhadas pelo contato de suporte indicado nesta página.</p>
  </PublicInfoLayout>;
}
