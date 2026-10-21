# Validação da integração com o Google Agenda

## Escopo e segurança

O padrão da aplicação usa `https://www.googleapis.com/auth/calendar.app.created`. Esse escopo cria uma agenda secundária e permite consultar, criar, alterar e excluir eventos nela. A escolha segue o menor privilégio descrito na [documentação oficial de escopos do Google Calendar](https://developers.google.com/workspace/calendar/api/auth). A seleção de uma agenda preexistente pode exigir autorização incremental com `calendar.events` ou um escopo de gerenciamento mais amplo; essa autorização não deve ser solicitada automaticamente.

O Client ID é público e deve ser definido na configuração de deploy como `window.STUDY_GRAND_PRIX_CONFIG.googleClientId`. Client secrets não pertencem ao frontend. O token GIS permanece em memória e é descartado ao expirar ou desconectar. Em produção, o domínio publicado e o endereço de desenvolvimento precisam estar cadastrados em **Authorized JavaScript origins** no cliente OAuth.

## Identidade e idempotência

Cada segmento usa um ID local estável. `eventIdFor(blockId, segmentId)` codifica os identificadores em hexadecimal, que é um subconjunto válido do base32hex exigido pela [referência oficial de eventos](https://developers.google.com/workspace/calendar/api/v3/reference/events). A sincronização usa `PUT` no mesmo calendário e no mesmo ID; repetir uma requisição depois de uma queda de conexão atualiza o evento existente em vez de criar outro.

## Fila offline

Os segmentos são persistidos localmente antes de entrar em `syncQueue`. Cada operação possui lease de 60 segundos. Uma operação `SYNCING` cujo lease venceu volta a `PENDING` na inicialização ou antes de uma nova tentativa. Erros de rede, HTTP 429 e HTTP 5xx usam backoff; expiração de autorização, permissão insuficiente e calendário removido ficam em `ERROR` sem loop infinito. A aquisição é confirmada em uma transação IndexedDB, e o BroadcastChannel/interface não é usado como garantia de exclusão mútua.

## Validação simulada

Executar a suíte sem credenciais reais:

```text
node tests/integration/google-sync.cjs
node tests/integration/segments-sync.cjs
```

Esses cenários verificam IDs estáveis, eventos por segmento, lease válido, recuperação de lease expirado, backoff de erro transitório e preservação da fila.

## Validação real controlada

Somente após configurar um Client ID de teste e autorizar explicitamente uma conta:

1. Conectar pelo botão Google Agenda.
2. Criar a agenda `Study Grand Prix 🏁`.
3. Estudar um segmento, fazer pausa técnica e estudar outro segmento.
4. Entrar em pit stop e preencher uma avaliação.
5. Confirmar dois eventos, com a pausa excluída dos horários.
6. Recarregar, sincronizar novamente e confirmar que não há duplicações.
7. Revogar a autorização e confirmar que os registros locais permanecem disponíveis.

Essa validação real não é executada automaticamente pela suíte e não deve usar uma agenda pessoal sem autorização do proprietário.
