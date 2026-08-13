import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { Visitor, VisitorDocument } from '../schemas/visitor.schema';
import { Companion, CompanionDocument } from '../schemas/companion.schema';
import { VisitorGroup, VisitorGroupDocument } from '../schemas/visitor-group.schema';

/**
 * VisitorService: simple profile CRUD for visitors/companions/groups.
 * The Concierge chat flow itself does not require a persisted Visitor
 * document (it can operate on ad-hoc structured input for a walk-up/one-off
 * session), but the Admin Dashboard and multi-visit "remember my profile"
 * UX need real, queryable collections — which is also an explicit
 * requirement of the spec's Mongo collection list.
 */
@Injectable()
export class VisitorService {
  constructor(
    @InjectModel(Visitor.name) private visitorModel: Model<VisitorDocument>,
    @InjectModel(Companion.name) private companionModel: Model<CompanionDocument>,
    @InjectModel(VisitorGroup.name) private groupModel: Model<VisitorGroupDocument>,
  ) {}

  async createVisitor(dto: { name?: string; phone?: string; age?: number; wellnessGoals?: string[]; healthConditions?: string[] }) {
    const visitorNo = `V-${Date.now()}-${randomUUID().slice(0, 6)}`;
    return this.visitorModel.create({ visitorNo, ...dto });
  }

  getVisitor(visitorNo: string) {
    return this.visitorModel.findOne({ visitorNo }).lean();
  }

  listVisitors() {
    return this.visitorModel.find().sort({ createdAt: -1 }).lean();
  }

  async addCompanion(visitorNo: string, dto: { name?: string; age?: number; relationship?: string; healthConditions: string[] }) {
    const visitor = await this.visitorModel.findOne({ visitorNo });
    if (!visitor) throw new Error('Visitor not found');
    return this.companionModel.create({ visitorId: visitor._id, ...dto });
  }

  listCompanions(visitorNo: string) {
    return this.visitorModel.findOne({ visitorNo }).then((v) =>
      v ? this.companionModel.find({ visitorId: v._id }).lean() : [],
    );
  }
}
