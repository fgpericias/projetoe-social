# 🚀 Deployment no Railway - Guia Completo

## **PASSO 1: Codificar o Certificado em Base64**

Abra **PowerShell** e execute:

```powershell
$certPath = "C:\Users\Dell\OneDrive\Desktop\Certificado Ellen - 2025-2026.pfx"
$certBytes = [System.IO.File]::ReadAllBytes($certPath)
$certBase64 = [System.Convert]::ToBase64String($certBytes)
$certBase64 | Out-File -Path "C:\cert_base64.txt" -Encoding UTF8
Write-Host "✅ Certificado codificado! Arquivo: C:\cert_base64.txt"
```

Isso cria um arquivo `C:\cert_base64.txt` com a string Base64.

---

## **PASSO 2: Fazer Push do Código para GitHub**

Na pasta do projeto:

```bash
cd "C:\Users\Dell\OneDrive\Desktop\intergrador e pgr"
git add .
git commit -m "Add Railway deployment support with Base64 certificate"
git push origin main
```

---

## **PASSO 3: Criar Projeto no Railway**

1. Acesse https://railway.app
2. Faça login com GitHub
3. Clique em **"Create New Project"**
4. Selecione **"Deploy from GitHub"**
5. Escolha `fgpericias/projetoe-social`
6. Clique **"Deploy Now"**

Railway vai começar o deploy automaticamente!

---

## **PASSO 4: Configurar Variáveis de Ambiente**

Enquanto Railway faz o deploy, configure as variáveis:

1. No projeto Railway, clique em **"Variables"**
2. Adicione cada variável:

| Nome | Valor |
|------|-------|
| `PORT` | `3001` |
| `NODE_ENV` | `production` |
| `TRANSMISSOR_CPF` | `34781894895` |
| `TRANSMISSOR_NOME` | `Ellen Cristine` |
| `ESOCIAL_AMBIENTE` | `homologacao` |
| `PFX_PASSWORD` | `125324` |
| `PFX_BASE64` | **[Cole o conteúdo de `C:\cert_base64.txt` aqui]** |

---

## **PASSO 5: Aguardar Deploy**

Railway vai:
1. ✅ Fazer clone do repositório
2. ✅ Instalar `npm install`
3. ✅ Fazer build (se necessário)
4. ✅ Iniciar o servidor
5. ✅ Gerar URL pública

Quando terminar, você verá uma URL como:
```
https://projetoe-social-production.up.railway.app
```

---

## **PASSO 6: Testar**

1. Abra a URL do Railway
2. Preencha os dados da empresa
3. Clique em **"🚀 Enviar S-2240"**
4. Verifique se recebe resposta do eSocial (Código: 201 ou outro)

---

## **Troubleshooting**

### Deploy falha durante `npm install`
- Railway pode ter problema com native modules
- Verifique os logs em Railway → "Deployments" → "Build Logs"

### Erro "PFX_BASE64 not found"
- Certifique-se de que colou TODO o conteúdo de `cert_base64.txt`
- Não adicione quebras de linha

### Erro "Unsupported PKCS12 PFX data"
- A string Base64 está corrompida
- Execute o PowerShell novamente e recopie

---

## **Próximos Passos**

Se o teste funcionar:
1. ✅ Implementar cadastro de trabalhadores por GHE
2. ✅ Adicionar perigos pré-definidos por NR
3. ✅ Deploy do frontend no Cloudflare Pages
4. ✅ Testar em produção com CNPJs reais

---

**Dúvidas?** Verifique os logs do Railway!
