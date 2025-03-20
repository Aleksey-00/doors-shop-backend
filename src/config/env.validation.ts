import { plainToInstance, Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  PORT: number;

  @IsString()
  DB_HOST: string;

  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
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
  @Transform(({ value }) => parseInt(value, 10))
  RATE_LIMIT_MAX: number;

  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  RATE_LIMIT_WINDOW_MS: number;

  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  TYPEORM_LOGGING: boolean;

  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  TYPEORM_SYNCHRONIZE: boolean;

  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  REDIS_ENABLED: boolean;

  @IsString()
  @IsOptional()
  REDIS_URL?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
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