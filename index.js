const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();
const schedule = require('node-schedule');
const path = require('path');
const fs = require('fs');
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
        console.log(`Кнопка "Далее" нажата для chatId: ${chatId}`);

        userStates[chatId] = (userStates[chatId] || 0) + 1;
        if (userStates[chatId] < messages.length) {
            sendMessageWithDelay(chatId);
        } else {
            console.log('Это было последнее сообщение.')
            // bot.sendMessage(chatId, 'Это было последнее сообщение.');
            clearScheduledMessage(chatId);
        }
    }
});

function sendMessageWithDelay(chatId) {
    const messageData = messages[userStates[chatId]];
    if (!messageData) return;

    const options = getButtons(messageData.buttons);
    let sendPromise;

    console.log(`Отправляем сообщение типа: ${messageData.type} для chatId: ${chatId}`);

    if (messageData.type === 'photo') {
        const photoPath = path.join(__dirname, 'images', messageData.content);
        if (fs.existsSync(photoPath)) {
            sendPromise = bot.sendPhoto(chatId, fs.createReadStream(photoPath), { caption: messageData.caption, parse_mode: 'Markdown', ...options });
        } else {
            console.log('Ошибка: изображение не найдено.')
            // sendPromise = bot.sendMessage(chatId, 'Ошибка: изображение не найдено.', { parse_mode: 'Markdown' });
        }
    } else if (messageData.type === 'photos') {
        const mediaGroup = messageData.content.map(photo => {
            const photoPath = path.join(__dirname, 'images', photo);
            const media = fs.createReadStream(photoPath)
            return fs.existsSync(photoPath) ? { type: 'photo', media: media } : null;
        }).filter(Boolean);

        if (mediaGroup.length > 0) {
            sendPromise = bot.sendMediaGroup(chatId, mediaGroup).then(() => {
                if (messageData.caption) {
                    return bot.sendMessage(chatId, messageData.caption, { parse_mode: 'Markdown', ...options });
                }
            });
        } else {
            console.log('Ошибка: изображения не найдены.')
            // sendPromise = bot.sendMessage(chatId, , { parse_mode: 'Markdown' });
        }
    } else if (messageData.type === 'video_note') {
        const videoPath = path.join(__dirname, 'videos', messageData.content);
        if (fs.existsSync(videoPath)) {
            // console.log(`Отправляем видео: ${videoPath}`);
            const video = fs.createReadStream(videoPath)
            sendPromise = bot.sendVideoNote(chatId, video).then(() => {
                console.log("Видео отправлено. Отправляем следующее сообщение...");
                userStates[chatId]++; // Сразу переходим к следующему сообщению
                sendMessageWithDelay(chatId);
            });
        } else {
            console.log('Ошибка: видео не найдено.')
            // sendPromise = bot.sendMessage(chatId, '', { parse_mode: 'Markdown' });
        }
    } else if (messageData.type === 'text' || !messageData.type) {
        sendPromise = bot.sendMessage(chatId, messageData.content, { parse_mode: 'Markdown', ...options });
    }

    sendPromise.then(() => {
        if (messageData.type !== 'video_note') {
            console.log("Запускаем таймер для следующего сообщения...");
            scheduleNextMessage(chatId);
        }
    }).catch(err => console.log("Ошибка при отправке сообщения:", err));
}

function scheduleNextMessage(chatId) {
    console.log(`Запускаем таймер для chatId: ${chatId}`);

    clearScheduledMessage(chatId); // Чистим старый таймер

    scheduledJobs[chatId] = schedule.scheduleJob(new Date(Date.now() + 1 * 60 * 1000), () => {
        console.log(`Таймер сработал. Отправляем следующее сообщение для chatId: ${chatId}`);
        userStates[chatId]++;
        if (userStates[chatId] < messages.length) {
            sendMessageWithDelay(chatId);
        } else {
            console.log('Это было последнее сообщение.')
            // bot.sendMessage(chatId, 'Это было последнее сообщение.');
            clearScheduledMessage(chatId);
        }
    });
}

function clearScheduledMessage(chatId) {
    if (scheduledJobs[chatId]) {
        console.log(`Очищаем таймер для chatId: ${chatId}`);
        scheduledJobs[chatId].cancel();
        delete scheduledJobs[chatId];
    }
}

function getButtons(buttons) {
    if (!buttons || buttons.length === 0) return {}; // Если кнопок нет, возвращаем пустой объект
    return {
        reply_markup: {
            inline_keyboard: buttons.map(btn => [{ text: btn.text, callback_data: btn.callback_data || undefined, url: btn.url || undefined }])
        }
    };
}
