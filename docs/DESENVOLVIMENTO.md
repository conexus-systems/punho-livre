# Desenvolvimento

## Preparar o ambiente

```bash
npm install                      # Playwright (só para os testes e a arte da loja)
npm install --prefix server      # servidor das salas
npx playwright install chromium  # navegador dos testes
```

Requisitos: Node 22+ (o servidor roda em 18+). Para o Android: Java 17+, Maven, Python 3, curl e unzip.

## Dia a dia

- `npm start` abre o jogo em `http://localhost:8080/`. Com `?dev` no endereço ficam ativas as
  teclas de teste: F2 passo a passo, F6 MP infinito, F7 vida cheia, F8/F9 armas.
- `npm run check` confere a sintaxe e se todo arquivo de `web/src/` está no `index.html`.
- `npm test` roda tudo (cerca de 1 minuto). Um arquivo só: `node --test tests/specials.test.cjs`.

## Criar um lutador

1. Em `web/src/content/roster.js`, copie uma entrada de `ROSTER`: `id` novo, nome, cores,
   `look` (pele, cabelo, roupa, emblema), `stats` e `specials`.
2. Cada especial escolhe um `type` de `SPECIALS` (`web/src/content/moves.js`): `blast`, `chase`,
   `uppercut`, `rush`, `charge`, `slam`, `teleport`, `heal`, `spin` ou `frost`, com `tag` (a
   sequência de teclas, ex. `hit_Fa` = Defesa, frente, Ataque), `at` (quadro inicial, a partir
   de 240), `mp`, `injury` e `label`.
3. `npm test`: o teste de especiais confere se cada golpe sai e gasta MP.
4. Para um tipo de golpe novo, escreva uma função em `SPECIALS` seguindo as existentes:
   `B.chain(primeiroQuadro, lista de { pose, wait, itr, op... }, { name, state: 3 })`.

## Criar um cenário

Em `web/src/content/scenes.js`, acrescente uma entrada em `SCENES` (camadas desenhadas com
`layer(...)`; larguras maiores rolam mais rápido), um `FRONTS[id]` opcional (primeiro plano, que
passa na frente dos lutadores) e uma cor em `TONES`. Inclua o novo id em `STAGES`
(`web/src/engine/stage.js`) se quiser usá-lo na História.

## Ver os quadros de um lutador

Abra o jogo com `?dev`, e no console do navegador:

```js
const o = Assets.obj(1), sheet = new SpriteSheet(o.data.bmp);
sheet.draw(Game.ctx, o.data.frame[61].pic, 100, 100, false);
```

## Gerar o app

```bash
npm run apk       # dist/punho-livre.apk
npm run aab       # dist/punho-livre.aab
```

As duas assinam com uma chave de teste criada em `android/.tools/`. Para publicar, use a sua
chave (`KEYSTORE`, `KEYSTORE_PASS`, `KEY_ALIAS`) e siga [`store/CHECKLIST.md`](../store/CHECKLIST.md).
O pacote Android é `com.conexus.punholivre` e não pode mudar depois de publicado.

## Integração contínua

`.github/workflows/ci.yml` roda a conferência e os testes em cada push e pull request, e depois
gera o APK e o AAB como artefatos do GitHub Actions.
