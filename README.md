# Contagem Celular · NCTBio – Faculdade de Odontologia UFPel

App web (HTML/CSS/JS puro, sem dependências) para contagem celular em hemocitômetro e teste de viabilidade com Azul de Trypan. Funciona em navegadores de PC e celular.

## Publicar no GitHub Pages
1. Crie um repositório no GitHub (ex.: `contagem-celular`).
2. Envie os arquivos `index.html`, `styles.css`, `app.js` e este `README.md` para a raiz do repositório (botão **Add file → Upload files**).
3. Vá em **Settings → Pages**, em *Source* escolha **Deploy from a branch**, branch `main`, pasta `/ (root)` e salve.
4. Em 1–2 minutos o app estará em `https://SEU-USUARIO.github.io/contagem-celular/`.

## Cálculos
- **Contagem:** média = soma ÷ quadrantes contados; células/mL = média × 10.000; total = células/mL × volume.
- **Viabilidade:** não-coradas = total − coradas; viabilidade = não-coradas ÷ total × 100;
  células viáveis/mL = não-coradas ÷ quadrantes × 10.000 × 2; total = viáveis/mL × volume do criotubo.

Criado por Leandro Perelló Duro.
