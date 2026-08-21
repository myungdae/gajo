import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
@Schema({timestamps:true})export class CopilotAssignment{@Prop({required:true,unique:true})sub:string;@Prop({required:true})role:string;@Prop({type:[String],default:[]})regions:string[];@Prop({required:true})updatedBy:string}
export const CopilotAssignmentSchema=SchemaFactory.createForClass(CopilotAssignment);
