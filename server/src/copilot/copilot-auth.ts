import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Optional, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CopilotAssignment } from './copilot-assignment.schema';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { requireRegionId } from '../region/regional-isolation';

export type CopilotRole='VIEWER'|'REGIONAL_MANAGER'|'PLATFORM_ADMIN';
export interface CopilotPrincipal { sub:string; username:string; role:CopilotRole; regions:string[] }
export const COPILOT_ROLES='copilot_roles';
export const CopilotRoles=(...roles:CopilotRole[])=>SetMetadata(COPILOT_ROLES,roles);

@Injectable()
export class CopilotAuthService {
  constructor(@Optional()@InjectModel(CopilotAssignment.name)private assignments?:Model<CopilotAssignment>){}
  private secret(){const value=process.env.COPILOT_JWT_SECRET;if(!value)throw new ForbiddenException('COPILOT_JWT_SECRET is not configured');return value}
  private users():Array<CopilotPrincipal&{passwordHash:string}>{try{return JSON.parse(process.env.COPILOT_USERS_JSON||'[]')}catch{return[]}}
  async login(username:string,password:string){const user=this.users().find(x=>x.username===username);if(!user||!await bcrypt.compare(password,user.passwordHash))throw new UnauthorizedException('Invalid credentials');const override:any=this.assignments?await this.assignments.findOne({sub:user.sub}).lean():undefined;const principal={sub:user.sub,username:user.username,role:(override?.role||user.role)as CopilotRole,regions:override?.regions||user.regions||[]};return{accessToken:jwt.sign(principal,this.secret(),{expiresIn:'8h'}),principal}}
  async assign(actor:CopilotPrincipal,sub:string,role:CopilotRole,regions:string[]){if(actor.role!=='PLATFORM_ADMIN')throw new ForbiddenException('Platform admin required');if(!['VIEWER','REGIONAL_MANAGER','PLATFORM_ADMIN'].includes(role)||!sub||!Array.isArray(regions))throw new ForbiddenException('Invalid assignment');if(!this.assignments)throw new ForbiddenException('Assignment store unavailable');return this.assignments.findOneAndUpdate({sub},{$set:{role,regions:[...new Set(regions)],updatedBy:actor.sub}},{upsert:true,new:true}).lean()}
  verify(token:string){try{return jwt.verify(token,this.secret()) as CopilotPrincipal}catch{throw new UnauthorizedException('Invalid Copilot token')}}
}
@Injectable()
export class CopilotAuthGuard implements CanActivate {
  constructor(private auth:CopilotAuthService){}
  canActivate(context:ExecutionContext){const request=context.switchToHttp().getRequest(),header=String(request.headers.authorization||''),token=header.startsWith('Bearer ')?header.slice(7):'';if(!token)throw new UnauthorizedException('Copilot authentication required');request.copilotUser=this.auth.verify(token);return true}
}
export function assertCopilotAccess(user:CopilotPrincipal,regionId:string,write=false){const region=requireRegionId(regionId,'Copilot access');if(user.role==='PLATFORM_ADMIN')return;if(write&&user.role!=='REGIONAL_MANAGER')throw new ForbiddenException('Manager role required');if(!user.regions.includes(region))throw new ForbiddenException('Region assignment required')}
