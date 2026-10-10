# Testes no navegador

O aplicativo não precisa de dependências. Os testes usam Playwright e o Chromium
instalado no ambiente, com um contexto de navegador isolado e relógio simulado.
Nenhum dado do navegador do usuário é alterado.

Inicie o servidor na raiz do repositório:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Neste ambiente, execute:

```sh
NODE_PATH=/workspace/.onboarding-tools/node_modules node tests/subjects.cjs
NODE_PATH=/workspace/.onboarding-tools/node_modules node tests/portuguese.cjs
NODE_PATH=/workspace/.onboarding-tools/node_modules node tests/modes-championship.cjs
```

Em outro ambiente, instale `playwright@1.58.2` em um diretório externo ao
repositório e configure `NODE_PATH` para o `node_modules` desse diretório.
Os testes esperam Chromium em `/usr/bin/chromium` e o servidor na porta 8000.

Verifica criação, edição, exclusão, duplicatas, persistência, vinculação da matéria
à sessão, aerodinâmica para qualquer área, preservação do histórico, nomes tratados como
texto, proteção da última matéria, layout móvel e migração de registros antigos.

O teste de português verifica a interface nos seis temas, a preservação dos
nomes e estilos das equipes em inglês, os cinco modos de sessão, os controles,
as mensagens de conclusão e o layout móvel.

O teste de modos e campeonato verifica as três etapas da classificação,
avaliações por volta, início/pausa/reinício, troca de circuito, pausas sem
pontuação, contagem de tempo em abas suspensas, P1 a P22, viradas de semana
e ano, prêmios persistentes, setas de posição e os seis temas.

O teste de temas pode usar uma porta alternativa:

```sh
BASE_URL=http://127.0.0.1:8001/ NODE_PATH=/workspace/.onboarding-tools/node_modules node tests/themes.cjs
```

Ele verifica os cinco temas revisados em 320, 390, 768 e 1440 pixels, além de
cronômetro, matérias, circuitos e cards do campeonato. A Red Bull participa das
verificações funcionais, mas mantém o estouro de largura preexistente em telas
estreitas: esse tema foi preservado conforme solicitado.

O teste de layout cobre monitores ultrawide (3440×1440), QHD (2560×1440),
Full HD (1920×1080), notebooks (1366×768), tablets e celulares, nos seis temas:

```sh
BASE_URL=http://127.0.0.1:8002/ NODE_PATH=/workspace/.onboarding-tools/node_modules node tests/layout.cjs
```

Todos os testes aceitam `BASE_URL` para usar outra porta local. O layout compartilhado
agora mantém também a Red Bull dentro da tela, preservando sua identidade visual.

O teste específico da Aston Martin compara o registro de sessões com as outras
cinco equipes, verifica as mensagens da equipe após trocas, os alertas de energia,
a seleção pelo teclado e formulários expandidos em oito larguras de tela:

```sh
BASE_URL=http://127.0.0.1:8002/ NODE_PATH=/workspace/.onboarding-tools/node_modules node tests/astonmartin.cjs
```
