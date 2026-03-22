# 📐 PrumoSST
### *Firme. Exato. Íntegro.*

**PrumoSST** é uma plataforma SaaS para elaboração de documentos de Saúde e Segurança do Trabalho (SST) e transmissão de eventos ao eSocial. Desenvolvida por engenheira de segurança do trabalho, para engenheiras de segurança do trabalho.

---

## O que o sistema faz

| Módulo | Descrição |
|---|---|
| **PGR** | Programa de Gerenciamento de Riscos — inventário de riscos por GHE, plano de ação, geração de PDF |
| **LTCAT** | Laudo Técnico das Condições Ambientais do Trabalho — agentes nocivos, enquadramento no Dec. 3.048/99 |
| **PCMSO** | Programa de Controle Médico de Saúde Ocupacional — exames, médicos examinadores, ASO |
| **eSocial S-2210** | Comunicação de Acidente de Trabalho (CAT) |
| **eSocial S-2220** | Monitoramento da Saúde do Trabalhador (ASO) |
| **eSocial S-2240** | Condições Ambientais do Trabalho — Agentes Nocivos |
| **Multi-empresa** | Gerencia várias empresas e anos dentro do mesmo sistema |
| **Multi-usuário** | Cada engenheira acessa com seu Google e usa seu próprio certificado digital |

---

## Arquitetura do sistema

```
┌─────────────────────────────────────────────────────────────┐
│                        NAVEGADOR                            │
│                                                             │
│   frontend/index.html   (SPA — Single Page Application)     │
│   ├── PGR, LTCAT, PCMSO (geração de documentos)            │
│   ├── eSocial (S-2210, S-2220, S-2240)                     │
│   ├── Login Google (Firebase Auth SDK)                      │
│   ├── Certificado digital (localStorage — só no navegador)  │
│   └── Dados das empresas (localStorage — só no navegador)  │
│                                                             │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTPS + JWT
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    RAILWAY (Servidor)                        │
│                                                             │
│   backend/server.js   (Node.js + Express)                   │
│   ├── Serve o frontend (express.static)                     │
│   ├── Autenticação JWT (valida token do login Google)       │
│   ├── Whitelist de usuários (data/users.json)              │
│   ├── Assina XMLs com certificado digital (xmlSigner.js)   │
│   └── Envia ao webservice do eSocial (esocialAPI.js)       │
│                                                             │
└──────────────────┬──────────────────────────────────────────┘
                   │ SOAP/HTTPS mTLS
                   ▼
┌─────────────────────────────────────────────────────────────┐
│              WEBSERVICE eSocial (Governo Federal)            │
│   Produção:   webservices.envio.esocial.gov.br              │
│   Homologação: webservices.producaorestrita.esocial.gov.br  │
└─────────────────────────────────────────────────────────────┘
```

### Por que essa arquitetura é segura?

- **Dados das empresas ficam no navegador da engenheira** — o servidor Railway nunca armazena CNPJ, dados de saúde, laudos ou qualquer informação das empresas clientes.
- **Certificado digital fica no navegador** — é enviado ao servidor apenas durante a transmissão (em memória, nunca salvo em disco).
- **Tudo trafega por HTTPS** — Railway fornece certificado TLS automaticamente.
- **JWT com prazo de 30 dias** — mesmo que um token vaze, expira.
- **Whitelist dupla** — Firebase bloqueia + whitelist interna do sistema bloqueia.

---

## Estrutura de arquivos

