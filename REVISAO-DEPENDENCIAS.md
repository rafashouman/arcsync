# Revisão de dependências — 02/11/2026

## Resultado

`npm audit --omit=dev --json`, após as atualizações: **zero vulnerabilidades conhecidas reportadas nas dependências de produção**. Isso é um resultado do catálogo npm nesta data, não uma garantia de ausência de falhas.

A auditoria completa ainda registra **16 alertas moderados**, associados à cadeia de lint e ao mesmo advisory de `minimatch`, [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). O advisory descreve consumo excessivo de recursos com padrões controlados pelo atacante. O pacote não consta na árvore de produção auditada; a exposição identificada é no ambiente de desenvolvimento/CI. Não aceitar padrões de lint ou configurações de fontes não confiáveis como parte de uma execução privilegiada.

## Alterações aplicadas

| Pacote | Antes | Depois |
|---|---|---|
| Next.js / eslint-config-next | 16.4.3 | 16.4.4 |
| React / React DOM | 19.3.0 | 19.3.1 |
| Tailwind / integração Turbopack | 4.3.3 | 4.3.4 |
| Tipos do Node | 20.19.43 | 24.19.2 |
| @types/mongoose | 5.11.96 | Removido; Mongoose já fornece tipos |

Declarado Node `>=24 <25`, consistente com o runtime local e o Docker. Lockfile atualizado. Acrescentado `npm run audit:production`. Mantidos TypeScript 5 e ESLint 9 nesta etapa para não misturar migrações principais com a preparação das integrações.

## Por que os alertas de desenvolvimento não foram zerados

A solução automática do npm sugeriu rebaixar ESLint para 4.0.0 e eslint-config-next para 0.2.4, incompatíveis com a configuração atual. Também não foi forçado `minimatch@11` em consumidores de versões antigas: isso mudaria o contrato da dependência sem validação dos respectivos mantenedores. Nenhum alerta foi ocultado ou classificado como resolvido.

Ação pendente: acompanhar versões compatíveis da cadeia ESLint/Next e repetir `npm audit`. Ao existir correção compatível, atualizar com lint, testes e build. Uma migração principal de ferramentas pode ser feita separadamente; não altera o resultado zero da auditoria de produção atual.

## Repetir a revisão

1. Usar Node 24 e instalar com `npm ci`.
2. Executar `npm run audit:production` e `npm audit`.
3. Executar `npm test`, `npx tsc --noEmit` e `npm run lint`.
4. Executar integrações no banco isolado e build Docker quando alterar runtime/conectores.

No Windows desta sessão, o registro npm exigiu a cadeia de certificados do sistema: `NODE_USE_SYSTEM_CA=1`. A validação TLS permaneceu ativada. Nenhum `strict-ssl=false` ou equivalente foi aplicado.

## Nova conferência — 02/11/2026

Repetida a consulta ao registro npm: 16 alertas moderados de desenvolvimento e zero alertas de produção. ESLint mais recente consultado: 10.14.0, ainda declarando minimatch ^10.2.6. Migrar apenas o ESLint não elimina o advisory, cuja correção indicada é minimatch 11.0.1. A decisão permanece aguardar cadeia compatível, sem forçar substituição principal de dependências transitivas. Fontes: metadados `npm view eslint@latest` e advisory https://github.com/advisories/GHSA-g3hv-75wg-m249. Nenhuma atualização de pacote foi aplicada nesta conferência.
