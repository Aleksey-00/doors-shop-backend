import { plainToInstance, Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsNumber()
  @Transform(({ value }) => {
    const num = Number(value);
    console.log('PORT transform:', value, '->', num);
    return num;
  })
  PORT: number;

  @IsString()
  @Transform(({ value }) => {
    console.log('DB_HOST transform:', value);
    return String(value);
  })
  DB_HOST: string;

  @IsNumber()
  @Transform(({ value }) => {
    const num = Number(value);
    console.log('DB_PORT transform:', value, '->', num);
    return num;
  })
  DB_PORT: number;

  @IsString()
  @Transform(({ value }) => {
    console.log('DB_USERNAME transform:', value);
    return String(value);
  })
  DB_USERNAME: string;

  @IsString()
  @Transform(({ value }) => {
    console.log('DB_PASSWORD transform:', value);
    return String(value);
  })
  DB_PASSWORD: string;

  @IsString()
  @Transform(({ value }) => {
    console.log('DB_NAME transform:', value);
    return String(value);
  })
  DB_NAME: string;

  @IsString()
  @Transform(({ value }) => {
    console.log('NODE_ENV transform:', value);
    return String(value);
  })
  NODE_ENV: string;

  @IsString()
  @Transform(({ value }) => {
    console.log('JWT_SECRET transform:', value);
    return String(value);
  })
  JWT_SECRET: string;

  @IsString()
  @Transform(({ value }) => {
    console.log('JWT_EXPIRATION_TIME transform:', value);
    return String(value);
  })
  JWT_EXPIRATION_TIME: string;

  @IsNumber()
  @Transform(({ value }) => {
    const num = Number(value);
    console.log('RATE_LIMIT_MAX transform:', value, '->', num);
    return num;
  })
  RATE_LIMIT_MAX: number;

  @IsNumber()
  @Transform(({ value }) => {
    const num = Number(value);
    console.log('RATE_LIMIT_WINDOW_MS transform:', value, '->', num);
    return num;
  })
  RATE_LIMIT_WINDOW_MS: number;

  @IsBoolean()
  @Transform(({ value }) => {
    const bool = value === 'true' || value === true || value === '1';
    console.log('TYPEORM_LOGGING transform:', value, '->', bool);
    return bool;
  })
  TYPEORM_LOGGING: boolean;

  @IsBoolean()
  @Transform(({ value }) => {
    const bool = value === 'true' || value === true || value === '1';
    console.log('TYPEORM_SYNCHRONIZE transform:', value, '->', bool);
    return bool;
  })
  TYPEORM_SYNCHRONIZE: boolean;

  @IsBoolean()
  @Transform(({ value }) => {
    const bool = value === 'true' || value === true || value === '1';
    console.log('REDIS_ENABLED transform:', value, '->', bool);
    return bool;
  })
  REDIS_ENABLED: boolean;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => {
    console.log('REDIS_URL transform:', value);
    return value ? String(value) : undefined;
  })
  REDIS_URL?: string;
}

export function validate(config: Record<string, unknown>) {
  console.log('Raw config:', config);
  
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
    excludeExtraneousValues: true,
  });
  
  console.log('Transformed config:', validatedConfig);
  
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
    whitelist: true,
  });

  if (errors.length > 0) {
    console.error('Validation errors:', errors);
    throw new Error(errors.toString());
  }
  return validatedConfig;
} 