import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import * as bcrypt from 'bcrypt';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    const userRepository = app.get(getRepositoryToken(User));
    
    const admin = await userRepository.findOne({
      where: { email: 'admin@example.com' }
    });

    if (!admin) {
      console.log('Admin user not found');
      return;
    }

    const hashedPassword = await bcrypt.hash('admin123', 10);
    admin.password = hashedPassword;
    
    await userRepository.save(admin);
    console.log('Admin password updated successfully');
  } catch (error) {
    console.error('Error updating admin password:', error.message);
  } finally {
    await app.close();
  }
}

bootstrap(); 