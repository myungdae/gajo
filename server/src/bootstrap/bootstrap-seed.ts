import { NestFactory } from '@nestjs/core';
import { requireExplicitBootstrapSeed } from './startup-data-policy';
import { AppModule } from '../app.module';

async function bootstrapSeed() {
  requireExplicitBootstrapSeed();
  const app = await NestFactory.createApplicationContext(AppModule);
  await app.close();
}

void bootstrapSeed();
