import { getSupabase } from '../lib/supabase.js';

async function readUser(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  try {
    const { data, error } = await getSupabase().auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

export async function optionalAuth(req, _res, next) {
  req.user = await readUser(req);
  next();
}

export async function requireAuth(req, res, next) {
  const user = await readUser(req);
  if (!user) {
    return res.status(401).json({ error: 'unauthenticated' });
  }
  req.user = user;
  next();
}
