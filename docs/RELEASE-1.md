# Release 1 — Data Safety

Base: `87c8392c8a14a317c31a7a812f0601e06880c2d3`. Alterações locais na branch `codex/release-1-data-safety`. Nenhuma publicação, push ou mudança no site hospedado.

## Diagnóstico e escopo

O `index.js` coordenava estado, totais, energia, avaliação e apresentação. O `sessionManager.js` já separava a contagem de tempo e os modos; o módulo de circuitos chamava sua configuração. `storage.js` normalizava formatos antigos, mas gravava o objeto inteiro. Matérias, equipe e campeonato possuíam chaves independentes no localStorage.

Os defeitos de sobrescrita entre abas e perda de avaliação pendente decorriam dessa gravação por snapshot e da permanência da avaliação somente em memória. Os outros quatro defeitos são de energia, recuperação de sessão e tratamento da indisponibilidade do armazenamento; continuam reservados à Release 2.

## Implementação incremental

- `js/infrastructure/database.js`: esquema IndexedDB v1 e transações. Sucesso é informado somente em `transaction.oncomplete`; transações de escrita pedem durabilidade estrita.
- `js/infrastructure/migration.js`: migração atômica, marcador de conclusão, backup da origem e validação dos registros detalhados. Duas abas disputando a migração são serializadas pelo banco.
- `js/infrastructure/repositories/studyRepository.js`: operações por volta e avaliação, leitura de projeções e adaptador dos campos auxiliares.
- `js/infrastructure/crossTabSync.js`: avisos por BroadcastChannel e reconciliação por foco, visibilidade e consulta periódica. Nenhum aviso contém o histórico como dado autoritativo.
- `index.js`: inicialização assíncrona, conclusão e avaliação aguardando confirmação, recuperação de avaliações pendentes, fila explícita de pendências externas e avisos de erro.
- `js/sessionManager.js`: pausa no fim da volta enquanto a gravação está em curso; transições existentes aguardam persistência. Uma recusa permite repetir a mesma volta com o mesmo identificador.
- `js/storage.js`: mantém os leitores e normalizadores antigos para migração. `saveData` deixa de gravar histórico e totais e passa a salvar somente campos auxiliares no banco.
- `js/track/trackRendering.js`: troca de circuito espera a avaliação pendente e respeita operações de gravação em curso.
- `tests/browser.cjs`, `tests/run.cjs` e suítes: execução portátil, leitura do banco real, espera das operações assíncronas, regressões e injeção de falhas.

Não foram introduzidas dependências de produção nem um framework. O Playwright continua sendo a ferramenta de teste já utilizada. CSS, temas e fórmulas de pontuação/energia foram preservados.

## Modelo de integridade

O esquema desta etapa tem três stores: `laps`, `evaluations` e `metadata`. Cada nova volta recebe UUID estável antes da primeira tentativa de gravação. Uma confirmação repetida da mesma volta não cria outro registro. O estado da volta é `PENDING_EVALUATION` ou `EVALUATED`.

A avaliação usa a identidade da volta como chave única e referência. Sua inserção e a atualização do estado da volta ocorrem na mesma transação. A primeira confirmação vence; confirmações subsequentes não modificam a avaliação existente. Isso é uma política de criação idempotente, não uma interface de edição de avaliações.

As novas estatísticas são derivadas das voltas. Avaliações ausentes não contam como notas zero: ficam fora das métricas de avaliação, enquanto seu tempo e sua volta já entram nos totais. As métricas antigas que dependiam de avaliações continuam usando somente avaliações disponíveis.

Para compatibilidade com o histórico sem detalhes, a migração conserva uma base agregada imutável. Não é possível reconstruir, com fidelidade, todas as voltas antigas a partir de um histórico que já foi limitado a 500 avaliações. Essa base não é incrementada por abas: novas voltas são adicionadas exclusivamente por seus registros. Os registros detalhados migrados estão marcados como legados e não são contados novamente sobre a base histórica.

