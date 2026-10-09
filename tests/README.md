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
