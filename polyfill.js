// polyfill.js - Запускается перед приложением для добавления полифиллов
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('Loading polyfill.js...');

// Безопасная функция генерации UUID, не требующая crypto.randomBytes
function safeGenerateUUID() {
  // Чистый JavaScript без зависимостей от crypto
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
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
    const replacement = `const generateString = () => { 
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) { 
    const r = Math.random() * 16 | 0; 
    const v = c == "x" ? r : (r & 0x3 | 0x8); 
    return v.toString(16); 
  }); 
};`;

    let content = fs.readFileSync(typeormUtilsPath, 'utf8');
    
    if (content.includes('crypto.randomUUID()')) {
      content = content.replace('const generateString = () => crypto.randomUUID();', replacement);
      fs.writeFileSync(typeormUtilsPath, content, 'utf8');
      console.log('Successfully patched @nestjs/typeorm module');
    } else if (content.includes('crypto.randomBytes')) {
      // Пробуем найти и заменить предыдущий патч с регулярным выражением
      try {
        const regex = /const generateString = \(\) =>[\s\S]*?return v\.toString\(16\);[\s\S]*?\};/g;
        if (regex.test(content)) {
          content = content.replace(regex, replacement);
          fs.writeFileSync(typeormUtilsPath, content, 'utf8');
          console.log('Successfully replaced previous patch in @nestjs/typeorm module');
        } else {
          console.log('Could not find pattern to replace in @nestjs/typeorm module');
        }
      } catch (regexError) {
        console.error('Error with regex replacement:', regexError);
      }
    } else {
      console.log('No need to patch @nestjs/typeorm (pattern not found)');
    }
  } else {
    console.log(`@nestjs/typeorm utils file not found at ${typeormUtilsPath}`);
  }
} catch (e) {
  console.error('Failed to patch @nestjs/typeorm:', e);
} 