import PublicInfoLayout from '@/src/components/PublicInfoLayout';
export default function SupportPage() {
  return <PublicInfoLayout title="Suporte">
    <p>Em caso de falha, consulte o monitoramento e o histórico do post. Se o resultado estiver incerto, confira a conta social antes de criar outra publicação.</p>
    <p>Para atendimento, envie ao contato abaixo a rede, o nome do workspace, o horário e a mensagem apresentada. Não envie senhas, tokens ou chaves de acesso.</p>
    <p>Autorizações expiradas podem ser renovadas ou reconectadas em Configurações → Contas sociais.</p>
  </PublicInfoLayout>;
}
