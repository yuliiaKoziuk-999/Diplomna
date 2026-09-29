import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { JwtService } from '@nestjs/jwt';
import { User } from 'src/user/user.model';
import { AnchorRecord } from 'src/anchor-api/anchor.models';
import { ProcessedWebhookEvent, Subscription } from './subscription.model';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { StripeProvider } from './stripe.provider';
import { PAYMENT_PROVIDER } from './payment-provider';

@Module({
  imports: [SequelizeModule.forFeature([Subscription, ProcessedWebhookEvent, AnchorRecord, User])],
  controllers: [BillingController],
  providers: [
    BillingService,
    JwtService,
    // Swap for a LiqPayProvider implementing the same interface to change PSP.
    { provide: PAYMENT_PROVIDER, useClass: StripeProvider },
  ],
  exports: [BillingService],
})
export class BillingModule {}
