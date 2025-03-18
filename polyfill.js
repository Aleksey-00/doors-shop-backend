// polyfill.js - Запускается перед приложением для добавления полифиллов
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('Loading polyfill.js...');

// Безопасная функция генерации UUID, не требующая crypto.randomBytes
function safeGenerateUUID() {
  // Чистый JavaScript без зависимостей от crypto
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, 
          v = c == 'x' ? r : (r & 0x3 | 0x8);
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
    let content = fs.readFileSync(typeormUtilsPath, 'utf8');
    
    // Заменяем вызов crypto.randomUUID() на безопасную реализацию
    if (content.includes('crypto.randomUUID()')) {
      content = content.replace(
        'const generateString = () => crypto.randomUUID();',
        `const generateString = () => {
          // Чистый JavaScript без зависимостей от crypto
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, 
                  v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        };`
      );
      
      fs.writeFileSync(typeormUtilsPath, content, 'utf8');
      console.log('Successfully patched @nestjs/typeorm module');
    } else if (content.includes('crypto.randomBytes')) {
      // Если предыдущий патч уже применен, но использует crypto.randomBytes
      content = content.replace(
        /const generateString = \(\) => \{ try \{ return crypto\.randomUUID\(\); \} catch \(e\) \{ const rb = crypto\.randomBytes\(16\);[^}]*\} \};/g,
        `const generateString = () => {
          // Чистый JavaScript без зависимостей от crypto
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, 
                  v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        };`
      );
      
      fs.writeFileSync(typeormUtilsPath, content, 'utf8');
      console.log('Successfully patched @nestjs/typeorm module (replaced existing patch)');
    } else {
      console.log('No need to patch @nestjs/typeorm (pattern not found)');
    }
  } else {
    console.log(`@nestjs/typeorm utils file not found at ${typeormUtilsPath}`);
  }
} catch (e) {
  console.error('Failed to patch @nestjs/typeorm:', e);
} 