```
intergrador e pgr/
├── frontend/
│   └── index.html              ← Sistema completo (SPA de ~4500 linhas)
├── backend/
│   ├── server.js               ← Servidor Node.js (rotas, auth, eSocial)
│   ├── .env                    ← Variáveis de ambiente (NUNCA subir pro GitHub)
│   ├── .env.example            ← Modelo para configurar o .env
│   ├── data/
│   │   └── users.json          ← Whitelist de e-mails autorizados
│   └── src/
│       ├── certificate.js          ← Carrega .pfx local
│       ├── certificate-railway.js  ← Decodifica PFX de Base64 (Railway)
│       ├── xmlBuilder.js           ← Monta XMLs S-2210, S-2220, S-2240
│       ├── xmlSigner.js            ← Assina XML com certificado digital
│       ├── esocialAPI.js           ← Comunica com webservice eSocial (SOAP)
│       └── database.js             ← Modelos de dados (Empresa, Trabalhador)
├── .gitignore                  ← Protege .env, certificados, node_modules
├── package.json                ← Configuração Node.js
├── railway.json                ← Configuração de deploy Railway
├── Procfile                    ← Comando de start (Railway/Heroku)
├── RODAR.bat                   ← Atalho para rodar localmente no Windows
├── CONVERTER_BASE64.html       ← Converte .pfx para Base64 (uso local)
└── README.md                   ← Esta documentação
```

---

## Variáveis de ambiente (backend/.env)

Copie `backend/.env.example` para `backend/.env` e preencha:

```env
# Porta do servidor (Railway define automaticamente)
PORT=3001
NODE_ENV=production

# ── Certificado Digital ──────────────────────────────────
# Cole aqui o conteúdo Base64 do .pfx (use CONVERTER_BASE64.html)
PFX_BASE64=cole_aqui_o_base64

# Senha do certificado .pfx
PFX_PASSWORD=sua_senha

# ── Transmissor ──────────────────────────────────────────
TRANSMISSOR_CPF=00000000000
TRANSMISSOR_NOME=Seu Nome Completo

# ── eSocial ──────────────────────────────────────────────
# producao = envia de verdade | homologacao = teste
ESOCIAL_AMBIENTE=producao

# ── Segurança ─────────────────────────────────────────────
# Chave secreta para assinar JWTs — gere algo aleatório longo
JWT_SECRET=troque_por_uma_chave_forte_aleatoria

# ── Acesso ────────────────────────────────────────────────
# E-mail do administrador (terá acesso ao painel admin)
ADMIN_EMAIL=seu@gmail.com

# true = exige login Google | false = modo desenvolvimento (sem auth)
REQUIRE_AUTH=true

# ── CORS ──────────────────────────────────────────────────
# Domínios autorizados a acessar o backend
FRONTEND_URL=https://prumosst.com,https://www.prumosst.com
```

---

## Como rodar localmente

### Pré-requisitos
- Node.js 18 ou superior
- Certificado digital A1 (.pfx) válido para o eSocial

### Passos

```bash
# 1. Instalar dependências
cd backend
npm install

# 2. Configurar ambiente
copy .env.example .env
# Edite o .env com suas informações

# 3. Iniciar o servidor
node server.js
# Servidor sobe em http://localhost:3001
```

Ou no Windows: clique duas vezes em **RODAR.bat**

---

## Rotas da API

### Autenticação

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` | Verifica e-mail na whitelist, retorna JWT |

### Admin (requer token + role=admin)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/admin/users` | Lista todos os usuários |
| POST | `/api/admin/users` | Adiciona novo usuário |
| PATCH | `/api/admin/users/:email` | Ativa/desativa usuário |
| DELETE | `/api/admin/users/:email` | Remove usuário |

### eSocial (requer token JWT)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/esocial/enviar` | Envia lote de eventos |
| POST | `/api/esocial/consultar` | Consulta resultado do lote |
| POST | `/api/esocial/s2240/enviar` | Envia evento S-2240 |
| POST | `/api/esocial/s2220/enviar` | Envia evento S-2220 (ASO) |
| POST | `/api/esocial/s2210/enviar` | Envia evento S-2210 (CAT) |

