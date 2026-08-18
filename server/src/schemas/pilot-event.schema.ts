import{Prop,Schema,SchemaFactory}from'@nestjs/mongoose';import{Document}from'mongoose';
@Schema({timestamps:true})export class PilotEvent{@Prop({required:true,index:true})eventType:string;@Prop({required:true,index:true})sessionId:string;@Prop({required:true,index:true,default:'gajo'})regionId:string;@Prop({type:Object,default:{}})metadata:Record<string,string|number|boolean>}
export type PilotEventDocument=PilotEvent&Document;export const PilotEventSchema=SchemaFactory.createForClass(PilotEvent);
