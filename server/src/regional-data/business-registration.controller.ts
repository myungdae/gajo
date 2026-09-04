import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AdminTokenGuard } from './admin-token.guard';
import { BusinessRegistrationService } from './business-registration.service';
@Controller('api/admin/businesses')
@UseGuards(AdminTokenGuard)
export class BusinessRegistrationController {
  constructor(private service:BusinessRegistrationService) {}
  @Get() list(@Req() req:any,@Query('regionId') region:string,@Query('search') search:string) {return this.service.list(req.adminPrincipal,region,search);}
  @Post('duplicates') duplicates(@Req() req:any,@Query('regionId') region:string,@Body() body:any) {return this.service.duplicates(req.adminPrincipal,region,body);}
  @Post() create(@Req() req:any,@Query('regionId') region:string,@Body() body:any) {return this.service.create(req.adminPrincipal,region,body);}
  @Post(':id/:action') change(@Req() req:any,@Query('regionId') region:string,@Param('id') id:string,@Param('action') action:string,@Body() body:any) {return this.service.change(req.adminPrincipal,region,id,action,body);}
}
