# 🔥 Guia Firebase — Login Google no PrumoSST

Passo a passo completo para configurar o login com Google.
Tempo estimado: **10 minutos**.

---

## Por que o Firebase?

O Firebase é um serviço do Google **gratuito** (até 10.000 logins/mês) que cuida de toda a parte de autenticação. Você não precisa guardar senha de ninguém — o Google verifica a identidade.

---

## PASSO 1 — Criar o projeto Firebase

1. Abra: **https://console.firebase.google.com**
2. Faça login com seu Gmail (ellencristinealmeida@gmail.com)
3. Clique no botão grande **"Criar um projeto"**
4. Nome do projeto: `PrumoSST` → clique **Continuar**
5. Google Analytics: pode deixar desativado → clique **Criar projeto**
6. Aguarde (uns 30 segundos) → clique **Continuar**

---

## PASSO 2 — Ativar o login com Google

1. No menu lateral esquerdo, clique em **Authentication**
   *(ícone de pessoa com chave)*
2. Clique na aba **"Sign-in method"**
3. Na lista, clique em **Google**
4. Clique no botão de toggle para **Ativar** (fica azul)
5. Em "E-mail de suporte do projeto", selecione seu Gmail
6. Clique **Salvar**

✅ Pronto — o Google está autorizado como método de login.

---

## PASSO 3 — Registrar o app web

1. Clique na **engrenagem ⚙** no canto superior esquerdo
2. Clique em **"Configurações do projeto"**
3. Role a página para baixo até "Seus apps"
4. Clique no ícone **`</>`** (Web)
5. Nome do app: `PrumoSST Web`
6. **NÃO** marque "Firebase Hosting" (você está usando Railway)
7. Clique **"Registrar app"**

---

## PASSO 4 — Copiar as credenciais

Depois de registrar, o Firebase mostra um bloco de código assim:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "prumosst.firebaseapp.com",
  projectId: "prumosst",
  storageBucket: "prumosst.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

**Copie SOMENTE o objeto dentro das chaves `{...}`**, no formato JSON:

```json
{
  "apiKey": "AIzaSy...",
  "authDomain": "prumosst.firebaseapp.com",
  "projectId": "prumosst",
  "storageBucket": "prumosst.appspot.com",
  "messagingSenderId": "123456789",
  "appId": "1:123456789:web:abcdef"
}
```

*(As aspas duplas são importantes — é formato JSON, não JavaScript)*

---

## PASSO 5 — Configurar no PrumoSST

1. Abra o PrumoSST (localhost:3001 ou prumosst.com)
2. Na tela de login, clique em **"⚙ Configurar Firebase"**
3. Cole o JSON copiado no campo de texto
4. Clique **"Salvar configuração"**
5. O botão **"Entrar com Google"** ficará ativo

---

## PASSO 6 — Autorizar os domínios

Para o login funcionar no domínio de produção:

1. No Firebase Console → **Authentication**
2. Aba **"Settings"** (Configurações)
3. Seção **"Authorized domains"**
4. Clique **"Add domain"** e adicione:
   - `prumosst.com`
   - `www.prumosst.com`
   - `localhost` (já deve estar lá para desenvolvimento)

---

## Gerenciar usuárias no Firebase

Vá em **Authentication → Users** para ver todas as pessoas que já fizeram login.

| Ação | Como fazer |
|---|---|
| Ver quem acessou | Authentication → Users → lista todos |
| Desativar alguém | Clica nos 3 pontinhos ao lado → "Disable account" |
| Reativar | Mesmos 3 pontinhos → "Enable account" |
| Excluir | Mesmos 3 pontinhos → "Delete account" |

⚠️ **Importante:** desativar/excluir no Firebase é uma camada extra de segurança. O controle principal de acesso fica no painel admin do PrumoSST (whitelist de e-mails).

---

## Plano gratuito do Firebase

O plano gratuito (Spark) inclui:
- **10.000 autenticações/mês** — suficiente para centenas de engenheiras
- Sem custo de cartão de crédito para configurar
- Se passar do limite: cobrado por $0,0055 por autenticação adicional (menos de R$0,03)

Para o porte do PrumoSST, **o plano gratuito é mais que suficiente**.

---

## Problemas comuns

### "Domínio não autorizado"
→ Você esqueceu de adicionar o domínio em Authentication → Settings → Authorized domains.

### "Popup fechou sem fazer login"
→ O navegador bloqueou o popup. Permita popups para prumosst.com.

### "Acesso negado após login Google"
→ O e-mail não está na whitelist do PrumoSST. Acesse com seu e-mail de admin e adicione o e-mail dela no painel admin.

### "Firebase não configurado"
→ O JSON não foi salvo corretamente. Tente novamente em ⚙ Configurar Firebase.

---

*Este guia faz parte da documentação do PrumoSST.*
*Desenvolvido por Ellen Cristine Almeida — Firme. Exato. Íntegro.*
