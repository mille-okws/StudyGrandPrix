# Stints e Google Agenda

## Avaliações

As voltas novas são registros de progresso e não criam avaliações. Um `StudyBlock` é aberto quando o usuário inicia o estudo, recebe as voltas concluídas e é fechado ao entrar em uma pausa estruturada ou ao terminar a corrida. O fechamento cria no máximo uma avaliação `STUDY_BLOCK`. Pausas técnicas do botão do cronômetro mantêm o mesmo bloco.

Avaliações antigas continuam sendo lidas como registros `LAP`. Elas não são convertidas automaticamente para blocos. O histórico novo expõe `studyBlocks`, `blockEvaluations`, total de voltas e total de avaliações separadamente.

## Google Agenda

O aplicativo grava primeiro o bloco e seus `StudySegments`, depois enfileira uma operação `UPSERT_EVENT` por segmento no IndexedDB. A fila usa os estados `PENDING`, `SYNCING`, `SYNCED` e `ERROR`, com lease, recuperação de operações abandonadas, tentativa posterior e backoff. O ID remoto é uma codificação hexadecimal determinística do bloco e segmento, válida para a restrição base32hex da API, evitando duplicação e permitindo atualizar a descrição quando a avaliação for preenchida depois.

O adaptador usa Google Identity Services e prioriza `calendar.app.created`, que permite criar uma agenda secundária e gerenciar seus eventos. O Client ID público pode ser configurado pelo deploy em `window.STUDY_GRAND_PRIX_CONFIG.googleClientId`; o campo manual fica restrito à configuração de desenvolvimento. Nenhum client secret ou token é persistido. O token fica em memória e precisa ser autorizado novamente após recarregar a página. A sincronização é opcional e não impede o estudo offline.

O calendário interno utiliza os segmentos locais e continua disponível sem uma conta Google. Cada pit stop cria um novo bloco, portanto o descanso entre stints não entra no evento seguinte. Pausas técnicas fecham um segmento e o retorno cria outro, sem contabilizar o intervalo parado.

## Limitações verificadas

- A configuração OAuth precisa de um Client ID criado no Google Cloud e de uma origem autorizada.
- A sincronização automática depende de a aba estar aberta e autorizada; o aplicativo não promete executar trabalho com o navegador completamente fechado.
- A cor da matéria é mapeada para `colorId` do Google por uma configuração JSON local. A API do Calendar não oferece a mesma paleta arbitrária do CSS das equipes.
- O adaptador foi validado com simulações de API; credenciais reais não fazem parte da suíte automatizada.
