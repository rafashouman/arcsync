import PublicInfoLayout from '@/src/components/PublicInfoLayout';
export default function DataDeletionPage() {
  return <PublicInfoLayout title="Solicitar exclusão de dados">
    <p>Entre em contato pelo e-mail de suporte indicado abaixo, usando o e-mail cadastrado no FeedSync. Informe o workspace e se deseja remover uma conexão social ou solicitar exclusão da sua conta e dados associados.</p>
    <p>O responsável pelo serviço verificará a titularidade e o alcance do pedido, incluindo conteúdos compartilhados com equipes. Não envie senhas ou tokens.</p>
    <p>A exclusão de um rascunho no calendário mantém seu histórico interno. A solicitação de exclusão de dados é um procedimento separado, tratado pelo suporte, e não é realizada automaticamente nesta página.</p>
    <p>Para impedir novos acessos, desconecte a conta nas configurações e revogue a autorização na própria rede. Posts já publicados devem ser removidos diretamente na rede social.</p>
  </PublicInfoLayout>;
}
