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
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/doors_repair
ENV DB_HOST=localhost
ENV DB_PORT=5432
ENV DB_USERNAME=postgres
ENV DB_PASSWORD=postgres
ENV DB_NAME=doors_repair
ENV RAILWAY_ENVIRONMENT=false

# Запускаем приложение
CMD ["node", "dist/src/main.js"] 