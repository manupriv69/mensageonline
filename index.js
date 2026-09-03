require('dotenv').config();
const { Telegraf } = require('telegraf');
const OpenAI = require('openai');

// Configuração OpenRouter
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com',
    'X-Title': 'OFM Telegram Bot',
  },
});

const bot = new Telegraf(process.env.BOT_TOKEN);

// ==================== CONFIGURAÇÕES ====================
const MAX_HOURS_PER_DAY = 9;
const MAX_SECONDS_PER_DAY = MAX_HOURS_PER_DAY * 3600;
const PAUSE_THRESHOLD = 15 * 60; // 15 minutos sem responder = pausa o contador
const SLEEP_COOLDOWN_HOURS = 3; // Depois de mandar desculpa, só volta depois de 3 horas

// Memória das conversas + controle de tempo
const conversations = new Map();
const userStats = new Map();

// ==================== DESCULPAS ====================
const excuses = {
  manha: [
    "Amor, tô saindo agora pro trabalho, depois a gente se fala 😘",
    "Meu bem, vou ter que correr, tô atrasada já",
    "Amor, cheguei no trabalho agora, depois te chamo",
    "Tô no trânsito aqui, depois a gente continua",
    "Meu celular vai descarregar, vou colocar pra carregar e te chamo",
    "Amor, minha chefe chegou, depois a gente se fala"
  ],
  almoco: [
    "Amor, vou almoçar rapidinho, já volto",
    "Tô com uma fome, vou comer e já te chamo",
    "Meu bem, hora do almoço aqui, depois continuamos",
    "Vou pausar um pouco pra comer, já já te chamo",
    "Amor, vou almoçar com umas amigas, depois te falo"
  ],
  tarde: [
    "Amor, vou ter que resolver umas coisas aqui",
    "Tô saindo agora, depois a gente se fala",
    "Meu bem, vou pra academia rapidinho",
    "Amor, vou ter que dar uma saída, já volto",
    "Tô resolvendo umas coisas daqui, depois te chamo",
    "Meu celular tá quase morrendo, vou carregar"
  ],
  noite: [
    "Amor, tô cansada hoje, vou descansar um pouco",
    "Meu bem, vou jantar e já te chamo",
    "Tô indo tomar um banho, já volto",
    "Amor, vou deitar um pouco que tô morta",
    "Meu bem, vou assistir uma coisa aqui e já te falo",
    "Tô com sono, vou descansar e depois a gente se fala"
  ],
  madrugada: [
    "Amor, vou dormir que tô caindo de sono",
    "Meu bem, amanhã a gente se fala, tô muito cansada",
    "Vou deitar agora, beijos",
    "Amor, meu olho já tá fechando, amanhã continuo contigo",
    "Tô indo dormir, sonha comigo 😘",
    "Meu bem, amanhã a gente se fala mais, boa noite"
  ]
};

// ==================== FUNÇÕES AUXILIARES ====================
function getBrasiliaTime() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

function getPeriod(hour) {
  if (hour >= 6 && hour < 11) return "manha";
  if (hour >= 11 && hour < 14) return "almoco";
  if (hour >= 14 && hour < 18) return "tarde";
  if (hour >= 18 && hour < 23) return "noite";
  return "madrugada";
}

function getRandomExcuse() {
  const now = getBrasiliaTime();
  const period = getPeriod(now.getHours());
  const list = excuses[period];
  return list[Math.floor(Math.random() * list.length)];
}

