import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * REST counterpart of GraphqlAuthGuard: same httpOnly `access_token`
 * cookie, but read from the HTTP context. A 401 tells the frontend to call
 * the `refreshToken` mutation and retry.
 */
@Injectable()
export class CookieAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.cookies?.access_token;
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      request['user'] = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('ACCESS_TOKEN_SECRET'),
      });
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }
}

/** Id of the user authenticated by CookieAuthGuard. */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number =>
    Number(ctx.switchToHttp().getRequest().user.sub),
);
