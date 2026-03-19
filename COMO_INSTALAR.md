# Elaborador SST + eSocial SST – Guia Completo

## O que esse sistema faz

1. **Elabora** PGR, LTCAT e PCMSO completos com download em PDF e DOCX
2. **Gera** os XMLs dos eventos eSocial SST (S-2240, S-2220, S-2210)
3. **Assina digitalmente** os XMLs com seu e-CPF/e-CNPJ (ICP-Brasil)
4. **Envia automaticamente** ao eSocial via SOAP (sem precisar de terceiros)
5. **Guarda histórico** de todos os envios com nrRec e status

---

## Estrutura de Arquivos

```
intergrador e pgr/
├── frontend/
│   └── index.html          ← O elaborador completo (abre no navegador)
├── backend/
│   ├── server.js           ← API Node.js (assina e envia ao eSocial)
│   ├── src/
│   │   ├── certificate.js  ← Carrega o .pfx
│   │   ├── xmlSigner.js    ← Assina com XMLDSig (RSA-SHA256)
│   │   ├── esocialAPI.js   ← Comunicação SOAP com eSocial
│   │   ├── xmlBuilder.js   ← Constrói os XMLs dos eventos
│   │   └── database.js     ← SQLite (histórico de envios)
│   ├── scripts/
│   │   └── setup-certificate.js  ← Assistente de configuração
│   ├── package.json
│   └── .env                ← Criado pelo assistente (NÃO comitar no git!)
└── COMO_INSTALAR.md        ← Este arquivo
```

---

## PASSO 1 – Instalar Node.js

1. Acesse: https://nodejs.org/
2. Baixe a versão **LTS** (ex: 20.x)
3. Instale normalmente
4. Confirme abrindo o Prompt de Comando e digitando: `node --version`

---

## PASSO 2 – Instalar as dependências do backend

Abra o Prompt de Comando (cmd) e execute:

```cmd
cd "C:\Users\Dell\OneDrive\Desktop\intergrador e pgr\backend"
npm install
```

Aguarde. Será criada a pasta `node_modules`.

---

## PASSO 3 – Configurar o certificado digital

Execute o assistente de configuração:

```cmd
cd "C:\Users\Dell\OneDrive\Desktop\intergrador e pgr\backend"
node scripts/setup-certificate.js
```

O assistente vai perguntar:
- **Caminho do .pfx**: Cole o caminho completo, ex:
  `C:\Users\Dell\OneDrive\Desktop\Certificado Ellen - 2025-2026.pfx`
- **Senha do certificado**: Digite a senha do seu e-CPF
- **Ambiente**: Digite `homologacao` para testes, `producao` para envio real
- **Porta**: Pressione Enter para usar 3001

O arquivo `.env` será criado automaticamente.

---

## PASSO 4 – Iniciar o servidor

```cmd
cd "C:\Users\Dell\OneDrive\Desktop\intergrador e pgr\backend"
node server.js
```

Você verá:
```
✅ Certificado carregado: ELLEN CRISTINE...
   Ambiente eSocial: homologacao
🚀 eSocial SST Backend rodando em http://localhost:3001
```

---

## PASSO 5 – Abrir o sistema

Abra o navegador e acesse:

**http://localhost:3001**

OU abra diretamente o arquivo:

`frontend/index.html`

No cabeçalho aparecerá: **🟢 Backend conectado**

---

## Como usar

### Para elaborar PGR/LTCAT/PCMSO:
1. Passos 1 a 4 normalmente
2. Clique em "Gerar Documentos" → baixe PDF ou DOCX

### Para enviar ao eSocial:
1. Complete todos os passos do elaborador
2. Vá ao **Passo 5 – eSocial SST**
3. Importe a **planilha nominal** de trabalhadores (CSV) na aba S-2220
4. Revise os **agentes nocivos** mapeados na aba S-2240
5. Clique em **"🚀 Enviar ao eSocial"**
6. O sistema assina, envia e mostra o **nrRec** (número do recibo)

### Para consultar o resultado:
Acesse: `http://localhost:3001/api/consultar/SEU_NRREC`

---

## Planilha Nominal de Trabalhadores (CSV)

Formato das colunas (separe por vírgula ou ponto-e-vírgula):

```
Nome,CPF,NIS/PIS,Matricula,GHE/Setor,DataASO,TipoASO
João Silva,12345678900,12345678900,001,Pintura,2025-11-15,2
Maria Santos,98765432100,98765432100,002,Administrativo,2025-11-20,2
```

**Tipos de ASO:** 1=Admissional, 2=Periódico, 3=Retorno, 4=Mudança de função, 9=Demissional

---

## Ambientes eSocial

| Ambiente | Para que serve |
|---|---|
| **homologacao** | Testes – nenhum dado vai para o eSocial real |
| **producao** | Envio real – use apenas quando tiver certeza |

⚠️ Mude de `homologacao` para `producao` no arquivo `.env` apenas quando estiver pronto para enviar de verdade.

---

## Cloudflare Pages (publicar na internet)

### Frontend (Cloudflare Pages – GRÁTIS):
1. Crie conta em cloudflare.com
2. Vá em **Pages** → "Create a project"
3. Conecte ao GitHub OU faça upload direto da pasta `frontend/`
4. Pronto – você terá uma URL como `elaborador-sst.pages.dev`

### Backend (Railway – ~R$25/mês):
1. Crie conta em railway.app
2. Clique em "New Project" → "Deploy from GitHub repo"
3. Selecione a pasta `backend/`
4. Configure as variáveis de ambiente (as mesmas do .env):
   - `PFX_PATH` = o caminho no servidor (ou use upload de arquivo)
   - `PFX_PASSWORD` = sua senha
   - `TRANSMISSOR_CPF` = seu CPF
   - `ESOCIAL_AMBIENTE` = producao ou homologacao
5. O Railway fornecerá uma URL como `seu-backend.railway.app`
6. No `frontend/index.html`, troque a linha:
   ```javascript
   const BACKEND_URL = window.location.hostname === 'localhost'
     ? 'http://localhost:3001'
     : 'https://seu-backend.railway.app'; // ← coloque aqui
   ```

---

## Sobre o envio eSocial sem empresas intermediárias

Outras ferramentas cobram mensalidade para fazer o envio ao eSocial porque vendem esse serviço. Mas **tecnicamente**, qualquer sistema pode enviar diretamente se tiver:

1. ✅ **Certificado digital ICP-Brasil** (e-CPF A1 ou e-CNPJ A1) – você tem
2. ✅ **Procuração Eletrônica Perfil 3** outorgada pelo cliente no e-CAC – você tem
3. ✅ **XML assinado digitalmente** (XMLDSig) – o backend faz isso
4. ✅ **Conexão HTTPS com o webservice SOAP** do eSocial – o backend faz isso

Nenhuma empresa intermediária é necessária.

---

## Histórico de Envios

Acesse via API ou veja os arquivos em `backend/data/eventos.db` (SQLite).

Para consultar via navegador: `http://localhost:3001/api/historico`

---

## Suporte

Em caso de erro, verifique:
1. O backend está rodando? (`node server.js`)
2. O certificado está válido? (verifique a data de validade)
3. A senha está correta no `.env`?
4. O ambiente está certo (homologação vs. produção)?
