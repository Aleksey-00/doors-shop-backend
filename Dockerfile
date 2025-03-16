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
npm run migration:run\n\
echo "Seeding database..."\n\
npm run seed\n\
echo "Synchronizing Redis..."\n\
npm run sync:redis\n\
echo "Starting application..."\n\
node dist/src/main.js\n' > /app/start.sh

# Делаем скрипт исполняемым
RUN chmod +x /app/start.sh

# Проверяем, что скрипт создан и имеет права на выполнение
RUN ls -la /app/start.sh

# Запускаем приложение через скрипт
CMD ["/app/start.sh"]