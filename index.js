const TelegramBot = require('node-telegram-bot-api');
const schedule = require('node-schedule');
const messages = require('./messages.json'); // Файл с текстами сообщений
require('dotenv').config()


const TOKEN = process.env.TOKEN
const bot = new TelegramBot(TOKEN, { polling: true });

let userStates = {}; // Хранит состояние пользователей в цепочке сообщений

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    userStates[chatId] = 0; // Начинаем с первого сообщения
    bot.sendMessage(chatId, messages[0], getNextButton());
});

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    if (query.data === 'next') {
        userStates[chatId] = (userStates[chatId] || 0) + 1;
        if (userStates[chatId] < messages.length) {
            bot.sendMessage(chatId, messages[userStates[chatId]], getNextButton());
        } else {
            bot.sendMessage(chatId, 'Это было последнее сообщение.');
        }
    }
});

function getNextButton() {
    return {
        reply_markup: {
            inline_keyboard: [[{ text: 'Далее', callback_data: 'next' }]]
        }
    };
}

// Расписание сообщений (пример - каждый день в 10:00)
schedule.scheduleJob('0 10 * * *', function () {
    for (let chatId in userStates) {
        bot.sendMessage(chatId, 'Ваше запланированное сообщение!', getNextButton());
    }
});
