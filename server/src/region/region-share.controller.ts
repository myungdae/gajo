import { Controller,Get,Param,Res } from '@nestjs/common';
import type { Response } from 'express';
import * as QRCode from 'qrcode';
import { RegionConfigService } from './region-config.service';
@Controller('api/regions')
export class RegionShareController{constructor(private readonly regions:RegionConfigService){}@Get(':regionId/entry-qr')async qr(@Param('regionId')regionId:string,@Res()response:Response){const region=this.regions.get(regionId),url=`https://exkovia.com/${region.id}`,png=await QRCode.toBuffer(url,{type:'png',width:640,margin:4,errorCorrectionLevel:'M'});response.setHeader('Content-Type','image/png');response.setHeader('Cache-Control','public, max-age=86400');response.send(png)}}
