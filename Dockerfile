FROM node:18-alpine

WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем исходный код
COPY . .

# Проверяем содержимое директории
RUN ls -la

# Патчим @nestjs/typeorm для обхода проблемы с crypto.randomUUID()
RUN sed -i 's/const generateString = () => crypto.randomUUID();/const generateString = () => { try { return crypto.randomUUID(); } catch (e) { const rb = crypto.randomBytes(16); rb[6] = (rb[6] \& 0x0f) | 0x40; rb[8] = (rb[8] \& 0x3f) | 0x80; const hex = rb.toString("hex"); return hex.substring(0, 8) + "-" + hex.substring(8, 12) + "-" + hex.substring(12, 16) + "-" + hex.substring(16, 20) + "-" + hex.substring(20, 32); } };/' /app/node_modules/@nestjs/typeorm/dist/common/typeorm.utils.js

# Собираем приложение
RUN npm run build

# Проверяем, что dist директория создана и содержит main.js
RUN ls -la dist
RUN ls -la dist/src

# Открываем порт
EXPOSE 9090

# Устанавливаем переменные окружения по умолчанию
ENV NODE_ENV=production
ENV PORT=9090

# Добавляем переменные окружения для базы данных
# Эти значения будут переопределены при запуске контейнера
# через переменные окружения Railway
ENV DATABASE_URL=postgresql://postgres:yxbIyMbZLrTFRpLTcXwlQVXzWTnQCQij@caboose.proxy.rlwy.net:55788/railway
ENV DB_HOST=caboose.proxy.rlwy.net
ENV DB_PORT=55788
ENV DB_USERNAME=postgres
ENV DB_PASSWORD=yxbIyMbZLrTFRpLTcXwlQVXzWTnQCQij
ENV DB_NAME=railway
ENV RAILWAY_ENVIRONMENT=true

# Добавляем переменные окружения для Redis
# При локальном запуске отключаем Redis, чтобы избежать ошибок
ENV REDIS_ENABLED=true
ENV REDIS_URL=redis://default:mtUQxXvFcfAWLxbmhGiSomzsNvPCpiBl@centerbeam.proxy.rlwy.net:34577

# Создаем скрипт для запуска приложения с миграциями, заполнением данных и синхронизацией Redis
RUN printf '#!/bin/sh\n\
echo "Running migrations..."\n\
node -r ./polyfill.js node_modules/ts-node/dist/bin.js ./node_modules/typeorm/cli.js migration:run -d ./typeorm.config.ts\n\
echo "Seeding database..."\n\
node -r ./polyfill.js dist/src/scripts/run-seed-prod.js\n\
echo "Synchronizing Redis..."\n\
node -r ./polyfill.js node_modules/ts-node/dist/bin.js src/scripts/sync-redis.ts\n\
echo "Starting application..."\n\
node -r ./polyfill.js dist/src/main.js\n' > /app/start.sh

# Делаем скрипт исполняемым
RUN chmod +x /app/start.sh

# Проверяем, что скрипт создан и имеет права на выполнение
RUN ls -la /app/start.sh

# Запускаем приложение через скрипт
CMD ["/app/start.sh"]