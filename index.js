const TelegramApi = require("node-telegram-bot-api");
const axios = require("axios");
const fs = require("fs");

const token = process.env.BOT_TOKEN;

const bot = new TelegramApi(token, { polling: true });

const FILE = "data.json";

function loadSubscriptions() {
  if (!fs.existsSync(FILE)) return {};
  return JSON.parse(fs.readFileSync(FILE));
}

function saveSubscriptions(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

let subscriptions = loadSubscriptions();
let userIntervals = {};

bot.setMyCommands([
  { command: "/start", description: "Приветствие" },
  { command: "/subscribe", description: "Подписаться на уведомления" },
  { command: "/unsubscribe", description: "Отписаться от уведомлений" },
]);

bot.on("message", async (message) => {
  const text = message.text;
  const chatId = message.chat.id;
  const itemName = "Fluttering Breeze";

  if (text === "/start") {
    await bot.sendMessage(
      chatId,
      `Привет! Хочешь отследить Виндрангер на торговой площадке?`
    );
    return await bot.sendSticker(
      chatId,
      "https://tlgrm.ru/_/stickers/1b8/5b6/1b85b61c-f043-45e2-b9ca-3334737e2af0/54.webp"
    );
  }

  if (text === "/subscribe") {
    try {
      const res = await axios.get(process.env.STEAM_COMMUNITY_LINK, {
        params: {
          currency: 1,
          appid: 570,
          market_hash_name: itemName,
        },
      });

      if (res.data.success) {
        if (!subscriptions[chatId]) subscriptions[chatId] = [];

        subscriptions[chatId].push({
          appid: 570,
          item: itemName,
          lastPrice: res.data.lowest_price,
        });

        saveSubscriptions(subscriptions);

        if (!userIntervals[chatId]) {
          userIntervals[chatId] = setInterval(async () => {
            for (const sub of subscriptions[chatId] || []) {
              try {
                const check = await axios.get(
                  process.env.STEAM_COMMUNITY_LINK,
                  {
                    params: {
                      currency: 1,
                      appid: sub.appid,
                      market_hash_name: sub.item,
                    },
                  }
                );

                if (
                  check.data.success &&
                  check.data.lowest_price !== sub.lastPrice
                ) {
                  await bot.sendMessage(
                    chatId,
                    `💰 Цена изменилась на *${sub.item}*: ${sub.lastPrice} → ${check.data.lowest_price}`,
                    { parse_mode: "Markdown" }
                  );
                  sub.lastPrice = check.data.lowest_price;
                  saveSubscriptions(subscriptions);
                }
              } catch (err) {
                console.error("Ошибка проверки цены:", err.message);
              }
            }
          }, 60 * 1000);
        }

        return bot.sendMessage(
          chatId,
          `Подписка оформлена!\n*${itemName}* (цена: ${res.data.lowest_price})`,
          { parse_mode: "Markdown" }
        );
      } else {
        return bot.sendMessage(chatId, "Предмет не найден.");
      }
    } catch (err) {
      console.error(err.message);
      return bot.sendMessage(chatId, "⚠️ Ошибка при запросе к Steam.");
    }
  }

  if (text === "/unsubscribe") {
    if (!subscriptions[chatId] || subscriptions[chatId].length === 0) {
      return bot.sendMessage(chatId, "❌ У вас нет подписок.");
    }

    const index = subscriptions[chatId].findIndex(
      (sub) => sub.item === itemName
    );

    if (index === -1) {
      return bot.sendMessage(
        chatId,
        `❌ У вас не было подписки на "${itemName}"`
      );
    }

    subscriptions[chatId].splice(index, 1);
    saveSubscriptions(subscriptions);

    if (subscriptions[chatId].length === 0 && userIntervals[chatId]) {
      clearInterval(userIntervals[chatId]);
      delete userIntervals[chatId];
    }

    return bot.sendMessage(chatId, `🚫 Вы отписались от *${itemName}*`, {
      parse_mode: "Markdown",
    });
  }

  return bot.sendMessage(
    chatId,
    "Я не знаю, что ответить. Давай ты Настюшку дернешь?"
  );
});
