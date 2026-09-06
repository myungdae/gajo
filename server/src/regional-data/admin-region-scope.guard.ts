import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RegionalDataRecord } from './regional-data.schema';
@Injectable()
export class AdminRegionScopeGuard implements CanActivate {
  constructor(@InjectModel(RegionalDataRecord.name) private rows: Model<RegionalDataRecord>) {}
  async canActivate(context: ExecutionContext) {
    const req=context.switchToHttp().getRequest();
    const regions=[req.query?.regionId,req.body?.regionId,req.body?.package?.regionId].filter(v=>v!==undefined);
    if(req.params?.id){
      const row=await this.rows.findOne({id:req.params.id}).lean();
      if(!row)throw new ForbiddenException('Record region cannot be authorized');
      regions.push(row.regionId);
    }
    if(!regions.length||regions.some(r=>typeof r!=='string'||!r||r!==regions[0]||!req.adminPrincipal?.allowedRegionIds?.includes(r)))
      throw new ForbiddenException('Regional data scope denied');
    return true;
  }
}
