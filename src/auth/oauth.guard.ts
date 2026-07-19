import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

function getState(context: ExecutionContext) {
  const request = context.switchToHttp().getRequest<{ query?: { state?: string } }>();
  return request.query?.state;
}

@Injectable()
export class GoogleOAuthGuard extends AuthGuard("google") {
  getAuthenticateOptions(context: ExecutionContext) {
    return { state: getState(context) };
  }
}

@Injectable()
export class GithubOAuthGuard extends AuthGuard("github") {
  getAuthenticateOptions(context: ExecutionContext) {
    return { state: getState(context) };
  }
}
