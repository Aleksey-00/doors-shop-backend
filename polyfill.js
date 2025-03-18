// polyfill.js - Запускается перед приложением для добавления полифиллов
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('Loading polyfill.js...');

// Полифилл для crypto.randomUUID
if (!crypto.randomUUID) {
  console.log('Adding crypto.randomUUID polyfill...');
  
  try {
    crypto.randomUUID = function() {
      if (crypto.randomBytes) {
        // Используем crypto.randomBytes если доступно
        const rb = crypto.randomBytes(16);
        rb[6] = (rb[6] & 0x0f) | 0x40;
        rb[8] = (rb[8] & 0x3f) | 0x80;
        const hex = rb.toString('hex');
        return hex.substring(0, 8) + '-' + hex.substring(8, 12) + '-' + 
              hex.substring(12, 16) + '-' + hex.substring(16, 20) + '-' + 
              hex.substring(20, 32);
      } else {
        // Резервный вариант
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0, 
                v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      }
    };
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
    let content = fs.readFileSync(typeormUtilsPath, 'utf8');
    
    // Заменяем вызов crypto.randomUUID() на нашу собственную реализацию
    if (content.includes('crypto.randomUUID()')) {
      content = content.replace(
        'const generateString = () => crypto.randomUUID();',
        `const generateString = () => {
          // Используем полифилл для randomUUID если оригинальный метод недоступен
          if (!crypto.randomUUID) {
            const rb = crypto.randomBytes(16);
            rb[6] = (rb[6] & 0x0f) | 0x40;
            rb[8] = (rb[8] & 0x3f) | 0x80;
            const hex = rb.toString('hex');
            return hex.substring(0, 8) + '-' + hex.substring(8, 12) + '-' + 
                  hex.substring(12, 16) + '-' + hex.substring(16, 20) + '-' + 
                  hex.substring(20, 32);
          }
          return crypto.randomUUID();
        };`
      );
      
      fs.writeFileSync(typeormUtilsPath, content, 'utf8');
      console.log('Successfully patched @nestjs/typeorm module');
    } else {
      console.log('No need to patch @nestjs/typeorm (pattern not found)');
    }
  } else {
    console.log(`@nestjs/typeorm utils file not found at ${typeormUtilsPath}`);
  }
} catch (e) {
  console.error('Failed to patch @nestjs/typeorm:', e);
} 