Os totais antigos potencialmente inconsistentes não são inventados nem substituídos por estimativas. O material de origem fica preservado para uma futura ferramenta de reconciliação.

## Migração e compatibilidade

1. Abrir o banco e consultar o marcador de migração.
2. Se ainda não houver migração, ler as quatro chaves de origem e validar o histórico.
3. Na mesma transação, preservar as strings originais, a base agregada, as avaliações válidas e o marcador.
4. Se qualquer escrita falhar, a transação inteira é desfeita. O próximo início pode tentar novamente.
5. Depois do marcador, o histórico atual vem do IndexedDB. Reabrir uma aba não importa novamente o snapshot antigo.

A origem não é apagada nem regravada pelo histórico novo. Registros detalhados inválidos não entram nas métricas; são mantidos na cópia bruta e há aviso com a quantidade separada. JSON inválido impede a migração e exibe erro, sem marcar a instalação como migrada.

Matérias, seleção de equipe e premiações continuam usando seus módulos e chaves atuais nesta etapa, além da cópia inicial de segurança no banco. Energia e último circuito usam o adaptador de campos auxiliares. Os repositórios próprios para esses domínios serão introduzidos quando suas regras forem extraídas nas próximas releases; não foram criados arquivos vazios para simular essa separação.

O snapshot de localStorage preservado é uma origem de migração, não um backup atualizado. Voltar ao aplicativo antigo depois de estudar nesta versão não mostrará os registros novos. O backup/exportação do banco atual pertence à Release 2.

## Comportamento diante de falhas

Uma volta recusada não é apresentada como salva. O cronômetro fica parado, o aviso permanece e INICIAR permite repetir a operação com a mesma identidade. Troca de modo, reset e circuito ficam protegidos enquanto essa volta não é salva. A identidade em memória não sobrevive ao fechamento da aba quando a gravação nunca foi confirmada; o aviso orienta a manter a aba aberta.

Uma avaliação recusada mantém o formulário e a pendência persistida. Avaliação e estado não ficam parcialmente atualizados.

Indisponibilidade inicial do IndexedDB ou origem ilegível exibe erro e preserva dados existentes. Nesta Release 1, a inicialização é interrompida de forma explícita; funcionamento temporário em memória e inicialização completa sem armazenamento ainda não estão implementados. Tampouco há garantia contra limpeza manual dos dados do site ou perda física do dispositivo.

Os campos auxiliares de energia ainda não possuem um livro de eventos transacional; duas abas atuando sobre energia no mesmo dia exigem o domínio específico previsto na Release 2. Isso não permite sobrescrever voltas ou avaliações.

## Validação e limitações

Consulte `tests/README.md` para comandos, cobertura, execução portátil e testes de regressão. Os resultados persistidos são lidos do IndexedDB. As falhas de quota/escrita são simuladas por abortos de transações reais; disco cheio de verdade e variação de quota por navegador não foram ensaiados.

A execução usa Windows e Edge baseado em Chromium com Playwright 1.62.1. Não houve validação em Linux, Firefox, WebKit, dispositivos físicos ou perfil real do usuário. Não foi feito teste de carga com centenas de milhares de voltas. A projeção lê registros para calcular indicadores; uma projeção incremental transacional poderá ser necessária em escala maior.

## Pendências para a próxima release

- Máquina de estados formal e recuperação do cronômetro, sem contar tempo com a aplicação fechada.
- Estado de energia separado do sono, consumo e recuperação por eventos e virada do dia.
- Acesso seguro às preferências de equipe/matérias e modo temporário em memória.
- Exportação e importação atômica com versão de esquema e escolha explícita de restauração.
- Migração progressiva dos outros domínios e extração adicional do `index.js`.

Não avançar automaticamente: primeiro revisar os resultados desta etapa e a integridade dos registros. Arquivos vazios existentes e `index.css` foram mantidos, pois sua eventual remoção pertence à revisão de manutenção da Release 3.
