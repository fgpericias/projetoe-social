# 🚀 Guia de Deploy — PrumoSST no Railway + Cloudflare

Passo a passo para colocar o PrumoSST no ar em produção.
Tempo estimado: **30 minutos** (na primeira vez).

---

## Visão geral

```
Você no PC  →  GitHub (código)  →  Railway (servidor)  ←  prumosst.com (Cloudflare)
```

1. O código sobe pro GitHub (privado)
2. Railway puxa do GitHub e sobe o servidor
3. Cloudflare aponta o domínio para o Railway

---

## PRÉ-REQUISITO — Colocar o código no GitHub

### 1. Criar repositório privado

1. Acesse **https://github.com** → faça login
2. Clique em **"New repository"** (botão verde)
3. Nome: `prumosst`
4. Marque **"Private"** (MUITO IMPORTANTE — código proprietário!)
5. Clique **"Create repository"**

### 2. Subir o código

Abra o **Prompt de Comando** (Win+R → `cmd`) e execute:

```bash
cd "C:\Users\Dell\OneDrive\Desktop\intergrador e pgr"

git init
git add .
git commit -m "PrumoSST - versão inicial"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/prumosst.git
git push -u origin main
```

*(Troque `SEU_USUARIO` pelo seu usuário do GitHub)*

⚠️ O `.gitignore` já protege: `.env`, `*.pfx`, `node_modules`, `data/` — esses arquivos **não sobem**.

---

## PASSO 1 — Criar conta no Railway

1. Acesse **https://railway.app**
2. Clique **"Login"** → **"Login with GitHub"**
3. Autorize o Railway a acessar seus repositórios
4. Verifique o e-mail se pedido

---

## PASSO 2 — Criar o projeto no Railway

1. No painel Railway, clique **"New Project"**
2. Selecione **"Deploy from GitHub repo"**
3. Escolha o repositório `prumosst`
4. Railway detecta automaticamente o `Procfile` e começa o deploy
5. Aguarde o build (1–3 minutos) — acompanhe os logs

---

## PASSO 3 — Configurar as variáveis de ambiente

1. No projeto Railway, clique na aba **"Variables"**
2. Clique **"New Variable"** para cada linha abaixo:

| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | uma senha longa e aleatória (ex: `Prumo@2025#SSTfirme!exato`) |
| `ADMIN_EMAIL` | `ellencristinealmeida@gmail.com` |
| `REQUIRE_AUTH` | `true` |
| `FRONTEND_URL` | `https://prumosst.com,https://www.prumosst.com` |
| `ESOCIAL_AMBIENTE` | `producao` (ou `homologacao` para testes) |
| `TRANSMISSOR_CPF` | seu CPF (só números) |
| `TRANSMISSOR_NOME` | seu nome completo |
| `PFX_BASE64` | conteúdo gerado pelo CONVERTER_BASE64.html |
| `PFX_PASSWORD` | senha do seu certificado .pfx |

> **Como gerar o PFX_BASE64:**
> Abra o arquivo `CONVERTER_BASE64.html` no navegador, selecione seu `.pfx` e copie o texto gerado.

3. Depois de adicionar todas as variáveis, clique **"Deploy"** para reiniciar

---

## PASSO 4 — Verificar que está funcionando

1. Na aba **"Deployments"**, clique no deploy mais recente
2. Veja os logs — deve aparecer:
   ```
   ✅ Servidor PrumoSST rodando na porta XXXX
   ```
3. Clique em **"View Logs"** e confira se não há erros
4. Na aba **"Settings"** → copie o domínio temporário (ex: `prumosst-production.up.railway.app`)
5. Abra esse endereço no navegador — o PrumoSST deve aparecer

---

## PASSO 5 — Comprar o domínio prumosst.com (Cloudflare)

1. Acesse **https://www.cloudflare.com/products/registrar**
2. Pesquise `prumosst.com`
3. Se disponível, clique **"Purchase"**
   - Preço: ~$10/ano (sem markup — Cloudflare cobra pelo custo real)
4. Complete o cadastro e pagamento

---

## PASSO 6 — Apontar o domínio para o Railway

### No Railway:

1. Vá em seu projeto → aba **"Settings"**
2. Seção **"Domains"** → clique **"Add Custom Domain"**
3. Digite `prumosst.com` → confirmar
4. Repita para `www.prumosst.com`
5. Railway mostra um **endereço CNAME** para cada — anote

### No Cloudflare (após comprar o domínio):

1. Acesse **https://dash.cloudflare.com**
2. Clique no domínio `prumosst.com`
3. Vá em **DNS → Records**
4. Apague qualquer registro A ou CNAME existente para `@` e `www`
5. Adicione os registros novos:

**Para prumosst.com (raiz):**
```
Tipo:    CNAME
Nome:    @
Destino: [endereço CNAME do Railway para prumosst.com]
Proxy:   ✅ Ativado (nuvem laranja)
TTL:     Auto
```

**Para www.prumosst.com:**
```
Tipo:    CNAME
Nome:    www
Destino: [endereço CNAME do Railway para www.prumosst.com]
Proxy:   ✅ Ativado (nuvem laranja)
TTL:     Auto
```

6. Aguarde de 5 a 30 minutos para propagar

---

## PASSO 7 — Testar tudo

1. Acesse `https://prumosst.com` no navegador
2. Deve aparecer o PrumoSST com cadeado verde (HTTPS)
3. Clique "Entrar com Google" — deve abrir o popup do Google
4. Faça login com seu Gmail de admin
5. Teste criar uma empresa e preencher dados

---

## Atualizar o sistema no Railway

Sempre que você fizer alterações no `index.html` ou `server.js`:

```bash
cd "C:\Users\Dell\OneDrive\Desktop\intergrador e pgr"
git add .
git commit -m "descrição do que mudou"
git push
```

Railway detecta automaticamente o push e faz o redeploy em ~2 minutos.

---

## Custos mensais estimados

| Serviço | Plano | Custo |
|---|---|---|
| Railway | Starter | $5/mês (~R$25) |
| Cloudflare (domínio) | Registrar | ~$10/ano (~R$5/mês) |
| Firebase Auth | Spark (gratuito) | R$0 |
| **Total** | | **~R$30/mês** |

---

## Backup do servidor

O Railway reinicia automaticamente em caso de falha.
Os dados das engenheiras ficam nos navegadores delas — não dependem do servidor para sobreviver.

Para backup do `users.json` (lista de usuárias autorizadas):

```bash
# No Railway: vá em seu projeto → Variables → Export
# Ou conecte via Railway CLI:
railway run cat backend/data/users.json > users_backup.json
```

---

*Este guia faz parte da documentação do PrumoSST.*
*Desenvolvido por Ellen Cristine Almeida — Firme. Exato. Íntegro.*
