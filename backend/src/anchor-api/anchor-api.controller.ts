import {
  Body,
  CanActivate,
  Controller,
  Delete,
  ExecutionContext,
  ForbiddenException,
  Get,
  Injectable,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { Request } from 'express';
import { CookieAuthGuard, CurrentUserId } from 'src/auth/cookie-auth.guard';
import { ApiKey } from './anchor.models';
import { AnchorApiService } from './anchor-api.service';

class SubmitAnchorDto {
  @Matches(/^[a-fA-F0-9]{64}$/, { message: 'sha256 має бути 64 hex-символи' })
  sha256: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  label?: string;
}

class CreateKeyDto {
  @IsString()
  @Length(1, 100)
  name: string;
}

@Injectable()
class ApiKeyGuard implements CanActivate {
  constructor(private readonly service: AnchorApiService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const match = /^Bearer\s+(ap_[a-z]+_[a-f0-9]+)$/.exec(req.headers.authorization ?? '');
    const key = match && (await this.service.authenticateKey(match[1]));
    if (!key) throw new UnauthorizedException('Недійсний або відкликаний API-ключ');
    req['apiKey'] = key;
    return true;
  }
}

/** Public Anchor API, authenticated with an `Authorization: Bearer ap_test_…` key. */
@Controller('v1/anchor')
@UseGuards(ApiKeyGuard)
export class AnchorApiController {
  constructor(private readonly service: AnchorApiService) {}

  @Post()
  submit(@Req() req: Request, @Body() dto: SubmitAnchorDto) {
    const key: ApiKey = req['apiKey'];
    return this.service.submit(key.userId, dto.sha256, dto.label ?? null, key.id);
  }

  @Get(':id')
  receipt(@Req() req: Request, @Param('id') id: string) {
    return this.service.receipt(id, (req['apiKey'] as ApiKey).userId);
  }
}

/** Public, no key: anyone holding a receipt can read the epoch root it must match. */
@Controller('v1/roots')
export class PublicRootsController {
  constructor(private readonly service: AnchorApiService) {}

  @Get(':epoch')
  root(@Param('epoch', ParseIntPipe) epoch: number) {
    return this.service.epochRoot(epoch);
  }
}

/** Same features for the signed-in user in the cabinet (cookie auth). */
@Controller('account')
@UseGuards(CookieAuthGuard)
export class AccountController {
  constructor(private readonly service: AnchorApiService) {}

  @Get('anchors')
  anchors(@CurrentUserId() userId: number) {
    return this.service.list(userId);
  }

  @Post('anchors')
  submit(@CurrentUserId() userId: number, @Body() dto: SubmitAnchorDto) {
    return this.service.submit(userId, dto.sha256, dto.label ?? null, null);
  }

  /** Test environments only: close the epoch now instead of waiting for the timer. */
  @Post('anchors/close-epoch')
  closeEpoch() {
    if (process.env.NODE_ENV === 'production') throw new ForbiddenException();
    return this.service.closeEpoch();
  }

  @Get('api-keys')
  keys(@CurrentUserId() userId: number) {
    return this.service.listKeys(userId);
  }

  @Post('api-keys')
  createKey(@CurrentUserId() userId: number, @Body() dto: CreateKeyDto) {
    return this.service.createKey(userId, dto.name);
  }

  @Delete('api-keys/:id')
  revokeKey(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.revokeKey(userId, id);
  }
}
