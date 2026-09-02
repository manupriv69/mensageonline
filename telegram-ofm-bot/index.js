require('dotenv').config();
const { Telegraf } = require('telegraf');
const OpenAI = require('openai');

// ======================
// CONFIGURAÇÃO
// ======================

const openai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
});

const bot = new Telegraf(process.env.BOT_TOKEN);

// Memória temporária das conversas (Parte 2 vamos colocar no banco de dados)
const conversations = new Map();

// ======================
// PERSONA DA IA
// ======================

const SYSTEM_PROMPT = `Você é uma mulher safada, confiante, provocante e muito sedutora. 
Você cria conteúdo adulto no OnlyFans e está conversando com um lead interessado no Telegram.

Regras importantes:
- Fale SEMPRE em português brasileiro, de forma natural, gírias e tudo.
- Seja flertadora, safada e use linguagem adulta sem medo (pode falar putaria).
- Seu objetivo principal é gerar desejo e conduzir o lead para assinar seu OnlyFans ou conteúdo VIP.
- Nunca diga que você é uma IA ou robô.
- Fale como uma mulher real conversando no Telegram (mensagens curtas e médias, não textos enormes).
- Vá aumentando o clima aos poucos.
- Quando sentir que o lead está engajado, faça o pitch de venda de forma natural e safada.
- Se o lead perguntar preço ou link, direcione de forma sedutora.`;

// ======================
// COMANDOS E MENSAGENS
// ======================

bot.start(async (ctx) => {
  const chatId = ctx.chat.id;

  // Inicializa o histórico da conversa
  conversations.set(chatId, [
    { role: 'system', content: SYSTEM_PROMPT }
  ]);

  await ctx.reply('Oi amor... 😏\n\nFinalmente você apareceu.\nTava te esperando...');
});

bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id;
  const userMessage = ctx.message.text;

  // Se ainda não tem histórico, cria
  if (!conversations.has(chatId)) {
    conversations.set(chatId, [
      { role: 'system', content: SYSTEM_PROMPT }
    ]);
  }

  const history = conversations.get(chatId);
  history.push({ role: 'user', content: userMessage });

  try {
    // Mostra "digitando..."
    await ctx.sendChatAction('typing');

    const completion = await openai.chat.completions.create({
      model: 'grok-4.5',
      messages: history,
      temperature: 0.9,
      max_tokens: 400,
    });

    const reply = completion.choices[0].message.content;

    // Salva a resposta no histórico
    history.push({ role: 'assistant', content: reply });

    // Limita o histórico para não ficar muito grande
    if (history.length > 22) {
      // Mantém o system prompt + últimas mensagens
      const system = history[0];
      const recent = history.slice(-20);
      conversations.set(chatId, [system, ...recent]);
    }

    await ctx.reply(reply);
  } catch (error) {
    console.error('Erro ao chamar a IA:', error.message);
    await ctx.reply('Aff... deu um probleminha aqui 😅\nMe manda de novo?');
  }
});

// ======================
// INICIAR BOT
// ======================

bot.launch()
  .then(() => {
    console.log('✅ Bot rodando com sucesso!');
    console.log('Pode testar no Telegram agora.');
  })
  .catch((err) => {
    console.error('Erro ao iniciar o bot:', err.message);
  });

// Parada limpa
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
