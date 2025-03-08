const TelegramBot = require('node-telegram-bot-api')
require('dotenv').config()
const schedule = require('node-schedule')
const path = require('path')
const messages = require('./messages.json') // Файл с текстами сообщений

const TOKEN = process.env.TOKEN

const bot = new TelegramBot(TOKEN, { polling: true })


let userStates = {} // Хранит состояние пользователей в цепочке сообщений
let scheduledJobs = {} // Хранит отложенные отправки сообщений

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id
    userStates[chatId] = 0 // Начинаем с первого сообщения
    sendMessageWithDelay(chatId)
})

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
})

function sendMessageWithDelay(chatId) {
    const messageData = messages[userStates[chatId]];
    const options = getButtons(messageData.buttons);

    // console.log(messageData)
    // console.log(options)

    if (messageData.type === 'photo') {
        const photoPath = path.join(__dirname, 'images', messageData.content);
        if (fs.existsSync(photoPath)) {
            bot.sendPhoto(chatId, fs.createReadStream(photoPath), { caption: messageData.caption, parse_mode: 'Markdown', ...options });
        } else {
            bot.sendMessage(chatId, 'Ошибка: изображение не найдено.', { parse_mode: 'Markdown' });
        }
    } else if (messageData.type === 'photos') {
        const mediaGroup = messageData.content.map(photo => {
            const photoPath = path.join(__dirname, 'images', photo);
            console.log(photoPath)
            return fs.existsSync(photoPath) ? { type: 'photo', media: photoPath } : null;
        }).filter(Boolean);

        if (mediaGroup.length > 0) {
            bot.sendMediaGroup(chatId, mediaGroup).then(() => {
                if (messageData.caption) {
                    bot.sendMessage(chatId, messageData.caption, { parse_mode: 'Markdown', ...options });
                }
            });
        } else {
            bot.sendMessage(chatId, 'Ошибка: изображения не найдены.', { parse_mode: 'Markdown' });
        }
    } else if (messageData.type === 'text' || !messageData.type) {
        // Отправка текстового сообщения
        bot.sendMessage(chatId, messageData.content, { parse_mode: 'Markdown', ...options });
    }
    
    clearScheduledMessage(chatId);
    scheduledJobs[chatId] = schedule.scheduleJob(new Date(Date.now() + 24 * 60 * 60 * 1000), () => {
        userStates[chatId] = (userStates[chatId] || 0) + 1;
        if (userStates[chatId] < messages.length) {
            sendMessageWithDelay(chatId);
        } else {
            bot.sendMessage(chatId, 'Это было последнее сообщение.');
            clearScheduledMessage(chatId);
        }
    })
}


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
schedule.scheduleJob('0 10 * * *', function () {
    for (let chatId in userStates) {
        bot.sendMessage(chatId, 'Ваше запланированное сообщение!', { parse_mode: 'Markdown', ...getButtons([{ text: "Далее", callback_data: "next" }]) });
    }
})