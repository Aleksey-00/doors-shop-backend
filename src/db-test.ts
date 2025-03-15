import { Client } from 'pg';
import * as dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

async function testDatabaseConnection() {
  console.log('Testing database connection...');
  console.log('Environment variables:');
  console.log('DATABASE_URL:', process.env.DATABASE_URL);
  console.log('DB_HOST:', process.env.DB_HOST);
  console.log('DB_PORT:', process.env.DB_PORT);
  console.log('DB_USERNAME:', process.env.DB_USERNAME);
  console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '[REDACTED]' : undefined);
  console.log('DB_NAME:', process.env.DB_NAME);
  console.log('NODE_ENV:', process.env.NODE_ENV);

  let client;

  try {
    if (process.env.DATABASE_URL) {
      console.log('Connecting using DATABASE_URL...');
      client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
    } else {
      console.log('Connecting using individual parameters...');
      client = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: +(process.env.DB_PORT || 5432),
        user: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'doors_repair',
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
    }

    await client.connect();
    console.log('Successfully connected to the database!');
    
    const result = await client.query('SELECT current_timestamp');
    console.log('Database time:', result.rows[0].current_timestamp);
    
    await client.end();
    console.log('Connection closed.');
  } catch (error) {
    console.error('Error connecting to the database:', error);
  }
}

testDatabaseConnection(); 