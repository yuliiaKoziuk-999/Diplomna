import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { JwtService } from '@nestjs/jwt';
import { BillingModule } from 'src/billing/billing.module';
import { VerifiableSearchModule } from 'src/verifiable-search/verifiable-search.module';
import { AnchorRecord, ApiKey } from './anchor.models';
import { AnchorApiService } from './anchor-api.service';
import { AccountController, AnchorApiController, PublicRootsController } from './anchor-api.controller';

@Module({
  imports: [SequelizeModule.forFeature([AnchorRecord, ApiKey]), BillingModule, VerifiableSearchModule],
  controllers: [AnchorApiController, AccountController, PublicRootsController],
  providers: [AnchorApiService, JwtService],
})
export class AnchorApiModule {}
