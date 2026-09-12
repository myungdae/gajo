import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type SafetyAlertSeverity =
  | 'INFO'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

export interface SafetyAlert {
  id: string;
  regionId: string;
  alertType: string;
  title: string;
  severity: SafetyAlertSeverity;
  issuedAt: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
  source: 'KMA' | 'MOIS' | 'OTHER_OFFICIAL';
  sourceName: string;
  sourceUrl?: string;
  rawRegionName?: string;
}

export type SafetyAlertProviderStatus =
  | 'READY'
  | 'NOT_CONFIGURED'
  | 'UNAVAILABLE';

export interface SafetyAlertResult {
  status: SafetyAlertProviderStatus;
  source: 'KMA';
  checkedAt: string;
  alerts: SafetyAlert[];
}

@Injectable()
export class SafetyAlertProviderService {
  constructor(private readonly config: ConfigService) {}

  isKmaConfigured(): boolean {
    return Boolean(this.config.get<string>('KMA_API_AUTH_KEY')?.trim());
  }

  async getActiveAlerts(regionId: string): Promise<SafetyAlertResult> {
    const checkedAt = new Date().toISOString();

    if (!this.isKmaConfigured()) {
      return {
        status: 'NOT_CONFIGURED',
        source: 'KMA',
        checkedAt,
        alerts: [],
      };
    }

    // KMA live request will be connected after the official auth key
    // and exact API contract are confirmed.
    void regionId;

    return {
      status: 'READY',
      source: 'KMA',
      checkedAt,
      alerts: [],
    };
  }
}