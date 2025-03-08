const TelegramBot = require('node-telegram-bot-api')
require('dotenv').config()
const schedule = require('node-schedule')
const path = require('path')
const fs = require('fs');
const messages = require('./messages.json') // Файл с текстами сообщений

const TOKEN = process.env.TOKEN

const bot = new TelegramBot(TOKEN, { polling: true })


let userStates = {} // Хранит состояние пользователей в цепочке сообщений
let scheduledJobs = {} // Хранит отложенные отправки сообщений
let lastMessageId = {}; // Хранит ID последнего отправленного сообщения для редактирования

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id
    userStates[chatId] = 0 // Начинаем с первого сообщения
    sendMessageWithDelay(chatId)
})

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    // removeButtons(chatId, query.message.message_id);

    if (query.data === 'next') {
        userStates[chatId] = (userStates[chatId] || 0) + 1;
        if (userStates[chatId] < messages.length) {
            sendMessageWithDelay(chatId);
        } else {
            // bot.sendMessage(chatId, 'Это было последнее сообщение.');
            clearScheduledMessage(chatId);
        }
    }
})

function sendMessageWithDelay(chatId) {
    const messageData = messages[userStates[chatId]];
    const options = getButtons(messageData.buttons);

    let sendPromise;

    if (messageData.type === 'photo') {
        const photoPath = path.join(__dirname, 'images', messageData.content);
        if (fs.existsSync(photoPath)) {
            sendPromise = bot.sendPhoto(chatId, fs.createReadStream(photoPath), { caption: messageData.caption, parse_mode: 'Markdown', ...options });
        } else {
            console.log('Ошибка: изображения не найдены.')
            // sendPromise = bot.sendMessage(chatId, 'Ошибка: изображение не найдено.', { parse_mode: 'Markdown' });
        }
    } else if (messageData.type === 'photos') {
        const mediaGroup = messageData.content.map(photo => {
            const photoPath = path.join(__dirname, 'images', photo);
            const medias = fs.createReadStream(photoPath)
            return fs.existsSync(photoPath) ? { type: 'photo', media: medias } : null;
        }).filter(Boolean)        
        
        if (mediaGroup.length > 0) {
            sendPromise = bot.sendMediaGroup(chatId, mediaGroup).then(() => {
                if (messageData.caption) {
                    bot.sendMessage(chatId, messageData.caption, { parse_mode: 'Markdown', ...options });
                }
            });
        } else {
            console.log('Ошибка: изображения не найдены.')
            // sendPromise = bot.sendMessage(chatId, 'Ошибка: изображения не найдены.', { parse_mode: 'Markdown' });
        }
    } else if (messageData.type === 'text' || !messageData.type) {
        // Отправка текстового сообщения
        sendPromise = bot.sendMessage(chatId, messageData.content, { parse_mode: 'Markdown', ...options });
    }

    sendPromise.then(sentMessage => {
        if (sentMessage && sentMessage.message_id) {
            lastMessageId[chatId] = sentMessage.message_id;
        }
    })
    
    clearScheduledMessage(chatId);
    scheduledJobs[chatId] = schedule.scheduleJob(new Date(Date.now() + 24 * 60 * 60 * 1000), () => {
        // removeButtons(chatId, lastMessageId[chatId]);
        userStates[chatId] = (userStates[chatId] || 0) + 1;
        if (userStates[chatId] < messages.length) {
            sendMessageWithDelay(chatId);
        } else {
            // bot.sendMessage(chatId, 'Это было последнее сообщение.');
            clearScheduledMessage(chatId);
        }
    })
}

// function removeButtons(chatId, messageId) {
//     if (messageId) {
//         bot.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }, { chat_id: chatId, message_id: messageId }).catch(err => {
//             console.log("Ошибка при удалении кнопок:", err);
//         });
//     }
// }

function clearScheduledMessage(chatId) {
    if (scheduledJobs[chatId]) {
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
    }
}

// Расписание сообщений (пример - каждый день в 10:00)
// schedule.scheduleJob('0 10 * * *', function () {
//     for (let chatId in userStates) {
//         bot.sendMessage(chatId, 'Ваше запланированное сообщение!', { parse_mode: 'Markdown', ...getButtons([{ text: "Далее", callback_data: "next" }]) });
//     }
// })