import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  RawBodyRequest,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { IsIn, IsString, Matches } from 'class-validator';
import { CookieAuthGuard, CurrentUserId } from 'src/auth/cookie-auth.guard';
import { BillingService } from './billing.service';
import { PAID_PLANS, PLANS, PlanId } from './plans';

class CheckoutDto {
  @IsIn(PAID_PLANS)
  plan: PlanId;
}

class ConfirmCheckoutDto {
  @IsString()
  @Matches(/^cs_[A-Za-z0-9_]+$/)
  sessionId: string;
}

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  plans() {
    return Object.values(PLANS).map(({ priceEnv, ...plan }) => plan);
  }

  @UseGuards(CookieAuthGuard)
  @Get('subscription')
  subscription(@CurrentUserId() userId: number, @Query('refresh') refresh?: string) {
    return this.billing.overview(userId, refresh === '1');
  }

  @UseGuards(CookieAuthGuard)
  @Post('checkout')
  checkout(@CurrentUserId() userId: number, @Body() dto: CheckoutDto) {
    return this.billing.checkout(userId, dto.plan);
  }

  @UseGuards(CookieAuthGuard)
  @Post('checkout/confirm')
  confirm(@CurrentUserId() userId: number, @Body() dto: ConfirmCheckoutDto) {
    return this.billing.confirmCheckout(userId, dto.sessionId);
  }

  @UseGuards(CookieAuthGuard)
  @Post('cancel')
  cancel(@CurrentUserId() userId: number) {
    return this.billing.setCancel(userId, true);
  }

  @UseGuards(CookieAuthGuard)
  @Post('resume')
  resume(@CurrentUserId() userId: number) {
    return this.billing.setCancel(userId, false);
  }

  @UseGuards(CookieAuthGuard)
  @Post('portal')
  portal(@CurrentUserId() userId: number) {
    return this.billing.portal(userId);
  }

  @UseGuards(CookieAuthGuard)
  @Get('invoices')
  invoices(@CurrentUserId() userId: number) {
    return this.billing.invoices(userId);
  }

  /** Called by Stripe (locally via `npm run stripe:listen`). Authenticated by signature, not cookie. */
  @Post('webhook')
  @HttpCode(200)
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature: string) {
    if (!req.rawBody || !signature) throw new BadRequestException('Missing body or signature');
    await this.billing.handleWebhook(req.rawBody, signature);
    return { received: true };
  }
}