### Utilitários

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/health` | Status do servidor |
| GET | `/api/cert-info` | Info do certificado carregado |

---

## Sistema de autenticação

### Fluxo completo

```
1. Usuária abre prumosst.com
2. Clica "Entrar com Google"
3. Firebase autentica (Google OAuth)
4. Frontend envia token Firebase para POST /api/auth/login
5. Backend verifica se e-mail está na whitelist (users.json)
6. Se autorizada → retorna JWT de 30 dias
7. Todas as chamadas eSocial incluem o JWT no header
```

### Gerenciar usuárias (painel admin)

Apenas o e-mail definido em `ADMIN_EMAIL` (ou `role: "admin"` no users.json) vê o painel de administração dentro do sistema.

**Adicionar usuária:** painel admin → "Adicionar e-mail" → digita o Gmail dela
**Remover acesso:** painel admin → botão "Remover" ao lado do e-mail
**Suspender temporariamente:** botão "Desativar" (mantém o cadastro)

### Certificado digital por usuária

Cada engenheira carrega seu próprio certificado diretamente no navegador:
- Vai em Perfil → "Meu Certificado Digital"
- Faz upload do `.pfx` e digita a senha
- O certificado fica salvo **só no navegador dela** (localStorage)
- A você (administradora) **nunca chega** o certificado das outras

---

## Deploy em produção (Railway)

### Passo a passo

1. **Criar conta em** [railway.app](https://railway.app)
2. **Novo projeto** → "Deploy from GitHub repo"
3. **Conectar** o repositório do PrumoSST
4. **Configurar variáveis de ambiente** no painel Railway (copiar do .env)
5. Railway detecta o `Procfile` e inicia automaticamente
6. **Domínio:** Railway gera um `.up.railway.app` — aponte seu domínio para ele

### Configurar domínio prumosst.com (Cloudflare)

1. No Railway: Settings → Domains → "Add Custom Domain" → digita `prumosst.com`
2. Railway mostra um endereço CNAME (ex: `xxx.railway.internal`)
3. No Cloudflare: DNS → Add Record:
   - Tipo: `CNAME`
   - Nome: `@` (para o domínio raiz) e `www`
   - Destino: endereço CNAME do Railway
   - Proxy: **Ativado** (nuvem laranja)
4. Aguardar propagação (5 a 30 minutos)

---

## Configurar Firebase (login Google)

### 1. Criar projeto

1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
2. "Criar projeto" → nome: `PrumoSST` → continuar
3. Desativar Google Analytics (opcional) → criar

### 2. Ativar autenticação Google

1. No menu lateral: **Authentication**
2. Aba **Sign-in method**
3. **Google** → Ativar → salvar

### 3. Registrar o app web

1. Engrenagem (⚙) → **Configurações do projeto**
2. Role até "Seus apps" → clique no ícone `</>`(Web)
3. Nome do app: `PrumoSST Web` → registrar
4. Firebase mostra um bloco `firebaseConfig` com chaves — **copie esse JSON**

### 4. Configurar no PrumoSST

Na tela de login do PrumoSST:
1. Clique em "⚙ Configurar Firebase"
2. Cole o JSON copiado
3. Clique "Salvar"
4. O botão "Entrar com Google" fica ativo

### 5. Domínios autorizados

No Firebase Console → Authentication → Settings → **Authorized domains**:
- Adicione `prumosst.com` e `www.prumosst.com`

---

## Módulos do sistema — guia de uso

### PGR (Programa de Gerenciamento de Riscos)

**Passo 1 — Empresa:** preencha razão social, CNPJ, CNAE, grau de risco, endereço, responsável técnico.

**Passo 2 — GHEs:** cadastre os Grupos Homogêneos de Exposição. Para cada GHE:
- Informe o setor, cargos e atividades
- Pode importar via planilha (.tsv) — baixe o modelo de exemplo

**Passo 3 — Riscos:** para cada GHE, cadastre os agentes de risco:
- Aba **Físico/Químico/Biológico/Acidente:** tipo, agente, perigo, probabilidade, gravidade
- Aba **Ergonômico:** riscos ergonômicos com medidas de controle
- Aba **Psicossocial:** categorias psicossociais com checkboxes; marque "sem queixas" se não houver relatos

**Passo 4 — Plano de ação:** ações por risco, prazo, responsável, status.

**Passo 5 — Documentos:** gera PDF do PGR, LTCAT e PCMSO.

### LTCAT (Laudo Técnico das Condições Ambientais)

Gerado automaticamente a partir dos dados do PGR.

Para cada agente de risco, o sistema pergunta: **"Este agente NÃO consta no Decreto 3.048/99?"**
- Se **todos** os agentes de um GHE estiverem marcados como "não consta" → LTCAT sai com **ausência de risco** para aquele GHE
- Se **algum** agente não estiver marcado → ele aparece no LTCAT como agente nocivo

### PCMSO (Programa de Controle Médico)

- Cadastre o(s) médico(s) coordenador(es) (vários são suportados)
- O sistema lista os exames indicados por risco
- Permite importar lista de funcionários com ASO via planilha (.tsv)

### Eventos eSocial

**S-2240 — Condições Ambientais:**
- Gerado a partir dos dados do LTCAT
- Assina com certificado digital e envia ao webservice

**S-2220 — ASO:**
- Importar planilha de funcionários ou cadastrar manualmente
- Um evento por trabalhador por ASO

**S-2210 — CAT:**
- Preencher formulário de acidente
- Enviar imediatamente

---

## Segurança e LGPD

### O que o servidor armazena
- Lista de e-mails autorizados (`users.json`) — sem senha, sem dados pessoais
- Logs de transmissão ao eSocial (sem dados de saúde)

### O que NUNCA passa pelo servidor permanentemente
- Dados das empresas clientes
- Laudos, PGR, PCMSO, LTCAT
- Dados de saúde dos trabalhadores
- Certificado digital das engenheiras

### Onde ficam os dados
- **No navegador da engenheira** (localStorage)
- A engenheira pode exportar backup a qualquer momento (botão "Exportar dados")
- Se trocar de computador: importa o backup no novo computador

### Recomendações para as usuárias
- Exportar backup regularmente (salvar em Google Drive ou pen drive)
- Não usar computadores compartilhados sem exportar e limpar os dados
- Usar conta Google com verificação em duas etapas

---

## Proteção intelectual

Este software foi desenvolvido por **Ellen Cristine Almeida** e está protegido pela **Lei nº 9.609/1998** (Lei do Software) e **Lei nº 9.610/1998** (Lei de Direitos Autorais).

**Registros recomendados:**
- INPI — Programa de Computador (registro do código-fonte)
- INPI — Marca "PrumoSST" (proteção do nome e marca)

**O código-fonte é proprietário e confidencial.** Qualquer engenheira que teste ou use o sistema deve assinar um **Acordo de Não Divulgação (NDA)** antes de receber acesso.

---

## Roadmap

- [x] PGR com inventário de riscos por GHE
- [x] LTCAT com enquadramento no Decreto 3.048/99
- [x] PCMSO com múltiplos médicos examinadores
- [x] eSocial S-2210, S-2220, S-2240
- [x] Multi-empresa e multi-ano
- [x] Importação de GHEs e funcionários por planilha (.tsv)
- [x] Risco psicossocial com categorias e "sem queixas"
- [x] Auto-save (nunca perde dados ao recarregar)
- [x] Tema claro/escuro
- [x] Login Google (Firebase Auth)
- [x] Certificado digital por usuária
- [x] Painel admin para gerenciar acessos
- [ ] Backup/exportação dos dados por usuária
- [ ] Assinatura digital dos PDFs
- [ ] Notificações de vencimento de ASO
- [ ] Relatórios comparativos entre anos
- [ ] App mobile (PWA)

---

## Suporte e contato

**Desenvolvedora:** Ellen Cristine Almeida
**Sistema:** PrumoSST
**Slogan:** *Firme. Exato. Íntegro.*
**Site:** https://prumosst.com

---

*Documentação gerada em março de 2026.*
