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

type KmaWarningRow = {
  regUp: string;
  regUpKo: string;
  regId: string;
  regKo: string;
  tmFc: string;
  tmEf: string;
  wrn: string;
  lvl: string;
  cmd: string;
  edTm?: string;
};

const KMA_WARNING_URL =
  'https://apihub.kma.go.kr/api/typ01/url/wrn_now_data.php';

const HAPCHEON_KMA_REGION_IDS = new Set([
  'L1083400',
  'L1083410',
  'L1083420',
  'L1083430',
]);

@Injectable()
export class SafetyAlertProviderService {
  constructor(private readonly config: ConfigService) {}

  isKmaConfigured(): boolean {
    return Boolean(
      this.config.get<string>('KMA_API_AUTH_KEY')?.trim(),
    );
  }

  async getActiveAlerts(regionId: string): Promise<SafetyAlertResult> {
    const checkedAt = new Date().toISOString();

    const authKey = this.config
      .get<string>('KMA_API_AUTH_KEY')
      ?.trim();

    if (!authKey) {
      return {
        status: 'NOT_CONFIGURED',
        source: 'KMA',
        checkedAt,
        alerts: [],
      };
    }

    if (regionId !== 'hapcheon') {
      return {
        status: 'READY',
        source: 'KMA',
        checkedAt,
        alerts: [],
      };
    }

    try {
      const tm = this.toKmaMinute(new Date());

      const url = new URL(KMA_WARNING_URL);
      url.searchParams.set('fe', 'f');
      url.searchParams.set('tm', tm);
      url.searchParams.set('disp', '0');
      url.searchParams.set('help', '0');
      url.searchParams.set('authKey', authKey);

      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return {
          status: 'UNAVAILABLE',
          source: 'KMA',
          checkedAt,
          alerts: [],
        };
      }

      const text = await response.text();

      const rows = this.parseKmaWarningRows(text);

      const alerts = rows
        .filter((row) => HAPCHEON_KMA_REGION_IDS.has(row.regId))
        .map((row) => this.toSafetyAlert(regionId, row));

      return {
        status: 'READY',
        source: 'KMA',
        checkedAt,
        alerts,
      };
    } catch {
      return {
        status: 'UNAVAILABLE',
        source: 'KMA',
        checkedAt,
        alerts: [],
      };
    }
  }

  private parseKmaWarningRows(text: string): KmaWarningRow[] {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith('#'))
      .map((line) => line.split(/\s+/))
      .filter((parts) => parts.length >= 9)
      .map((parts) => ({
        regUp: parts[0],
        regUpKo: parts[1],
        regId: parts[2],
        regKo: parts[3],
        tmFc: parts[4],
        tmEf: parts[5],
        wrn: parts[6],
        lvl: parts[7],
        cmd: parts[8],
        edTm: parts[9],
      }))
      .filter((row) => /^L\d+$/.test(row.regId));
  }

  private toSafetyAlert(
    regionId: string,
    row: KmaWarningRow,
  ): SafetyAlert {
    return {
      id: `kma:${row.regId}:${row.tmFc}:${row.wrn}:${row.lvl}:${row.cmd}`,
      regionId,
      alertType: row.wrn,
      title: `${row.regKo} 기상특보 (${row.wrn}/${row.lvl})`,
      severity: 'MEDIUM',
      issuedAt: this.kmaTimeToIso(row.tmFc),
      effectiveFrom: this.kmaTimeToIso(row.tmEf),
      effectiveUntil: row.edTm
        ? this.kmaTimeToIso(row.edTm)
        : undefined,
      source: 'KMA',
      sourceName: '기상청',
      sourceUrl: 'https://apihub.kma.go.kr/',
      rawRegionName: row.regKo,
    };
  }

  private toKmaMinute(date: Date): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });

    const parts = Object.fromEntries(
      formatter
        .formatToParts(date)
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    );

    return (
      parts.year +
      parts.month +
      parts.day +
      parts.hour +
      parts.minute
    );
  }

  private kmaTimeToIso(value?: string): string {
    if (!value || !/^\d{12}$/.test(value)) {
      return new Date().toISOString();
    }

    const year = value.slice(0, 4);
    const month = value.slice(4, 6);
    const day = value.slice(6, 8);
    const hour = value.slice(8, 10);
    const minute = value.slice(10, 12);

    return new Date(
      `${year}-${month}-${day}T${hour}:${minute}:00+09:00`,
    ).toISOString();
  }
}