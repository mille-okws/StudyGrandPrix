# Testes do Study Grand Prix

A aplicação continua sem dependências de produção. Os testes usam Node.js e Playwright em contextos de navegador isolados. Nenhum teste usa o perfil pessoal do usuário.

## Preparação

Na raiz do projeto, instale o Playwright (a validação desta release usou 1.62.1):

```sh
npm install --no-save --no-package-lock playwright@1.62.1
npx playwright install chromium
```

Inicie um servidor separado na raiz:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Execute todas as suítes, em Windows ou Linux:

```sh
node tests/run.cjs
```

Por padrão, os testes usam o Chromium gerenciado pelo Playwright. Para usar um executável existente, configure `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Para outra porta, configure `BASE_URL`. Capturas ficam no diretório temporário do sistema, em `study-grand-prix-tests`; `TEST_ARTIFACT_DIR` permite mudar esse destino.

Exemplo PowerShell:

```powershell
$env:BASE_URL = 'http://127.0.0.1:8000/'
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
node tests/run.cjs
```

Exemplo Linux:

```sh
BASE_URL=http://127.0.0.1:8000/ node tests/run.cjs
```

Se o Playwright já estiver instalado fora do projeto, `NODE_PATH` pode indicar o diretório `node_modules` correspondente. Não existe mais dependência de `/usr/bin/chromium`.

## Cobertura existente

- `subjects.cjs`: criação, edição, exclusão, duplicatas, nomes tratados como texto, persistência e associação da matéria ao início da sessão, preservação do histórico e migração de matérias antigas.
- `portuguese.cjs`: português nos controles, cinco modos, mensagens e seis identidades de equipe.
- `themes.cjs`: equipes, circuitos, controles e componentes de campeonato em quatro larguras.
- `layout.cjs`: 48 combinações de seis equipes e oito telas, de 320 px a 3440 px; pista, hierarquia, sobreposição e controles. Inclui Red Bull, cujo layout compartilhado já evita o estouro antigo.
- `astonmartin.cjs`: identidade, mensagens após trocar de equipe, estados de alerta, teclado, sessões e formulários em oito larguras.
- `modes-championship.cjs`: classificação completa, corrida de 56 voltas, pausa, retomada, reset, troca de circuito/modo, avaliações e regras semanais P1–P22, prêmios, viradas de semana e ano.

Essas suítes passaram a aguardar a confirmação assíncrona do banco e a consultar a projeção do IndexedDB, em vez de interpretar o localStorage legado como fonte atual. Os fixtures que simulam instalações antigas limpam somente o banco do contexto de teste antes da migração.

## Integridade — Release 1

`integration/data-safety.cjs` verifica 15 cenários com resultados persistidos:

1. Duas abas concluem e avaliam simultaneamente sem perda.
2. Recarregamento com avaliação pendente e confirmação idempotente.
3. Repetição de volta, rejeição de dados inválidos e proteção contra snapshots antigos.
4. Migração de histórico agregado e detalhado, preservação da origem e reexecução.
5. Migração interrompida, rollback completo e nova tentativa.
6. JSON inválido sem sobrescrever a origem.
7. Recusa simulada de gravação de volta e repetição segura.
8. Recusa de avaliação sem atualizar parcialmente a volta.
9. Preservação de mais de 500 avaliações.
10. Reconciliação por foco sem BroadcastChannel.
11. Duas abas iniciando a migração simultaneamente.
12. Fechamento de aba e confirmação da mesma pendência por duas abas.
13. Separação de avaliações antigas inválidas, aviso e preservação da cópia bruta.
14. IndexedDB indisponível com aviso explícito.
15. BroadcastChannel exposto mas negado, com inicialização e gravação funcionando.

`integration/legacy-regressions.cjs` contém dois testes comportamentais executáveis também contra o commit anterior: recarregar uma avaliação pendente e concluir em duas abas. Ambos falham em `87c8392` e passam nesta release. Ao executar contra a versão antiga em outro servidor, configure `EXPECT_LEGACY=1` para dispensar o indicador assíncrono de inicialização introduzido nesta release.

Falhas de gravação são simuladas por aborto de transações reais do IndexedDB. Isso testa rollback e tratamento da recusa; não simula esgotamento físico do disco nem mede a quota real de cada navegador. A validação foi realizada no Windows com Edge/Chromium. O runner é portátil, mas Linux, Firefox e WebKit não foram executados nesta etapa.

## Escopo posterior

Recuperação do cronômetro, máquina de estados completa, regras de energia, modo temporário quando o armazenamento falha e backup/importação pertencem à Release 2. As suítes atuais de energia verificam o comportamento que já existia; não comprovam que os defeitos adiados foram corrigidos.
