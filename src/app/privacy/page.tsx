import PublicInfoLayout from '@/src/components/PublicInfoLayout';
import Link from 'next/link';

export default function PrivacyPage() {
  return <PublicInfoLayout title="Privacidade">
    <p className="text-sm text-slate-400">Última atualização: 10 de novembro de 2026.</p>

    <section className="space-y-3">
      <h2 className="text-xl font-semibold">1. Quem trata os dados</h2>
      <p>O Arcsync é operado pelo responsável identificado ao final desta página. Esta política explica como os dados são tratados quando você usa o serviço e conecta contas sociais.</p>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl font-semibold">2. Dados utilizados</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li><strong>Conta e workspace:</strong> e-mail de acesso, identificadores internos, participação em equipes, convites e permissões.</li>
        <li><strong>Contas sociais:</strong> identificador e nome da conta conectada, permissões concedidas, dados técnicos da autorização e tokens de acesso necessários à integração.</li>
        <li><strong>Conteúdo e publicações:</strong> textos, arquivos de mídia, destino escolhido, configurações, horários, aprovações e estados ou mensagens de resultado do envio.</li>
        <li><strong>Segurança e suporte:</strong> dados técnicos de sessão, confirmação de e-mail, recuperação de senha e informações necessárias para diagnosticar falhas ou responder a solicitações.</li>
      </ul>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl font-semibold">3. Como usamos os dados</h2>
      <p>Usamos esses dados para autenticar usuários, administrar workspaces, conectar contas autorizadas, preparar e publicar conteúdo solicitado, acompanhar os resultados, proteger o serviço e prestar suporte. O tratamento ocorre conforme necessário para fornecer as funções que você solicita e cumprir as obrigações legais aplicáveis.</p>
      <p>O Arcsync não solicita nem armazena sua senha da Meta. A autorização da conta ocorre no fluxo da própria Meta. Os tokens sociais são armazenados cifrados no servidor e usados para executar as funções da integração autorizadas por você.</p>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl font-semibold">4. Dados da Meta e publicação</h2>
      <p>Quando você conecta Instagram ou Facebook, a Meta fornece os dados necessários para identificar a conta e manter a autorização, como identificador, nome, permissões e tokens. O Arcsync usa esses dados para mostrar o destino conectado e realizar ações que você solicitar, como publicar conteúdo. Conectar uma conta, por si só, não inicia uma publicação.</p>
      <p>Ao solicitar uma publicação, o conteúdo e as informações necessárias são enviados à plataforma escolhida. A mídia pode ser disponibilizada à plataforma por um link assinado com validade técnica de até 48 horas. Depois do envio, a plataforma trata os dados conforme os próprios termos e políticas, incluindo a <a className="underline" href="https://www.facebook.com/privacy/policy/">Política de Privacidade da Meta</a>.</p>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl font-semibold">5. Compartilhamento</h2>
      <p>Compartilhamos conteúdo e dados de conta com a rede social que você seleciona, na medida necessária para conectar a conta ou cumprir a publicação solicitada. Também utilizamos fornecedores de infraestrutura, banco de dados e envio de e-mails necessários à operação e à recuperação de acesso, compartilhando com cada um apenas os dados necessários à sua função no serviço.</p>
      <p>O Arcsync não vende os tokens de acesso nem usa os dados obtidos pela integração da Meta para publicidade. Integrantes autorizados do workspace podem acessar informações conforme seus papéis e permissões.</p>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl font-semibold">6. Armazenamento, segurança e cookies</h2>
      <p>As senhas são armazenadas em formato de hash e os tokens sociais são cifrados no servidor. Aplicamos controles técnicos para restringir o acesso aos dados, mas nenhum sistema conectado à internet pode ter segurança absoluta.</p>
      <p>O Arcsync usa cookies técnicos necessários à sessão de acesso e à proteção do fluxo de autorização OAuth. Esses cookies não têm a finalidade de rastrear sua navegação em outros sites.</p>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl font-semibold">7. Retenção e exclusão</h2>
      <p>Mantemos os dados enquanto forem necessários para prestar o serviço, manter a segurança, cumprir obrigações legais e tratar solicitações. Remover um post do calendário não apaga necessariamente o histórico interno nem uma publicação já enviada à rede.</p>
      <p>Você pode desconectar contas sociais nas configurações do Arcsync e revogar a autorização diretamente na plataforma. Para solicitar acesso, correção ou exclusão dos dados mantidos pelo Arcsync, consulte <Link className="underline" href="/data-deletion">Solicitar exclusão de dados</Link> e entre em contato pelo e-mail de suporte. O pedido é analisado pelo suporte e não é executado automaticamente nesta página. A exclusão no Arcsync não remove publicações já feitas nas redes sociais.</p>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl font-semibold">8. Seus direitos e contato</h2>
      <p>Você pode solicitar informações sobre o tratamento dos seus dados, correção de dados incompletos ou desatualizados, revogação de autorizações e exclusão quando aplicável. Para isso, use o contato indicado ao final desta página. Podemos solicitar informações razoáveis para confirmar a titularidade e proteger contas e workspaces compartilhados.</p>
      <p>Para integrações do Google e YouTube, o acesso também pode ser revogado em <a className="underline" href="https://myaccount.google.com/permissions">Permissões da Conta Google</a>; consulte a <a className="underline" href="https://policies.google.com/privacy">Política de Privacidade do Google</a>. Para outras redes, use as configurações de aplicativos e permissões da própria plataforma.</p>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl font-semibold">9. Alterações nesta política</h2>
      <p>Esta política pode ser atualizada para refletir mudanças no serviço ou nas obrigações legais. A versão vigente será publicada nesta página com a data da última atualização.</p>
      <p>Consulte também os <Link className="underline" href="/terms-service">Termos de Serviço</Link>.</p>
    </section>
  </PublicInfoLayout>;
}
