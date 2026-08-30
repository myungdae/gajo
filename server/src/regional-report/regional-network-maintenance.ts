import { NestFactory } from '@nestjs/core';
import { RegionalNetworkMaintenanceModule } from './regional-network-maintenance.module';
import { TourismNetworkJobService } from './tourism-network-job.service';

async function run() {
  if (process.env.REGIONAL_NETWORK_MAINTENANCE_APPROVED !== 'true')
    throw new Error('Explicit maintenance approval environment is required');
  const app = await NestFactory.createApplicationContext(
    RegionalNetworkMaintenanceModule,
    { logger: ['error', 'warn'] },
  );
  try {
    const result = await app.get(TourismNetworkJobService).runDaily();
    process.stdout.write(
      `${JSON.stringify({
        status: 'COMPLETE',
        regions: result.regions,
        previousMonthRecomputed: result.previousMonthRecomputed,
        unlinkModified: result.unlinkModified,
      })}\n`,
    );
  } finally {
    await app.close();
  }
}

void run().catch(() => {
  process.stderr.write('Regional network maintenance failed.\n');
  process.exitCode = 1;
});
