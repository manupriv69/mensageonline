require('dotenv').config();
const { Telegraf } = require('telegraf');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
});

const bot = new Telegraf(process.env.BOT_TOKEN);

// Memória temporária das conversas
const conversations = new Map();

const SYSTEM_PROMPT = `Você é uma mulher safada, confiante e muito sedutora. 
Você trabalha com conteúdo adulto no OnlyFans e está conversando com um lead interessado.

Regras importantes:
- Fale sempre em português brasileiro, de forma natural e bem safada.
- Seja flertadora, provocante e use linguagem adulta sem medo.
- Seu objetivo principal é gerar desejo e conduzir o lead para assinar seu OnlyFans ou conteúdo VIP.
- Não seja robótica. Fale como uma mulher de verdade conversando no Telegram.
- Mantenha o clima quente e vá aumentando a tensão aos poucos.
- Quando achar o momento certo, faça o pitch de venda de forma natural.
- Nunca diga que você é uma IA.
- Responda de forma curta e natural, como se estivesse digitando no celular. Evite textos longos.`;

// Função pra esperar
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Função pra dividir a resposta em partes naturais
function splitMessage(text) {
  // Quebra por pontuação + espaço, mas tenta manter natural
  const parts = text
    .split(/(?<=[.!?…])\s+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  // Se ficou muito fragmentado, junta um pouco
  if (parts.length > 4) {
    const result = [];
    let current = '';
    for (const part of parts) {
      if ((current + ' ' + part).length < 120) {
        current = current ? current + ' ' + part : part;
      } else {
        if (current) result.push(current);
        current = part;
      }
    }
    if (current) result.push(current);
    return result;
  }

  return parts.length > 0 ? parts : [text];
}

bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id;
  const userMessage = ctx.message.text;

  // Inicializa conversa se não existir
  if (!conversations.has(chatId)) {
    conversations.set(chatId, [
      { role: 'system', content: SYSTEM_PROMPT }
    ]);
  }

  const history = conversations.get(chatId);
  history.push({ role: 'user', content: userMessage });

  try {
    // Mostra digitando enquanto pensa
    await ctx.sendChatAction('typing');

    const completion = await openai.chat.completions.create({
      model: 'grok-4.5',
      messages: history,
      temperature: 0.95,
    });

    const fullReply = completion.choices[0].message.content.trim();

    // Salva a resposta completa no histórico
    history.push({ role: 'assistant', content: fullReply });

    // Limita histórico
    if (history.length > 22) {
      history.splice(1, 2);
    }

    // Divide a resposta em várias mensagens
    const parts = splitMessage(fullReply);

    for (let i = 0; i < parts.length; i++) {
      // Delay aleatório entre 5 e 15 segundos (exceto a primeira)
      if (i > 0) {
        const delay = Math.floor(Math.random() * 10000) + 5000; // 5 a 15s
        await sleep(delay);
      }

      // Mostra "digitando..."
      await ctx.sendChatAction('typing');
      await sleep(1200); // pequeno delay pra parecer real

      await ctx.reply(parts[i]);
    }

  } catch (error) {
    console.error('Erro na IA:', error.message);
    await ctx.reply('aff... deu um probleminha aqui. Me manda de novo? 😏');
  }
});

bot.launch();
console.log('✅ Bot rodando com sucesso!');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
