import { plainToInstance, Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsNumber()
  @Transform(({ value }) => Number(value || '8080'))
  PORT: number;

  @IsString()
  @Transform(({ value }) => value || '')
  DB_HOST: string;

  @IsNumber()
  @Transform(({ value }) => Number(value || '5432'))
  DB_PORT: number;

  @IsString()
  @Transform(({ value }) => value || '')
  DB_USERNAME: string;

  @IsString()
  @Transform(({ value }) => value || '')
  DB_PASSWORD: string;

  @IsString()
  @Transform(({ value }) => value || '')
  DB_NAME: string;

  @IsString()
  @Transform(({ value }) => value || 'production')
  NODE_ENV: string;

  @IsString()
  @Transform(({ value }) => value || '')
  JWT_SECRET: string;

  @IsString()
  @Transform(({ value }) => value || '24h')
  JWT_EXPIRATION_TIME: string;

  @IsNumber()
  @Transform(({ value }) => Number(value || '100'))
  RATE_LIMIT_MAX: number;

  @IsNumber()
  @Transform(({ value }) => Number(value || '900000'))
  RATE_LIMIT_WINDOW_MS: number;

  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true || value === '1')
  TYPEORM_LOGGING: boolean;

  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true || value === '1')
  TYPEORM_SYNCHRONIZE: boolean;

  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true || value === '1')
  REDIS_ENABLED: boolean;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => value || '')
  REDIS_URL?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
    excludeExtraneousValues: true,
  });
  
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
    whitelist: true,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
} 