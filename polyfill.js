// polyfill.js - Запускается перед приложением для добавления полифиллов
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('Loading polyfill.js...');

// Безопасная функция генерации UUID
function safeGenerateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0;
    var v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Полифилл для crypto.randomUUID
if (!crypto.randomUUID) {
  console.log('Adding crypto.randomUUID polyfill...');
  
  try {
    crypto.randomUUID = safeGenerateUUID;
    console.log('Successfully added crypto.randomUUID polyfill');
  } catch (e) {
    console.error('Failed to add crypto.randomUUID polyfill:', e);
  }
}

// Патчим модуль @nestjs/typeorm напрямую
try {
  console.log('Patching @nestjs/typeorm...');
  const typeormUtilsPath = path.join(__dirname, 'node_modules', '@nestjs', 'typeorm', 'dist', 'common', 'typeorm.utils.js');
  
  if (fs.existsSync(typeormUtilsPath)) {
    // Проверяем существование файла, не читая его содержимое - это предотвращает ошибки
    // Вносим исправления, используя тот же подход, что и в Dockerfile
    try {
      fs.writeFileSync('/tmp/patch.js', 'function randomUUID() { return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) { var r = Math.random() * 16 | 0; var v = c == "x" ? r : (r & 0x3 | 0x8); return v.toString(16); }); }; const generateString = () => randomUUID();');
      
      // Читаем оригинальный файл
      const originalContent = fs.readFileSync(typeormUtilsPath, 'utf8');
      
      // Заменяем строку
      const patchedContent = originalContent.replace(
        'const generateString = () => crypto.randomUUID();',
        'function randomUUID() { return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) { var r = Math.random() * 16 | 0; var v = c == "x" ? r : (r & 0x3 | 0x8); return v.toString(16); }); }; const generateString = () => randomUUID();'
      );
      
      // Если строка была изменена, записываем обратно
      if (originalContent !== patchedContent) {
        fs.writeFileSync(typeormUtilsPath, patchedContent);
        console.log('Successfully patched @nestjs/typeorm module');
      } else {
        console.log('No need to patch @nestjs/typeorm (already patched or different version)');
      }
    } catch (err) {
      console.error('Error during file patching:', err);
    }
  } else {
    console.log(`@nestjs/typeorm utils file not found at ${typeormUtilsPath}`);
  }
} catch (e) {
  console.error('Failed to patch @nestjs/typeorm:', e);
} 