# sanewbot — бесплатный вариант для Render

Файлы:
- `main.py` — бот с Telegram webhook.
- `requirements.txt` — зависимости.
- `render.yaml` — бесплатный Render Web Service.

## Важно
1. Загрузите эти три файла в корень GitHub-репозитория, заменив старые.
2. В Render создайте Web Service из этого репозитория и выберите Free.
3. В Environment добавьте `BOT_TOKEN` со своим новым токеном BotFather.
4. Render автоматически задаст `RENDER_EXTERNAL_URL`.

Бесплатный Render Web Service может засыпать после периода бездействия, поэтому бот не гарантированно отвечает мгновенно круглосуточно. Токен не добавляйте в GitHub и не отправляйте в чат.
