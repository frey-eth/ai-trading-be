import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

export const Admin = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const adminkey = request.headers['admin-key'];
    if (adminkey !== process.env.ADMIN_KEY) {
      throw new UnauthorizedException();
    }
    return true;
  },
);
