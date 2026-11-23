# MotionPy — versão com rastreamento de mãos ao vivo

## Executar no Windows
1. Extraia a pasta do projeto.
2. Abra `MotionPy_SIC_26-main` no VS Code.
3. Abra o terminal integrado nessa pasta.
4. Execute `python main.py`.
5. Acesse `http://127.0.0.1:8000` se o navegador não abrir automaticamente.
6. Entre em **Praticar**, clique em **Ativar Câmera** e permita o acesso à webcam.
7. Mantenha a mão inteira visível, com boa iluminação e fundo simples.

## O que foi ajustado
- MediaPipe Hands no navegador para localizar até duas mãos continuamente.
- Desenho dos 21 pontos de referência e conexões dos dedos sobre o vídeo.
- Indicador de estado: procurando mãos, mão rastreada ou movimento detectado.
- Teachable Machine executado continuamente para classificar configurações estáticas das mãos quando uma mão é localizada.
- Erros de carregamento de bibliotecas/modelo exibidos na interface e no console.
- Caminhos do modelo mantidos relativos à pasta `frontend/modelo_js`.

## Limitação importante
O modelo Teachable Machine incluído foi treinado como classificador de imagens (A, B, C, Oi, casa, E, I, O, U e tchau). O rastreamento MediaPipe detecta a mão e seu deslocamento em tempo real, mas o classificador atual não aprende a sequência temporal necessária para traduzir sinais dinâmicos de LIBRAS. Para reconhecer semanticamente movimentos como “tchau”, será necessário gravar exemplos em vídeo/séries de landmarks e treinar um modelo temporal (por exemplo, LSTM/GRU ou Transformer).

## Requisitos
- Python 3 instalado para iniciar o servidor HTTP local.
- Navegador atualizado (Chrome ou Edge recomendado).
- Webcam e conexão com a internet para carregar TensorFlow.js, Teachable Machine e MediaPipe via CDN.
