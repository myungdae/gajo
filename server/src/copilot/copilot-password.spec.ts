import * as bcrypt from 'bcryptjs';
import { CopilotAuthService } from './copilot-auth';

describe('Copilot self-service password change', () => {
  const savedUsers = process.env.COPILOT_USERS_JSON;
  const savedSecret = process.env.COPILOT_JWT_SECRET;
  let override: any;
  let assignments: any;
  let auth: CopilotAuthService;

  beforeEach(async () => {
    override = undefined;
    process.env.COPILOT_JWT_SECRET = 'fixture-secret';
    process.env.COPILOT_USERS_JSON = JSON.stringify([
      {
        sub: 'hapcheon-manager-1',
        username: 'hapcheon-manager',
        role: 'REGIONAL_MANAGER',
        regions: ['hapcheon'],
        passwordHash: await bcrypt.hash('Initial-password-1', 4),
      },
    ]);
    assignments = {
      findOne: jest.fn(() => ({ lean: async () => override })),
      findOneAndUpdate: jest.fn(async (_filter, update) => {
        override = {
          ...(override || {}),
          sub: 'hapcheon-manager-1',
          role: 'REGIONAL_MANAGER',
          regions: ['hapcheon'],
          ...update.$setOnInsert,
          ...update.$set,
        };
        return override;
      }),
    };
    auth = new CopilotAuthService(assignments);
  });

  afterAll(() => {
    if (savedUsers === undefined) delete process.env.COPILOT_USERS_JSON;
    else process.env.COPILOT_USERS_JSON = savedUsers;
    if (savedSecret === undefined) delete process.env.COPILOT_JWT_SECRET;
    else process.env.COPILOT_JWT_SECRET = savedSecret;
  });

  it('changes only the authenticated account hash and uses it on the next login', async () => {
    const first = await auth.login('hapcheon-manager', 'Initial-password-1');
    expect(first.principal.regions).toEqual(['hapcheon']);

    await expect(
      auth.changePassword(first.principal, 'wrong-password', 'Changed-password-2'),
    ).rejects.toThrow('현재 비밀번호가 올바르지 않습니다.');
    await expect(
      auth.changePassword(first.principal, 'Initial-password-1', 'short'),
    ).rejects.toThrow('12자 이상');

    await expect(
      auth.changePassword(
        first.principal,
        'Initial-password-1',
        'Changed-password-2',
      ),
    ).resolves.toEqual({ changed: true });

    const update = assignments.findOneAndUpdate.mock.calls[0][1];
    expect(update.$set.passwordHash).not.toBe('Changed-password-2');
    expect(update.$set.updatedBy).toBe('hapcheon-manager-1');
    expect(await bcrypt.compare('Changed-password-2', update.$set.passwordHash)).toBe(true);

    await expect(
      auth.login('hapcheon-manager', 'Initial-password-1'),
    ).rejects.toThrow('Invalid credentials');
    await expect(
      auth.login('hapcheon-manager', 'Changed-password-2'),
    ).resolves.toEqual(
      expect.objectContaining({
        principal: expect.objectContaining({
          username: 'hapcheon-manager',
          regions: ['hapcheon'],
        }),
      }),
    );
  });
});
