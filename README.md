# Brawl Arena Online

Оригинальный браузерный прототип онлайн-арены на Express и Socket.IO.

## Запуск
`npm install` затем `npm start`, откройте http://localhost:3000.

## Render
Создайте Web Service из этого репозитория. Render прочитает render.yaml. Добавьте секрет ADMIN_KEY в Environment.

## Выдача валюты
POST /api/admin/grant с заголовком x-admin-key и JSON {"playerId":"ID","gems":100,"coins":50}. Это тестовый прототип: пока нет полноценной авторизации, античита, постоянной базы данных и Android APK. На бесплатном Render локальный data.json не обеспечивает надёжное постоянное хранение.
