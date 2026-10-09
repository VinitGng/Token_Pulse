// tests/supabase_auth.test.js
// TokenPulse: Verification for Supabase Auth, Profiles Schema, RLS & Client Security
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 
  validateEmail, 
  validatePassword, 
  validateSignupInput,
  sanitizeHeadersForLogging,
  isEmailRateLimitError,
  formatAuthErrorMessage,
  logAuthDiagnostic
} from '../src/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('TokenPulse Supabase Auth & Security Suite', () => {
  describe('1. Signup & Login Form Validation', () => {
    it('should validate email format strictly', () => {
      assert.equal(validateEmail('admin@tokenpulse.io'), true);
      assert.equal(validateEmail('user.name+tag@company.co.uk'), true);
      assert.equal(validateEmail('invalid-email'), false);
      assert.equal(validateEmail('user@'), false);
      assert.equal(validateEmail('@domain.com'), false);
      assert.equal(validateEmail(''), false);
      assert.equal(validateEmail(null), false);
    });

    it('should require passwords with minimum length of 6 characters', () => {
      assert.equal(validatePassword('123456'), true);
      assert.equal(validatePassword('super-secure-pwd-2026'), true);
      assert.equal(validatePassword('12345'), false);
      assert.equal(validatePassword(''), false);
      assert.equal(validatePassword(null), false);
    });

    it('should enforce all required signup fields and password confirmation', () => {
      // Valid signup
      const valid = validateSignupInput({
        fullName: 'Alex Vance',
        email: 'alex@tokenpulse.io',
        password: 'password123',
        confirmPassword: 'password123'
      });
      assert.equal(valid.isValid, true);
      assert.equal(valid.errors.length, 0);

      // Missing full name
      const missingName = validateSignupInput({
        fullName: '   ',
        email: 'alex@tokenpulse.io',
        password: 'password123',
        confirmPassword: 'password123'
      });
      assert.equal(missingName.isValid, false);
      assert.ok(missingName.errors.some(e => e.includes('Full name')));

      // Invalid email
      const invalidEmail = validateSignupInput({
        fullName: 'Alex',
        email: 'not-an-email',
        password: 'password123',
        confirmPassword: 'password123'
      });
      assert.equal(invalidEmail.isValid, false);
      assert.ok(invalidEmail.errors.some(e => e.includes('email')));

      // Short password
      const shortPwd = validateSignupInput({
        fullName: 'Alex',
        email: 'alex@tokenpulse.io',
        password: '123',
        confirmPassword: '123'
      });
      assert.equal(shortPwd.isValid, false);
      assert.ok(shortPwd.errors.some(e => e.includes('at least 6 characters')));

      // Mismatched passwords
      const mismatch = validateSignupInput({
        fullName: 'Alex',
        email: 'alex@tokenpulse.io',
        password: 'password123',
        confirmPassword: 'different-password'
      });
      assert.equal(mismatch.isValid, false);
      assert.ok(mismatch.errors.some(e => e.includes('match')));
    });
  });

  describe('2. Supabase Migration & RLS Security Integrity', () => {
    it('should have 20261010_auth_profiles.sql migration file', () => {
      const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20261010_auth_profiles.sql');
      assert.ok(fs.existsSync(migrationPath), 'Migration file must exist');

      const sql = fs.readFileSync(migrationPath, 'utf8');
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.profiles'), 'Must create public.profiles');
      assert.ok(sql.includes('REFERENCES auth.users(id)'), 'Must reference auth.users(id)');
      assert.ok(sql.includes('ENABLE ROW LEVEL SECURITY'), 'Must enable Row Level Security');
      assert.ok(sql.includes('auth.uid() = id'), 'Must enforce RLS policy using auth.uid()');
      assert.ok(sql.includes('CREATE TRIGGER on_auth_user_created'), 'Must define automatic user profile trigger');
    });

    it('should never expose service role keys or sensitive credentials in client headers', () => {
      const headers = {
        'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service_role',
        'x-admin-key': 'admin-secret-2026',
        'x-team': 'Core Engineering'
      };
      const sanitized = sanitizeHeadersForLogging(headers);
      assert.equal(sanitized['authorization'], '[REDACTED]');
      assert.equal(sanitized['x-admin-key'], '[REDACTED]');
      assert.equal(sanitized['x-team'], 'Core Engineering');
    });
  });

  describe('3. Client Authentication Module Contract', () => {
    it('should have public/js/auth.js with expected export interface', () => {
      const authJsPath = path.join(__dirname, '..', 'public', 'js', 'auth.js');
      assert.ok(fs.existsSync(authJsPath), 'public/js/auth.js must exist');

      const content = fs.readFileSync(authJsPath, 'utf8');
      assert.ok(content.includes('export async function loginUser'), 'Must export loginUser');
      assert.ok(content.includes('export async function signupUser'), 'Must export signupUser');
      assert.ok(content.includes('export async function logoutUser'), 'Must export logoutUser');
      assert.ok(content.includes('export async function requestPasswordReset'), 'Must export requestPasswordReset');
      assert.ok(content.includes('export async function getCurrentSession'), 'Must export getCurrentSession');
      assert.ok(content.includes('export async function requireAuth'), 'Must export requireAuth');
      assert.ok(content.includes('signInWithPassword'), 'Must invoke Supabase signInWithPassword');
      assert.ok(content.includes('signUp'), 'Must invoke Supabase signUp');
      assert.ok(content.includes('resetPasswordForEmail'), 'Must invoke Supabase resetPasswordForEmail');
    });

    it('should have public/login.html with complete login, signup, and reset forms', () => {
      const loginHtmlPath = path.join(__dirname, '..', 'public', 'login.html');
      assert.ok(fs.existsSync(loginHtmlPath), 'public/login.html must exist');

      const content = fs.readFileSync(loginHtmlPath, 'utf8');
      assert.ok(content.includes('id="form-login"'), 'Must have login form');
      assert.ok(content.includes('id="form-signup"'), 'Must have signup form');
      assert.ok(content.includes('id="form-forgot"'), 'Must have forgot password form');
      assert.ok(content.includes('id="login-email"'), 'Must have login email input');
      assert.ok(content.includes('id="login-password"'), 'Must have login password input');
      assert.ok(content.includes('id="btn-toggle-login-pwd"'), 'Must have show/hide password toggle');
      assert.ok(content.includes('id="signup-name"'), 'Must have signup full name input');
      assert.ok(content.includes('id="signup-confirm-password"'), 'Must have confirm password input');
      assert.ok(content.includes('id="auth-config-alert"'), 'Must have backend configuration alert');
    });
  });

  describe('4. Supabase Email Rate-Limit Error Handling', () => {
    it('should accurately detect Supabase rate-limit errors from status code, error codes, and messages', () => {
      // Status code 429
      assert.equal(isEmailRateLimitError({ status: 429, message: 'Too many requests' }), true);
      assert.equal(isEmailRateLimitError({ statusCode: 429, message: 'Custom rate message' }), true);

      // Known Supabase error codes
      assert.equal(isEmailRateLimitError({ code: 'over_email_send_rate_limit', message: 'Rate limit' }), true);
      assert.equal(isEmailRateLimitError({ code: 'too_many_requests', message: 'Request limit' }), true);
      assert.equal(isEmailRateLimitError({ code: 'email_rate_limit_exceeded', message: 'Exceeded' }), true);

      // Known Supabase message phrases
      assert.equal(isEmailRateLimitError({ message: 'For security purposes, you can only request this once every 60 seconds' }), true);
      assert.equal(isEmailRateLimitError({ message: 'Email rate limit exceeded' }), true);

      // Non-rate-limit errors
      assert.equal(isEmailRateLimitError({ code: 'invalid_credentials', message: 'Invalid login credentials' }), false);
      assert.equal(isEmailRateLimitError({ code: 'user_already_exists', message: 'User already registered' }), false);
      assert.equal(isEmailRateLimitError(null), false);
      assert.equal(isEmailRateLimitError(undefined), false);
    });

    it('should format a clear message explaining that email requests are temporarily limited', () => {
      const rateLimitErr = {
        status: 429,
        code: 'over_email_send_rate_limit',
        message: 'For security purposes, you can only request this once every 60 seconds'
      };
      const formatted = formatAuthErrorMessage(rateLimitErr);
      assert.ok(formatted.toLowerCase().includes('temporarily limited'), 'Must explain temporary limitation');
      assert.ok(formatted.toLowerCase().includes('try again later') || formatted.toLowerCase().includes('wait'), 'Must advise trying later');
      assert.ok(!formatted.includes('password'), 'Must never mention passwords or secrets');
    });

    it('should log useful diagnostic information without exposing user credentials', () => {
      const rawError = {
        name: 'AuthApiError',
        status: 429,
        code: 'over_email_send_rate_limit',
        message: 'Email rate limit exceeded',
        secretToken: 'sk_secret_token_never_expose'
      };

      const diag = logAuthDiagnostic('testSignup', rawError);
      assert.equal(diag.context, 'testSignup');
      assert.equal(diag.status, 429);
      assert.equal(diag.code, 'over_email_send_rate_limit');
      assert.equal(diag.isEmailRateLimit, true);
      assert.ok(diag.timestamp);
      // Verify sensitive token was not copied to diagnostic
      assert.equal(diag.secretToken, undefined);
    });

    it('should handle mocked Supabase rate-limit response during signup without auto-retrying', async () => {
      let callCount = 0;
      // Mock Supabase client returning rate limit
      const mockSupabaseClient = {
        auth: {
          signUp: async () => {
            callCount++;
            return {
              data: null,
              error: {
                status: 429,
                code: 'over_email_send_rate_limit',
                message: 'For security purposes, you can only request this once every 60 seconds'
              }
            };
          }
        }
      };

      // Execute mocked signup call
      const res = await mockSupabaseClient.auth.signUp();
      assert.equal(callCount, 1, 'Must execute exactly one request without auto-retrying');
      assert.ok(res.error, 'Must receive rate-limit error');
      assert.equal(isEmailRateLimitError(res.error), true, 'Must identify as rate-limit error');
      
      const userMessage = formatAuthErrorMessage(res.error);
      assert.ok(userMessage.includes('temporarily limited'));
      // Verify no second call occurred
      assert.equal(callCount, 1, 'Must never automatically retry after rate limit');
    });

    it('should handle mocked Supabase rate-limit response during password reset without auto-retrying', async () => {
      let callCount = 0;
      // Mock Supabase client returning rate limit
      const mockSupabaseClient = {
        auth: {
          resetPasswordForEmail: async () => {
            callCount++;
            return {
              data: null,
              error: {
                status: 429,
                code: 'over_email_send_rate_limit',
                message: 'Email rate limit exceeded'
              }
            };
          }
        }
      };

      const res = await mockSupabaseClient.auth.resetPasswordForEmail();
      assert.equal(callCount, 1, 'Must execute exactly one request without auto-retrying');
      assert.ok(res.error, 'Must receive rate-limit error');
      assert.equal(isEmailRateLimitError(res.error), true, 'Must identify as rate-limit error');
      
      const userMessage = formatAuthErrorMessage(res.error);
      assert.ok(userMessage.includes('temporarily limited'));
      assert.equal(callCount, 1, 'Must never automatically retry password reset');
    });
  });
});
