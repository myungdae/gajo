import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Optional,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CopilotAssignment } from './copilot-assignment.schema';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { requireRegionId } from '../region/regional-isolation';

export type CopilotRole = 'VIEWER' | 'REGIONAL_MANAGER' | 'PLATFORM_ADMIN';
export interface CopilotPrincipal {
  sub: string;
  username: string;
  role: CopilotRole;
  regions: string[];
}
type ConfiguredUser = CopilotPrincipal & { passwordHash: string };
export const COPILOT_ROLES = 'copilot_roles';
export const CopilotRoles = (...roles: CopilotRole[]) =>
  SetMetadata(COPILOT_ROLES, roles);

@Injectable()
export class CopilotAuthService {
  constructor(
    @Optional()
    @InjectModel(CopilotAssignment.name)
    private assignments?: Model<CopilotAssignment>,
  ) {}

  private secret() {
    const value = process.env.COPILOT_JWT_SECRET;
    if (!value)
      throw new ForbiddenException('COPILOT_JWT_SECRET is not configured');
    return value;
  }

  private users(): ConfiguredUser[] {
    try {
      return JSON.parse(process.env.COPILOT_USERS_JSON || '[]');
    } catch {
      return [];
    }
  }

  private userByUsername(username: string) {
    return this.users().find((user) => user.username === username);
  }

  private userBySub(sub: string) {
    return this.users().find((user) => user.sub === sub);
  }

  private async override(sub: string) {
    return this.assignments
      ? ((await this.assignments.findOne({ sub }).lean()) as any)
      : undefined;
  }

  async login(username: string, password: string) {
    const user = this.userByUsername(username);
    if (!user)
      throw new UnauthorizedException('Invalid credentials');
    const override = await this.override(user.sub);
    const passwordHash = override?.passwordHash || user.passwordHash;
    if (
      typeof password !== 'string' ||
      !(await bcrypt.compare(password, passwordHash))
    )
      throw new UnauthorizedException('Invalid credentials');
    const principal = {
      sub: user.sub,
      username: user.username,
      role: (override?.role || user.role) as CopilotRole,
      regions: override?.regions || user.regions || [],
    };
    return {
      accessToken: jwt.sign(principal, this.secret(), { expiresIn: '8h' }),
      principal,
    };
  }

  async changePassword(
    actor: CopilotPrincipal,
    currentPassword: unknown,
    newPassword: unknown,
  ) {
    const user = this.userBySub(actor?.sub);
    if (!user || user.username !== actor.username)
      throw new ForbiddenException('Configured account required');
    if (!this.assignments)
      throw new ForbiddenException('Credential store unavailable');
    if (
      typeof currentPassword !== 'string' ||
      typeof newPassword !== 'string'
    )
      throw new BadRequestException('현재 비밀번호와 새 비밀번호를 입력해 주세요.');
    if (newPassword.length < 12 || newPassword.length > 128)
      throw new BadRequestException('새 비밀번호는 12자 이상 128자 이하로 입력해 주세요.');

    const override = await this.override(user.sub);
    const activeHash = override?.passwordHash || user.passwordHash;
    if (!(await bcrypt.compare(currentPassword, activeHash)))
      throw new UnauthorizedException('현재 비밀번호가 올바르지 않습니다.');
    if (await bcrypt.compare(newPassword, activeHash))
      throw new BadRequestException('현재 비밀번호와 다른 새 비밀번호를 입력해 주세요.');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.assignments.findOneAndUpdate(
      { sub: user.sub },
      {
        $set: { passwordHash, updatedBy: user.sub },
        $setOnInsert: { role: user.role, regions: user.regions || [] },
      },
      { upsert: true, new: true },
    );
    return { changed: true };
  }

  async assign(
    actor: CopilotPrincipal,
    sub: string,
    role: CopilotRole,
    regions: string[],
  ) {
    if (actor.role !== 'PLATFORM_ADMIN')
      throw new ForbiddenException('Platform admin required');
    if (
      !['VIEWER', 'REGIONAL_MANAGER', 'PLATFORM_ADMIN'].includes(role) ||
      !sub ||
      !Array.isArray(regions)
    )
      throw new ForbiddenException('Invalid assignment');
    if (!this.assignments)
      throw new ForbiddenException('Assignment store unavailable');
    return this.assignments
      .findOneAndUpdate(
        { sub },
        {
          $set: {
            role,
            regions: [...new Set(regions)],
            updatedBy: actor.sub,
          },
        },
        { upsert: true, new: true },
      )
      .lean();
  }

  verify(token: string) {
    try {
      return jwt.verify(token, this.secret()) as CopilotPrincipal;
    } catch {
      throw new UnauthorizedException('Invalid Copilot token');
    }
  }
}

@Injectable()
export class CopilotAuthGuard implements CanActivate {
  constructor(private auth: CopilotAuthService) {}
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const header = String(request.headers.authorization || '');
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token)
      throw new UnauthorizedException('Copilot authentication required');
    request.copilotUser = this.auth.verify(token);
    return true;
  }
}

export function assertCopilotAccess(
  user: CopilotPrincipal,
  regionId: string,
  write = false,
) {
  const region = requireRegionId(regionId, 'Copilot access');
  if (user.role === 'PLATFORM_ADMIN') return;
  if (write && user.role !== 'REGIONAL_MANAGER')
    throw new ForbiddenException('Manager role required');
  if (!user.regions.includes(region))
    throw new ForbiddenException('Region assignment required');
}
