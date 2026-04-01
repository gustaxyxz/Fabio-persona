# Como usar o modelo da van no jogo

O arquivo atual do modelo esta em formato `.blend`.

O navegador (Three.js) nao carrega `.blend` direto. Para aparecer no jogo, exporte para `.glb`.

## Passo rapido no Blender

1. Abra o arquivo `ad1be740d7ec4761ab57ea20315fc887.blend` no Blender.
2. Va em File > Export > glTF 2.0.
3. Escolha formato `glTF Binary (.glb)`.
4. Salve com o nome `zuk.glb` nesta pasta:
   - `free-zuk-3d-model/source/zuk.glb`

## Depois de exportar

- Recarregue `game.html` no navegador.
- O jogo vai substituir automaticamente a van simples pelo modelo 3D.

## Observacao

Se `zuk.glb` nao existir, o jogo usa fallback com van geometrica e mostra um aviso na tela.
