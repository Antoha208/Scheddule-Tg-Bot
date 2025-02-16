require('dotenv').config()
const TelegramBot = require('node-telegram-bot-api');
const schedule = require('node-schedule');
const messages = require('./messages.json'); // Файл с текстами сообщений

const TOKEN = process.env.TOKEN;
const bot = new TelegramBot(TOKEN, { polling: true });

let userStates = {}; // Хранит состояние пользователей в цепочке сообщений
let scheduledJobs = {}; // Хранит отложенные отправки сообщений

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    userStates[chatId] = 0; // Начинаем с первого сообщения
    sendMessageWithDelay(chatId);
});

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    if (query.data === 'next') {
        userStates[chatId] = (userStates[chatId] || 0) + 1;
        if (userStates[chatId] < messages.length) {
            sendMessageWithDelay(chatId);
        } else {
            bot.sendMessage(chatId, 'Это было последнее сообщение.');
            clearScheduledMessage(chatId);
        }
    }
});

function sendMessageWithDelay(chatId) {
    bot.sendMessage(chatId, messages[userStates[chatId]], getNextButton());
    clearScheduledMessage(chatId);
    scheduledJobs[chatId] = schedule.scheduleJob(new Date(Date.now() + 24 * 60 * 60 * 1000), () => {
        userStates[chatId] = (userStates[chatId] || 0) + 1;
        if (userStates[chatId] < messages.length) {
            bot.sendMessage(chatId, messages[userStates[chatId]], getNextButton());
            sendMessageWithDelay(chatId);
        } else {
            bot.sendMessage(chatId, 'Это было последнее сообщение.');
            clearScheduledMessage(chatId);
        }
    });
}

function clearScheduledMessage(chatId) {
    if (scheduledJobs[chatId]) {
        scheduledJobs[chatId].cancel();
        delete scheduledJobs[chatId];
    }
}

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
