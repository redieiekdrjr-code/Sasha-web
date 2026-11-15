import logging
import os

from aiohttp import web
from aiogram import Bot, Dispatcher
from aiogram.filters import CommandStart, Command
from aiogram.types import Message, Update

logging.basicConfig(level=logging.INFO)

TOKEN = os.getenv("BOT_TOKEN")
PUBLIC_URL = os.getenv("RENDER_EXTERNAL_URL")

if not TOKEN:
    raise RuntimeError("Не задана переменная окружения BOT_TOKEN")
if not PUBLIC_URL:
    raise RuntimeError("Не задана переменная окружения RENDER_EXTERNAL_URL")

bot = Bot(token=TOKEN)
dp = Dispatcher()


@dp.message(CommandStart())
async def start(message: Message):
    await message.answer(
        "Привет! Я sanewbot 🤖\n\n"
        "Напиши мне сообщение — я повторю его.\n"
        "Команды: /help и /about"
    )


@dp.message(Command("help"))
async def help_command(message: Message):
    await message.answer(
        "Доступные команды:\n/start — запуск\n/help — помощь\n/about — о боте"
    )


@dp.message(Command("about"))
async def about(message: Message):
    await message.answer("Я sanewbot — простой Telegram-бот.")


@dp.message()
async def echo(message: Message):
    if message.text:
        await message.answer(message.text)
    else:
        await message.answer("Пока я умею отвечать только на текстовые сообщения.")


async def health(request):
    return web.Response(text="sanewbot is running")


async def telegram_webhook(request):
    if request.match_info["token"] != TOKEN:
        raise web.HTTPUnauthorized()
    data = await request.json()
    update = Update.model_validate(data, context={"bot": bot})
    await dp.feed_update(bot, update)
    return web.Response(text="ok")


async def on_startup(app):
    await bot.set_webhook(f"{PUBLIC_URL.rstrip('/')}/webhook/{TOKEN}")


async def on_cleanup(app):
    await bot.delete_webhook()
    await bot.session.close()


app = web.Application()
app.router.add_get("/", health)
app.router.add_post("/webhook/{token}", telegram_webhook)
app.on_startup.append(on_startup)
app.on_cleanup.append(on_cleanup)

if __name__ == "__main__":
    web.run_app(app, host="0.0.0.0", port=int(os.getenv("PORT", "10000")))
