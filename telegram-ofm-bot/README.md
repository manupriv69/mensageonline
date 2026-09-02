# Telegram OFM Bot + Grok (xAI)

Bot de atendimento automático com IA para leads de agência OFM.

## Como usar

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar as chaves
Copie o arquivo de exemplo:
```bash
cp .env.example .env
```

Depois edite o arquivo `.env` e coloque suas chaves:

```env
BOT_TOKEN=seu_token_do_bot_aqui
XAI_API_KEY=sua_chave_da_xai_aqui
```

### 3. Rodar o bot
```bash
npm start
```

Quando aparecer `✅ Bot rodando com sucesso!` pode testar no Telegram.

---

## Observações

- A memória das conversas ainda é temporária (some quando o bot reinicia).
- Na próxima parte vamos adicionar banco de dados + painel admin.
