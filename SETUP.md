# 🚀 Instruções de Setup - GitHub Repository

Parabéns! O seu repositório Git foi inicializado localmente com sucesso. Siga os passos abaixo para:
1. Criar o repositório no GitHub
2. Fazer push do código
3. Publicar no GitHub Pages

## Passo 1: Criar Repositório no GitHub

1. Abra [GitHub.com](https://github.com/new)
2. Clique em **"New repository"**
3. Preencha os dados:
   - **Repository name**: `myTraining`
   - **Description**: "Plano de treino com imagens de exercícios"
   - **Visibility**: Public (essencial para GitHub Pages)
   - **Initialize this repository with**: NÃO selecione nada
4. Clique **"Create repository"**

## Passo 2: Conectar Repositório Local ao GitHub

Após criar o repositório no GitHub, execute estes comandos no terminal (PowerShell):

```powershell
cd "c:\Users\hugom\claude\myTraining"

# Adicionar o repositório remoto
git remote add origin https://github.com/leugiMoguH/myTraining.git

# Renomear branch para 'main' (se necessário)
git branch -M main

# Fazer push do código
git push -u origin main
```

## Passo 3: Configurar GitHub Pages

1. Vá ao repositório no GitHub: https://github.com/leugiMoguH/myTraining
2. Clique em **Settings** (engrenagem no topo)
3. Vá a **Pages** (menu esquerdo)
4. Sob "Build and deployment":
   - **Source**: Escolha "Deploy from a branch"
   - **Branch**: Selecione `main` e `/root`
5. Clique em **Save**
6. Aguarde 1-2 minutos
7. A sua página estará disponível em: https://leugiMoguH.github.io/myTraining

## Passo 4: Verificar o Deployment

- Abra o navegador em: https://leugiMoguH.github.io/myTraining
- Verifique se tudo está funcionando corretamente no telemóvel
- Teste os swipes e navegação

## ⚠️ Importante

- **NÃO faça alterações** diretamente no GitHub.com
- **Sempre faça changes localmente** e depois faça `git push`
- As imagens devem estar na pasta `images/`

## Próximos Passos

Depois de fazer push, você pode:

1. **Adicionar mais imagens** aos exercícios
2. **Fazer deploy automático** (já está configurado com GitHub Actions)
3. **Customizar a página** conforme necessário

## Comandos Úteis

```powershell
# Ver o status do repositório
git status

# Ver o histórico de commits
git log --oneline

# Fazer pull (atualizar do GitHub)
git pull origin main

# Ver remotes configurados
git remote -v
```

---

Quando estiver pronto, execute os comandos do **Passo 2** no seu terminal PowerShell!
