import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

// Reads the JWT from the Authorization: Bearer header and attaches
// { id, username, displayName } to req.user. Every protected route
// uses this.
//
// Auth is Bearer-only (no cookie fallback) on purpose: the frontend
// keeps its token in sessionStorage, which is scoped per browser
// tab. A shared httpOnly cookie would be the same for every tab in
// the browser, so two tabs logged in as different users would
// silently collide on whichever cookie was set last. Bearer-only
// auth means each tab's requests are authenticated independently.
export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;

  if (!token) {
    return next(new ApiError(401, 'Not authenticated'));
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = payload;
    next();
  } catch {
    next(new ApiError(401, 'Session expired, please log in again'));
  }
}
