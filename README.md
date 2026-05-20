# 💪 Plano de Treino

Uma aplicação web moderna e responsiva para visualizar um plano de treino completo com imagens detalhadas de cada exercício.

## 🎯 Funcionalidades

- 📱 **Responsivo**: Funciona perfeitamente em mobile, tablet e desktop
- 🖼️ **Galeriade Exercícios**: Múltiplas imagens por exercício com navegação suave
- 👆 **Touch-Friendly**: Swipes funcionais em dispositivos móveis
- 🎨 **Design Moderno**: Interface limpa com tema dark e gradientes
- ⚡ **Performance**: Carregamento rápido e otimizado
- 📊 **Organizado por Dia**: Plano de treino dividido por dias da semana

## 📅 Dias de Treino

- **Segunda**: Peito e Tríceps
- **Terça**: Costas e Bíceps
- **Quarta**: Pernas
- **Quinta**: Ombros e Core
- **Sexta**: Full Body
- **Sábado**: Cardio e Core
- **Domingo**: Descanso Ativo

## 🖥️ Visualização

Para visualizar a aplicação localmente:

1. Clone o repositório
2. Abra `index.html` no navegador
3. Navegue entre os dias e exercícios

## 🌐 GitHub Pages

Este projeto está publicado no GitHub Pages e pode ser acedido em:
[https://seu-username.github.io/myTraining](https://seu-username.github.io/myTraining)

## 📁 Estrutura de Ficheiros

```
myTraining/
├── index.html           # Página principal
├── README.md           # Este ficheiro
├── .gitignore          # Ficheiros a ignorar no Git
└── images/             # Imagens dos exercícios
    ├── segunda/
    ├── terca/
    ├── quarta/
    ├── quinta/
    ├── sexta/
    ├── sabado/
    └── domingo/
```

## 🎮 Como Usar

1. **Navegar por Dias**: Clique nos abas no topo para mudar de dia
2. **Ver Exercícios**: Cada exercício tem um ou mais imagens
3. **Navegar Imagens**: Use os botões "Prev/Next" ou faça swipe no telemóvel
4. **Ver Detalhes**: Observe o número de séries e repetições para cada exercício

## 🎨 Customização

Para adicionar mais imagens a um exercício, edite o `index.html` e adicione URLs na array `images` do exercício respetivo.

### Exemplo:
```javascript
{
  name: "Nome do Exercício",
  series: 3,
  reps: "8-12",
  images: [
    "/images/dia/imagem1.jpg",
    "/images/dia/imagem2.jpg",
    "/images/dia/imagem3.jpg"
  ]
}
```

## 🚀 Deployment

### GitHub Pages (Automático)

1. Faça push do seu código para o GitHub
2. Vá a Settings > Pages
3. Escolha "Deploy from a branch"
4. Selecione `main` branch
5. A página estará disponível em `https://seu-username.github.io/myTraining`

## 📱 Compatibilidade

- Chrome/Edge (Mobile e Desktop)
- Firefox (Mobile e Desktop)
- Safari (iOS e macOS)
- Qualquer navegador moderno

## 💡 Dicas

- Use imagens em formato JPG ou PNG
- Mantenha imagens com aspect ratio similar para melhor apresentação
- Teste em múltiplos dispositivos antes de publicar
- Use compressão de imagens para melhor performance

## 📝 Licença

Este projeto é de uso pessoal.

---

Desenvolvido com ❤️ para um treino mais eficiente!
