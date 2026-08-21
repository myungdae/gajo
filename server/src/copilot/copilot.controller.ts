import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CopilotAuthGuard, CopilotAuthService } from './copilot-auth';
import { CopilotService } from './copilot.service';

@Controller('api/copilot')
export class CopilotController {
  constructor(
    private service: CopilotService,
    private auth: CopilotAuthService,
  ) {}
  @Post('auth/login') login(@Body() body: any) {
    return this.auth.login(body?.username, body?.password);
  }
  @Post('assignments/:sub') @UseGuards(CopilotAuthGuard) assign(
    @Req() req: any,
    @Param('sub') sub: string,
    @Body() body: any,
  ) {
    return this.auth.assign(req.copilotUser, sub, body?.role, body?.regions);
  }
  @Get('home') @UseGuards(CopilotAuthGuard) async home(
    @Req() req: any,
    @Query('regionId') regionId: string,
  ) {
    const [tasks, coreCoverage] = await Promise.all([
      this.service.queue(req.copilotUser, regionId),
      this.service.coreHealth(req.copilotUser, regionId),
    ]);
    return {
      regionId,
      total: tasks.length,
      counts: {
        searchDiscovered: tasks.filter(
          (x) => x.type === 'SEARCH_DISCOVERED_ENTITY',
        ).length,
        newCandidates: tasks.filter((x) => x.type === 'NEW_ENTITY_CANDIDATE')
          .length,
        dataChanges: tasks.filter((x) => x.type === 'DATA_CHANGE_CANDIDATE')
          .length,
        unverified: tasks.filter((x) => x.type === 'UNVERIFIED_ENTITY').length,
      },
      coreCoverage,
      tasks,
    };
  }
  @Get('tasks') @UseGuards(CopilotAuthGuard) async tasks(
    @Req() req: any,
    @Query('regionId') regionId: string,
    @Query('q') q = '',
  ) {
    const tasks = await this.service.queue(req.copilotUser, regionId);
    if (/핵심|대표\s*관광지|왜\s*안\s*나와|누락/.test(q)) {
      const health = await this.service.coreHealth(req.copilotUser, regionId),
        named = health.items.filter((x: any) => q.includes(x.core.displayName));
      return (
        named.length
          ? named
          : health.items.filter(
              (x: any) =>
                !/검증\s*안\s*된/.test(q) ||
                x.evidence.verificationStatus !== 'VERIFIED',
            )
      ).map((x: any) => ({
        taskId: `core:${x.core.id}`,
        regionId,
        type: 'CORE_DESTINATION_COVERAGE_GAP',
        priority: x.health === 'CRITICAL' ? 0 : 1,
        core: x.core,
        diagnostic: x,
        reason: x.reasons.join(' '),
        status: x.health,
      }));
    }
    if (/검색.*발견/.test(q))
      return tasks.filter((x) => x.type === 'SEARCH_DISCOVERED_ENTITY');
    if (/미검증/.test(q))
      return tasks.filter(
        (x) =>
          x.type === 'UNVERIFIED_ENTITY' ||
          x.type === 'SEARCH_DISCOVERED_ENTITY',
      );
    return tasks;
  }
  @Get('candidates/:id') @UseGuards(CopilotAuthGuard) detail(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.service.detail(req.copilotUser, id);
  }
  @Post('candidates/:id/review') @UseGuards(CopilotAuthGuard) review(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.service.review(req.copilotUser, id, body?.editedFacts);
  }
  @Post('candidates/:id/activate') @UseGuards(CopilotAuthGuard) activate(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.service.activate(
      req.copilotUser,
      id,
      body?.confirmed === true,
      body?.duplicateAcknowledged === true,
    );
  }
  @Post('candidates/:id/reject') @UseGuards(CopilotAuthGuard) reject(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.service.reject(req.copilotUser, id);
  }
  @Get('core-destinations') @UseGuards(CopilotAuthGuard) cores(
    @Req() req: any,
    @Query('regionId') regionId: string,
  ) {
    return this.service.coreHealth(req.copilotUser, regionId);
  }
  @Get('core-destinations/:id') @UseGuards(CopilotAuthGuard) core(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.service.coreDetail(req.copilotUser, id);
  }
  @Post('core-destinations') @UseGuards(CopilotAuthGuard) designate(
    @Req() req: any,
    @Body() body: any,
  ) {
    return this.service.designateCore(
      req.copilotUser,
      body,
      body?.confirmed === true,
    );
  }
  @Post('core-destinations/:id/remove') @UseGuards(CopilotAuthGuard) remove(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.service.removeCore(
      req.copilotUser,
      id,
      body?.confirmed === true,
    );
  }
  @Post('core-destinations/:id/review') @UseGuards(CopilotAuthGuard) reviewCore(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.service.reviewCoreCoverage(
      req.copilotUser,
      id,
      body?.confirmed === true,
    );
  }
  @Post('core-destinations/:id/fixes/:fixType')
  @UseGuards(CopilotAuthGuard)
  fixCore(
    @Req() req: any,
    @Param('id') id: string,
    @Param('fixType') fixType: string,
    @Body() body: any,
  ) {
    return this.service.approveCoreFix(
      req.copilotUser,
      id,
      fixType,
      body?.confirmed === true,
    );
  }
}
