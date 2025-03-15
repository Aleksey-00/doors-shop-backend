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

# Создаем скрипт для запуска приложения с миграциями
RUN echo '#!/bin/sh\n\
echo "Running migrations..."\n\
npm run migration:run\n\
echo "Starting application..."\n\
node dist/src/main.js' > /app/start.sh

# Делаем скрипт исполняемым
RUN chmod +x /app/start.sh

# Запускаем приложение через скрипт
CMD ["/app/start.sh"] 