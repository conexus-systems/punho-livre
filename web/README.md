# web/

A página do jogo. O jogo em si é o Rust de [`../rust/`](../rust/), compilado para WebAssembly.

- `index.html`, `style.css`: página, canvas, controles de toque e formulário de rede
- `fonts/`: fonte Bangers (SIL OFL 1.1)
- `pkg/`: **gerado** por `npm run build` (não vai para o git): `punho.js` (cola do wasm-bindgen),
  `punho_bg.wasm` (o jogo) e `punho_wasm.js` (o mesmo .wasm em base64, que o `index.html` usa para
  funcionar aberto direto do disco e dentro do app Android)

Veja [../docs/ARQUITETURA.md](../docs/ARQUITETURA.md).
