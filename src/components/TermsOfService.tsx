import Link from 'next/link';
import PublicInfoLayout from '@/src/components/PublicInfoLayout';

export default function TermsOfService() {
  return (
    <PublicInfoLayout title="Termos de Serviço">
      <p className="text-sm text-slate-400">Última atualização: 10 de novembro de 2026.</p>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">1. Sobre o Arcsync</h2>
        <p>O Arcsync é um serviço para organizar conteúdos, contas de destino, agendamentos, aprovações e o acompanhamento de publicações. O responsável pelo serviço e o contato estão indicados ao final desta página.</p>
        <p>Ao criar uma conta ou utilizar o serviço, você concorda com estes termos. Se não concordar, não conecte contas sociais nem utilize os recursos de publicação.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">2. Conta e uso autorizado</h2>
        <p>Você deve fornecer um endereço de e-mail válido, proteger suas credenciais de acesso e manter controle sobre a sua conta. Se acreditar que outra pessoa acessou sua conta, avise o suporte.</p>
        <p>Conecte somente contas sociais que você possui ou está autorizado a administrar. Em workspaces compartilhados, cada integrante deve respeitar as permissões e os fluxos de aprovação configurados.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3. Conteúdo e direitos</h2>
        <p>Você mantém os direitos sobre os textos, imagens, vídeos e demais materiais que envia. Você declara ter os direitos, licenças e autorizações necessários para armazená-los e publicá-los, inclusive quanto a pessoas, marcas, músicas e outros elementos neles presentes.</p>
        <p>Você autoriza o Arcsync a armazenar, processar e transmitir esse conteúdo aos serviços escolhidos por você, exclusivamente para prestar as funções solicitadas, como organizar, agendar e publicar conteúdo.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">4. Integrações e publicações</h2>
        <p>Conectar uma conta não publica conteúdo por si só. A publicação ocorre quando você solicita ou agenda o envio, sujeito às opções e confirmações apresentadas no serviço. Antes de enviar, confira o destino, o conteúdo, a mídia, as permissões e o horário.</p>
        <p>O envio depende da disponibilidade, das permissões, dos limites e das regras de cada plataforma. O Arcsync não garante que uma plataforma aceite, exiba ou mantenha uma publicação, nem que o processamento externo termine exatamente no horário agendado. Confira o histórico e a própria rede quando o resultado estiver pendente ou incerto.</p>
        <p>Ao usar integrações da Meta, você também deve cumprir os <a className="underline" href="https://www.facebook.com/legal/terms">Termos da Meta</a> e as <a className="underline" href="https://developers.facebook.com/devpolicy/">Políticas para Desenvolvedores da Meta</a>. Os recursos do YouTube também estão sujeitos aos <a className="underline" href="https://www.youtube.com/t/terms">Termos de Serviço do YouTube</a>.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">5. Uso permitido</h2>
        <p>Você não deve usar o Arcsync para violar a lei, direitos de terceiros, regras das plataformas, controles de acesso ou medidas de segurança. Também não deve tentar obter acesso a contas ou workspaces sem autorização, interferir no serviço ou enviar conteúdo que não tenha autorização para usar.</p>
        <p>Você é responsável por revisar o conteúdo e as configurações de publicação antes de autorizar o envio. A remoção de uma publicação já enviada deve ser feita na plataforma correspondente.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">6. Disponibilidade e alterações</h2>
        <p>Recursos podem mudar ou ficar temporariamente indisponíveis por manutenção, falhas técnicas ou alterações nos serviços de terceiros. O Arcsync pode restringir o acesso em caso de uso indevido ou risco à segurança, respeitando os direitos previstos na legislação aplicável.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">7. Privacidade e encerramento</h2>
        <p>O tratamento de dados está descrito na <Link className="underline" href="/privacy">Política de Privacidade</Link>. Para desconectar uma integração ou solicitar a exclusão de dados, siga as instruções na página de <Link className="underline" href="/data-deletion">exclusão de dados</Link>.</p>
        <p>Estes termos não excluem direitos ou responsabilidades que não possam ser afastados pela legislação aplicável. Dúvidas sobre o serviço podem ser encaminhadas ao contato indicado nesta página.</p>
      </section>
    </PublicInfoLayout>
  );
}
