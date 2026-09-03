import { Controller,Get,Param,Res,Query } from '@nestjs/common';
import type { Response } from 'express';
import * as QRCode from 'qrcode';
import { RegionConfigService } from './region-config.service';
@Controller('api/regions')
export class RegionShareController{constructor(private readonly regions:RegionConfigService){}@Get(':regionId/entry-qr')async qr(@Param('regionId')regionId:string,@Res()response:Response,@Query('locale')locale?:string){const region=this.regions.get(regionId),url=`https://exkovia.com/${region.id}${locale === 'en' ? '?start=ai&lang=en' : ''}`,png=await QRCode.toBuffer(url,{type:'png',width:640,margin:4,errorCorrectionLevel:'M'});response.setHeader('Content-Type','image/png');response.setHeader('Cache-Control','public, max-age=86400');response.send(png)}}
