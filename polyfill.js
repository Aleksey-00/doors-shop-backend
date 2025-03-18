// polyfill.js - Запускается перед приложением для добавления полифиллов

// Полифилл для crypto.randomUUID
if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
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