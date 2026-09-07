// Read existing public evidence only. No application bootstrap or aggregation writes.
const mongoose = require('mongoose');
const { RegionalDataRecord, RegionalDataRecordSchema } = require('../dist/regional-data/regional-data.schema');
const { Partner, PartnerSchema } = require('../dist/partner/partner.schema');
const { TourismNetworkAggregate, TourismNetworkAggregateSchema } = require('../dist/regional-report/tourism-network-aggregate.schema');
const { RegionalDataService } = require('../dist/regional-data/regional-data.service');
const { RegionalReportService } = require('../dist/regional-report/regional-report.service');
const { TourismNetworkAggregationService } = require('../dist/regional-report/tourism-network-aggregation.service');

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('Missing connection');
  const connection = mongoose.createConnection(process.env.MONGODB_URI, {
    autoCreate: false, autoIndex: false, serverSelectionTimeoutMS: 10000,
  });
  try {
    await connection.asPromise();
    const partners = connection.model(Partner.name, PartnerSchema);
    const aggregates = connection.model(TourismNetworkAggregate.name, TourismNetworkAggregateSchema);
    const records = connection.model(RegionalDataRecord.name, RegionalDataRecordSchema);
    const network = new TourismNetworkAggregationService(undefined, undefined, partners, aggregates);
    const report = await new RegionalReportService(undefined, undefined, partners, new RegionalDataService(records), network).ecosystem('hapcheon');
    const smileIds = new Set(report.nodes.filter(n => /스마일펜션/.test(n.label.replace(/\s/g, ''))).map(n => n.id));
    const counts = edges => Object.fromEntries(['RESOURCE_RELATIONSHIP', 'INTEREST', 'MOVEMENT_INTENT', 'VERIFIED_USE']
      .map(level => [level, edges.filter(e => e.evidenceLevel === level).length]));
    console.log(JSON.stringify({
      checkedAt: new Date().toISOString(), mode: 'READ_ONLY_EXISTING_PUBLIC_SNAPSHOT',
      snapshotAvailable: Boolean(report.usage.start),
      period: { start: report.usage.start, endExclusive: report.usage.endExclusive },
      publicEdgeCounts: counts(report.edges),
      smile: { publicResourceFound: smileIds.size > 0, publicEdgeCounts: counts(report.edges.filter(e => smileIds.has(e.source) || smileIds.has(e.target))) },
      privacy: report.privacy,
      notice: '공개 가능한 관계만 집계합니다. 비공개 관계의 존재·건수는 추정하지 않습니다. 스냅샷 부재는 행동 부재를 의미하지 않습니다.',
    }, null, 2));
  } finally {
    await connection.close();
  }
}
main().catch(() => {
  console.error('Read-only evidence audit failed. Check the configured connection and server build; connection details are not printed.');
  process.exitCode = 1;
});
