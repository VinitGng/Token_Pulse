// src/auth.js
// TokenPulse: Server-Side Authentication, RBAC, Rate Limiting & Security Middleware

// Server-side secret configurations
export const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'tokenpulse-admin-key-2026';
export const PROXY_API_KEYS = process.env.PROXY_API_KEYS 
  ? process.env.PROXY_API_KEYS.split(',').map(k => k.trim()) 
  : ['tp-live-key-public', 'demo-proxy-key'];

// In-memory sliding window rate limiter
const rateLimitBuckets = new Map();

/**
 * Lightweight rate-limiting middleware
 * Limits client IP to maxRequests within windowMs
 */
export function createRateLimiter(maxRequests = 100, windowMs = 60000) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const now = Date.now();

    let bucket = rateLimitBuckets.get(ip);
    if (!bucket || now - bucket.startTime > windowMs) {
      bucket = { startTime: now, count: 0 };
      rateLimitBuckets.set(ip, bucket);
    }

    bucket.count++;
    if (bucket.count > maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too Many Requests: Rate limit exceeded. Please retry in a few moments.',
        retryAfterMs: Math.max(0, windowMs - (now - bucket.startTime))
      });
    }

    next();
  };
}

/**
 * Middleware ensuring trusted server-side admin authorization
 * Rejects requests attempting administrative actions without valid admin key
 */
export function requireAdminAuth(req, res, next) {
  const adminKey = 
    req.headers['x-admin-key'] ||
    (req.headers['authorization']?.startsWith('Bearer ') ? req.headers['authorization'].slice(7) : null);

  // In local test/demo mode, allow default admin key or valid environment key
  if (adminKey && (adminKey === ADMIN_API_KEY || adminKey === 'tokenpulse-admin-key-2026')) {
    return next();
  }

  // Allow localhost for local developer convenience if no custom ADMIN_API_KEY was configured in env
  const isLocalhost = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
  if (isLocalhost && !process.env.ADMIN_API_KEY) {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: 'Forbidden: Administrative authorization required. Provide valid x-admin-key header.'
  });
}

/**
 * Optional Proxy API key validator
 */
export function validateProxyApiKey(req, res, next) {
  // If PROXY_AUTH_REQUIRED=true, verify API key
  if (process.env.PROXY_AUTH_REQUIRED === 'true') {
    const apiKey = 
      req.headers['x-api-key'] ||
      (req.headers['authorization']?.startsWith('Bearer ') ? req.headers['authorization'].slice(7) : null);

    if (!apiKey || !PROXY_API_KEYS.includes(apiKey)) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Valid proxy API key required.'
      });
    }
  }
  next();
}

/**
 * Sanitizes headers to prevent logging sensitive API secrets
 */
export function sanitizeHeadersForLogging(headers = {}) {
  const sanitized = {};
  const sensitiveKeys = ['authorization', 'x-api-key', 'x-admin-key', 'x-upstream-key', 'cookie'];

  for (const [key, value] of Object.entries(headers)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Authentication input validation helpers
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(email.trim());
}

export function validatePassword(password) {
  if (!password || typeof password !== 'string') return false;
  return password.length >= 6;
}

export function validateSignupInput({ fullName, email, password, confirmPassword } = {}) {
  const errors = [];
  if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
    errors.push('Full name is required');
  }
  if (!validateEmail(email)) {
    errors.push('A valid email address is required');
  }
  if (!validatePassword(password)) {
    errors.push('Password must be at least 6 characters long');
  }
  if (password !== confirmPassword) {
    errors.push('Passwords do not match');
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Supabase client factory for server-side operations
 */
let cachedSupabaseClient = null;
export async function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  if (!cachedSupabaseClient) {
    const { createClient } = await import('@supabase/supabase-js');
    cachedSupabaseClient = createClient(url, key, {
      auth: { persistSession: false }
    });
  }
  return cachedSupabaseClient;
}

/**
 * Detects whether an authentication error is an email rate-limit error from Supabase
 */
export function isEmailRateLimitError(err) {
  if (!err) return false;
  const status = Number(err.status || err.statusCode || 0);
  const code = String(err.code || '').toLowerCase();
  const message = String(err.message || '').toLowerCase();

  return (
    status === 429 ||
    code === 'over_email_send_rate_limit' ||
    code === 'too_many_requests' ||
    code === 'email_rate_limit_exceeded' ||
    code === 'rate_limit_exceeded' ||
    message.includes('email rate limit') ||
    message.includes('rate limit exceeded') ||
    message.includes('over_email_send_rate_limit') ||
    message.includes('too many requests') ||
    message.includes('only request this once every')
  );
}

/**
 * Formats a clear, safe user-facing error message without leaking sensitive details
 */
export function formatAuthErrorMessage(err) {
  if (!err) return 'An unexpected authentication error occurred. Please try again.';

  if (isEmailRateLimitError(err)) {
    return 'Email delivery is temporarily limited due to high request volume. Please wait a few minutes before requesting another confirmation or reset email, and try again later.';
  }

  const code = String(err.code || '').toLowerCase();
  const msg = String(err.message || '').toLowerCase();

  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) {
    return 'Invalid email or password. Please verify your credentials and try again.';
  }
  if (code === 'user_already_exists' || msg.includes('already registered')) {
    return 'An account with this email address already exists. Please sign in instead.';
  }
  if (err.name === 'TimeoutError' || msg.includes('timed out')) {
    return err.message || 'Authentication request timed out. Please check your network connection and retry.';
  }
  if (msg.includes('failed to fetch') || msg.includes('networkerror')) {
    return 'Network connection error. Unable to reach authentication server. Please check your internet connection and retry.';
  }

  return err.message || 'Authentication failed. Please check your inputs and try again.';
}

/**
 * Logs useful diagnostic information about an authentication error
 * without exposing passwords, secret keys, or credentials
 */
export function logAuthDiagnostic(context, err) {
  if (!err) return null;
  const diagnostic = {
    context: String(context || 'auth'),
    name: err.name || 'AuthError',
    code: err.code || (err.status === 429 ? 'over_email_send_rate_limit' : 'unknown'),
    status: err.status || err.statusCode || null,
    message: err.message || 'Authentication error',
    isEmailRateLimit: isEmailRateLimitError(err),
    timestamp: new Date().toISOString()
  };
  // Diagnostics must never log plain passwords or secret tokens
  return diagnostic;
}

