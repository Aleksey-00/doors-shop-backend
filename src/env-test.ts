import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Функция для проверки наличия файла
function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch (err) {
    return false;
  }
}

// Загружаем переменные окружения из разных файлов
function loadEnvFiles() {
  const rootDir = process.cwd();
  
  const envFiles = [
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
  ];
  
  console.log('Checking for environment files:');
  
  envFiles.forEach(file => {
    const filePath = path.join(rootDir, file);
    if (fileExists(filePath)) {
      console.log(`✅ ${file} exists`);
      const envConfig = dotenv.parse(fs.readFileSync(filePath));
      console.log(`Contents of ${file}:`);
      Object.keys(envConfig).forEach(key => {
        const value = key.toLowerCase().includes('password') || key.toLowerCase().includes('secret') 
          ? '[REDACTED]' 
          : envConfig[key];
        console.log(`  ${key}: ${value}`);
      });
    } else {
      console.log(`❌ ${file} does not exist`);
    }
  });
}

// Выводим все переменные окружения
function printEnvVariables() {
  console.log('\nCurrent environment variables:');
  const envVars = [
    'NODE_ENV',
    'DATABASE_URL',
    'DB_HOST',
    'DB_PORT',
    'DB_USERNAME',
    'DB_PASSWORD',
    'DB_NAME',
    'JWT_SECRET',
    'PORT',
  ];
  
  envVars.forEach(key => {
    const value = key.toLowerCase().includes('password') || key.toLowerCase().includes('secret') 
      ? process.env[key] ? '[REDACTED]' : undefined
      : process.env[key];
    console.log(`${key}: ${value}`);
  });
}

// Проверяем переменные окружения
function checkEnvVariables() {
  loadEnvFiles();
  printEnvVariables();
}

checkEnvVariables(); 