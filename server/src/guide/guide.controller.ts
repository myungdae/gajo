import{Body,Controller,Post,Req}from'@nestjs/common';
import{GuideService}from'./guide.service';
@Controller('api/guide')
export class GuideController{constructor(private readonly guide:GuideService){}@Post('questions')answer(@Body()body:any,@Req()req:any){const forwarded=String(req.headers?.['x-forwarded-for']||'').split(',')[0].trim();return this.guide.answer(body,forwarded||String(req.ip||req.socket?.remoteAddress||'anonymous'))}}
