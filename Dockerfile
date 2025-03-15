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
ENV DATABASE_URL=postgresql://postgres:lXVEBBhgcJwsNwsQbxyfiAtIxiUmuGiO@mainline.proxy.rlwy.net:43206/railway
ENV DB_HOST=mainline.proxy.rlwy.net
ENV DB_PORT=43206
ENV DB_USERNAME=postgres
ENV DB_PASSWORD=lXVEBBhgcJwsNwsQbxyfiAtIxiUmuGiO
ENV DB_NAME=railway
ENV RAILWAY_ENVIRONMENT=true

# Добавляем переменные окружения для Redis
ENV REDIS_ENABLED=true
ENV REDIS_URL=redis://default:mtUQxXvFcfAWLxbmhGiSomzsNvPCpiBl@redis.railway.internal:6379
ENV REDIS_HOST=redis.railway.internal
ENV REDIS_PORT=6379

# Создаем скрипт для запуска приложения с миграциями
RUN printf '#!/bin/sh\necho "Running migrations..."\nnpm run migration:run\necho "Starting application..."\nnode dist/src/main.js\n' > /app/start.sh

# Делаем скрипт исполняемым
RUN chmod +x /app/start.sh

# Проверяем, что скрипт создан и имеет права на выполнение
RUN ls -la /app/start.sh

# Запускаем приложение через скрипт
CMD ["/app/start.sh"] 