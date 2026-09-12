import { Module } from '@nestjs/common';
import { GraphTraversalService } from './graph-traversal.service';
import { RuntimeContextService } from './runtime-context.service';
import { ContextController } from './context.controller';
import { OntologyModule } from '../ontology/ontology.module';
import { SeedModule } from '../seed/seed.module';
import { LiveWeatherProviderService } from './live-weather-provider.service';
import { LiveRuntimeHydrationService } from './live-runtime-hydration.service';
import { SafetyAlertProviderService } from './safety-alert-provider.service';
import { LiveRuntimeController } from './live-runtime.controller';
import { EntityLocationService } from './entity-location.service';
import { LocationHydrationService } from './location-hydration.service';
import { MasterDataModule } from '../master-data/master-data.module';
import { ConfigService } from '@nestjs/config';
import { CONTEXT_EXTRACTOR } from './context-extractor.types';
import { OpenAIContextExtractor } from './openai-context-extractor';
import { ContextExtractionGateway } from './context-extraction.gateway';
import { PlaceWeatherContextProvider } from './place-weather-context.provider';
import { AiUsageModule } from '../admin/ai-usage.module';

@Module({
  imports: [OntologyModule, SeedModule, MasterDataModule, AiUsageModule],
  providers: [GraphTraversalService, RuntimeContextService, LiveWeatherProviderService, LiveRuntimeHydrationService, SafetyAlertProviderService, PlaceWeatherContextProvider, EntityLocationService, LocationHydrationService, ContextExtractionGateway,
    { provide: CONTEXT_EXTRACTOR, inject: [ConfigService], useFactory: (config:ConfigService) => {
      const provider=(config.get<string>('CONTEXT_EXTRACTOR_PROVIDER')||'openai').toLowerCase();
      if(provider==='openai') return new OpenAIContextExtractor(config);
      return { extract: async () => ({status:'DISABLED' as const,provider,latencyMs:0,errorCode:'UNSUPPORTED_PROVIDER'}) };
    }}],
  controllers: [ContextController, LiveRuntimeController],
  exports: [GraphTraversalService, RuntimeContextService, LiveRuntimeHydrationService, PlaceWeatherContextProvider, EntityLocationService, LocationHydrationService, ContextExtractionGateway],
})
export class ContextModule {}
