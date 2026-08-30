/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { CopilotService } from '../copilot/copilot.service';
import { PartnerService } from '../partner/partner.service';
import { RegionalDataService } from '../regional-data/regional-data.service';
import { OntologySyncService } from '../seed/ontology-sync.service';

describe('production bootstrap is read-only', () => {
  const originalNodeEnv = process.env.NODE_ENV,
    originalEntry = process.env.BOOTSTRAP_SEED_ENTRYPOINT,
    originalApproval = process.env.BOOTSTRAP_SEED_APPROVED;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    delete process.env.BOOTSTRAP_SEED_ENTRYPOINT;
    delete process.env.BOOTSTRAP_SEED_APPROVED;
  });
  afterAll(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalEntry === undefined)
      delete process.env.BOOTSTRAP_SEED_ENTRYPOINT;
    else process.env.BOOTSTRAP_SEED_ENTRYPOINT = originalEntry;
    if (originalApproval === undefined)
      delete process.env.BOOTSTRAP_SEED_APPROVED;
    else process.env.BOOTSTRAP_SEED_APPROVED = originalApproval;
  });
  it('validates Copilot documents twice and concurrently without writes', async () => {
    const candidates = {
        findOne: jest.fn(() => Promise.resolve({})),
        create: jest.fn(),
      },
      cores = {
        findOne: jest.fn(() => Promise.resolve({})),
        updateOne: jest.fn(),
      },
      service = new CopilotService(candidates as any, {} as any, cores as any);
    await service.onModuleInit();
    await service.onModuleInit();
    await Promise.all([service.onModuleInit(), service.onModuleInit()]);
    expect(candidates.create).not.toHaveBeenCalled();
    expect(cores.updateOne).not.toHaveBeenCalled();
  });
  it('fails production Copilot startup when required state is missing', async () => {
    const service = new CopilotService(
      {
        findOne: jest.fn(() => Promise.resolve(null)),
        create: jest.fn(),
      } as any,
      {} as any,
      {
        findOne: jest.fn(() => Promise.resolve(null)),
        updateOne: jest.fn(),
      } as any,
    );
    await expect(service.onModuleInit()).rejects.toThrow(
      'Copilot bootstrap validation failed',
    );
  });
  it('validates regional and partner state without update or upsert', async () => {
    const regionalModel = {
        findOne: jest.fn(() => Promise.resolve({})),
        updateOne: jest.fn(),
      },
      regional = new RegionalDataService(regionalModel as any),
      partners = {
        findOne: jest.fn(() => Promise.resolve({})),
        updateOne: jest.fn(),
      },
      partner = new PartnerService(
        partners as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );
    await regional.onModuleInit();
    await regional.onModuleInit();
    await partner.onModuleInit();
    await partner.onModuleInit();
    expect(regionalModel.updateOne).not.toHaveBeenCalled();
    expect(partners.updateOne).not.toHaveBeenCalled();
  });
  it('validates ontology projections without materializing them', async () => {
    const model = () => ({
        findOne: jest.fn(() => Promise.resolve({})),
        findOneAndUpdate: jest.fn(),
      }),
      models = Array.from({ length: 14 }, model),
      graph = {
        individualsOfIncludingSubclasses: jest.fn(() => ['synthetic:one']),
      },
      service = new OntologySyncService(graph as any, ...(models as any));
    await service.onModuleInit();
    await service.onModuleInit();
    expect(models.every((item) => item.findOne.mock.calls.length === 2)).toBe(
      true,
    );
    expect(
      models.every((item) => item.findOneAndUpdate.mock.calls.length === 0),
    ).toBe(true);
  });
});
