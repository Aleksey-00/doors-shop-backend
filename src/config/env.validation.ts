import { plainToClass } from 'class-transformer';
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
  // Преобразуем строковые значения в соответствующие типы
  const transformedConfig = {
    ...config,
    PORT: parseInt(config.PORT as string, 10),
    DB_PORT: parseInt(config.DB_PORT as string, 10),
    RATE_LIMIT_MAX: parseInt(config.RATE_LIMIT_MAX as string, 10),
    RATE_LIMIT_WINDOW_MS: parseInt(config.RATE_LIMIT_WINDOW_MS as string, 10),
    TYPEORM_LOGGING: config.TYPEORM_LOGGING === 'true',
    TYPEORM_SYNCHRONIZE: config.TYPEORM_SYNCHRONIZE === 'true',
    REDIS_ENABLED: config.REDIS_ENABLED === 'true',
  };

  const validatedConfig = plainToClass(EnvironmentVariables, transformedConfig, {
    enableImplicitConversion: true,
  });
  
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
} 