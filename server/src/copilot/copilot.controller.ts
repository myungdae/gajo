import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CopilotAuthGuard, CopilotAuthService } from './copilot-auth';
import { CopilotService } from './copilot.service';

@Controller('api/copilot')
export class CopilotController {
  constructor(private service:CopilotService,private auth:CopilotAuthService){}
  @Post('auth/login') login(@Body()body:any){return this.auth.login(body?.username,body?.password)}
  @Post('assignments/:sub')@UseGuards(CopilotAuthGuard)assign(@Req()req:any,@Param('sub')sub:string,@Body()body:any){return this.auth.assign(req.copilotUser,sub,body?.role,body?.regions)}
  @Get('home')@UseGuards(CopilotAuthGuard)async home(@Req()req:any,@Query('regionId')regionId:string){const tasks=await this.service.queue(req.copilotUser,regionId);return{regionId,total:tasks.length,counts:{searchDiscovered:tasks.filter(x=>x.type==='SEARCH_DISCOVERED_ENTITY').length,newCandidates:tasks.filter(x=>x.type==='NEW_ENTITY_CANDIDATE').length,dataChanges:tasks.filter(x=>x.type==='DATA_CHANGE_CANDIDATE').length,unverified:tasks.filter(x=>x.type==='UNVERIFIED_ENTITY').length},tasks}}
  @Get('tasks')@UseGuards(CopilotAuthGuard)async tasks(@Req()req:any,@Query('regionId')regionId:string,@Query('q')q=''){const tasks=await this.service.queue(req.copilotUser,regionId);if(/검색.*발견/.test(q))return tasks.filter(x=>x.type==='SEARCH_DISCOVERED_ENTITY');if(/미검증/.test(q))return tasks.filter(x=>x.type==='UNVERIFIED_ENTITY'||x.type==='SEARCH_DISCOVERED_ENTITY');return tasks}
  @Get('candidates/:id')@UseGuards(CopilotAuthGuard)detail(@Req()req:any,@Param('id')id:string){return this.service.detail(req.copilotUser,id)}
  @Post('candidates/:id/review')@UseGuards(CopilotAuthGuard)review(@Req()req:any,@Param('id')id:string,@Body()body:any){return this.service.review(req.copilotUser,id,body?.editedFacts)}
  @Post('candidates/:id/activate')@UseGuards(CopilotAuthGuard)activate(@Req()req:any,@Param('id')id:string,@Body()body:any){return this.service.activate(req.copilotUser,id,body?.confirmed===true,body?.duplicateAcknowledged===true)}
  @Post('candidates/:id/reject')@UseGuards(CopilotAuthGuard)reject(@Req()req:any,@Param('id')id:string){return this.service.reject(req.copilotUser,id)}
}
