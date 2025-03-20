import { plainToInstance } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsNumber()
  PORT: number;

  @IsString()
  DB_HOST: string;

  @IsNumber()
  DB_PORT: number;

  @IsString()
  DB_USERNAME: string;

  @IsString()
  DB_PASSWORD: string;

  @IsString()
  DB_NAME: string;

  @IsString()
  NODE_ENV: string;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  JWT_EXPIRATION_TIME: string;

  @IsNumber()
  RATE_LIMIT_MAX: number;

  @IsNumber()
  RATE_LIMIT_WINDOW_MS: number;

  @IsBoolean()
  TYPEORM_LOGGING: boolean;

  @IsBoolean()
  TYPEORM_SYNCHRONIZE: boolean;

  @IsBoolean()
  REDIS_ENABLED: boolean;

  @IsString()
  @IsOptional()
  REDIS_URL?: string;
}

export function validate(config: Record<string, unknown>) {
  // Преобразуем значения перед валидацией
  const transformedConfig = {
    PORT: Number(config.PORT || '8080'),
    DB_HOST: String(config.DB_HOST || ''),
    DB_PORT: Number(config.DB_PORT || '5432'),
    DB_USERNAME: String(config.DB_USERNAME || ''),
    DB_PASSWORD: String(config.DB_PASSWORD || ''),
    DB_NAME: String(config.DB_NAME || ''),
    NODE_ENV: String(config.NODE_ENV || 'production'),
    JWT_SECRET: String(config.JWT_SECRET || ''),
    JWT_EXPIRATION_TIME: String(config.JWT_EXPIRATION_TIME || '24h'),
    RATE_LIMIT_MAX: Number(config.RATE_LIMIT_MAX || '100'),
    RATE_LIMIT_WINDOW_MS: Number(config.RATE_LIMIT_WINDOW_MS || '900000'),
    TYPEORM_LOGGING: config.TYPEORM_LOGGING === 'true' || config.TYPEORM_LOGGING === true || config.TYPEORM_LOGGING === '1',
    TYPEORM_SYNCHRONIZE: config.TYPEORM_SYNCHRONIZE === 'true' || config.TYPEORM_SYNCHRONIZE === true || config.TYPEORM_SYNCHRONIZE === '1',
    REDIS_ENABLED: config.REDIS_ENABLED === 'true' || config.REDIS_ENABLED === true || config.REDIS_ENABLED === '1',
    REDIS_URL: config.REDIS_URL ? String(config.REDIS_URL) : undefined,
  };

  const validatedConfig = plainToInstance(EnvironmentVariables, transformedConfig);
  
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
    whitelist: true,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
} 