function getTodayDateString() {
  const now = getBrasiliaTime();
  return now.toISOString().split("T")[0];
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function splitMessage(text) {
  const parts = text
    .split(/(?<=[.!?…])\s+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  if (parts.length > 4) {
    const result = [];
    let current = "";
    for (const part of parts) {
      if ((current + " " + part).length < 120) {
        current = current ? current + " " + part : part;
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

// ==================== LÓGICA PRINCIPAL ====================
bot.on("text", async (ctx) => {
  const chatId = ctx.chat.id;
  const userMessage = ctx.message.text;
  const now = getBrasiliaTime();
  const today = getTodayDateString();
  const nowTimestamp = now.getTime();

  // Inicializa stats do usuário
  if (!userStats.has(chatId)) {
    userStats.set(chatId, {
      activeSeconds: 0,
      lastInteraction: nowTimestamp,
      date: today,
      isSleeping: false,
      sleepUntil: 0
    });
  }

  const stats = userStats.get(chatId);

  // Se mudou o dia, reseta
  if (stats.date !== today) {
    stats.activeSeconds = 0;
    stats.date = today;
    stats.isSleeping = false;
    stats.sleepUntil = 0;
  }

  // Se ainda está no período de cooldown da desculpa
  if (stats.sleepUntil && nowTimestamp < stats.sleepUntil) {
    // Não responde nada (ou pode mandar uma mensagem bem curta se quiser)
    return;
  }

  // Calcula tempo ativo
  const timeSinceLast = (nowTimestamp - stats.lastInteraction) / 1000;

  if (timeSinceLast < PAUSE_THRESHOLD) {
    stats.activeSeconds += timeSinceLast;
  }

  stats.lastInteraction = nowTimestamp;

  // Se já está em modo soneca
  if (stats.isSleeping) {
    return; // não responde mais até o cooldown acabar ou virar o dia
  }

  // Verifica limite de 9 horas
  if (stats.activeSeconds >= MAX_SECONDS_PER_DAY) {
    stats.isSleeping = true;
    stats.sleepUntil = nowTimestamp + (SLEEP_COOLDOWN_HOURS * 60 * 60 * 1000); // +3 horas
    const excuse = getRandomExcuse();
    await ctx.reply(excuse);
    return;
  }

  // ==================== IA ====================
  if (!conversations.has(chatId)) {
    conversations.set(chatId, [
      {
        role: "system",
        content: `Você é uma mulher safada, confiante e muito sedutora. 
Você trabalha com conteúdo adulto no OnlyFans e está conversando com um lead interessado.

Regras importantes:
- Fale sempre em português brasileiro, de forma natural e bem safada.
- Seja flertadora, provocante e use linguagem adulta sem medo.
- Seu objetivo principal é gerar desejo e conduzir o lead para assinar seu OnlyFans ou conteúdo VIP.
- Não seja robótica. Fale como uma mulher de verdade conversando no Telegram.
- Mantenha o clima quente e vá aumentando a tensão aos poucos.
- Quando achar o momento certo, faça o pitch de venda de forma natural.
- Nunca diga que você é uma IA.
- Responda de forma curta e natural, como se estivesse digitando no celular. Evite textos longos.`
      }
    ]);
  }

  const history = conversations.get(chatId);
  history.push({ role: "user", content: userMessage });

  try {
    await ctx.sendChatAction("typing");

    const completion = await openai.chat.completions.create({
      model: "google/gemma-4-31b-it:free",
      messages: history,
      temperature: 0.95,
    });

    const fullReply = completion.choices[0].message.content.trim();
    history.push({ role: "assistant", content: fullReply });

    if (history.length > 22) {
      history.splice(1, 2);
    }

    const parts = splitMessage(fullReply);

    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        // Delay maior entre mensagens (8 a 18 segundos)
        const delay = Math.floor(Math.random() * 10000) + 8000;
        await sleep(delay);
      }

      // Tempo de digitando maior
      await ctx.sendChatAction("typing");
      await sleep(2500); // 2.5 segundos digitando

      await ctx.reply(parts[i]);
    }

  } catch (error) {
    console.error("Erro na IA:", error.message);

    // Manda desculpa e entra em cooldown
    stats.isSleeping = true;
    stats.sleepUntil = nowTimestamp + (SLEEP_COOLDOWN_HOURS * 60 * 60 * 1000);
    const excuse = getRandomExcuse();
    await ctx.reply(excuse);
  }
});

bot.launch();
console.log("✅ Bot rodando com sucesso!");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
