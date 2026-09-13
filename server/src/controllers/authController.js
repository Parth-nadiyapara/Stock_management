import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/db.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    throw new ApiError(400, 'Username and password are required');
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('id, username, password_hash, display_name')
    .eq('username', username.trim().toLowerCase())
    .maybeSingle();

  if (error) throw new ApiError(500, 'Failed to look up user', error.message);
  if (!user) throw new ApiError(401, 'Invalid username or password');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new ApiError(401, 'Invalid username or password');

  const token = jwt.sign(
    { id: user.id, username: user.username, displayName: user.display_name },
    env.jwtSecret,
    { expiresIn: '7d' }
  );

  // The token itself is returned in the body (not a cookie) so the
  // frontend can keep it in sessionStorage, scoped to this one tab.
  res.json({
    token,
    user: { id: user.id, username: user.username, displayName: user.display_name },
  });
});

export const logout = asyncHandler(async (req, res) => {
  // Stateless JWTs: there's nothing to invalidate server-side. The
  // frontend just drops the token from its tab's sessionStorage.
  res.json({ success: true });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});
