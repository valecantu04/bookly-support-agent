import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const SESSION_COOKIE = 'bookly_session';

export function sessionMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.cookies[SESSION_COOKIE]) {
    const id = uuidv4();
    res.cookie(SESSION_COOKIE, id, { httpOnly: true, maxAge: 60 * 60 * 1000 });
    req.cookies[SESSION_COOKIE] = id;
  }
  next();
}

export function getSessionId(req: Request): string {
  return req.cookies[SESSION_COOKIE] as string;
}
