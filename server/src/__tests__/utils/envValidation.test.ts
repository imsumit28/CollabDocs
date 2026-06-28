import { validateEnvVars, warnMissingOptionalVars } from '../../utils/envValidation';
import { logger } from '../../utils/logger';

describe('envValidation', () => {
  const ORIGINAL = { ...process.env };
  let exitSpy: jest.SpyInstance;

  beforeEach(() => {
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  });

  afterEach(() => {
    process.env = { ...ORIGINAL };
    exitSpy.mockRestore();
  });

  function setValidEnv() {
    process.env.MONGODB_URI = 'mongodb://localhost:27017/db';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
    process.env.CLIENT_URL = 'http://localhost:3000';
    process.env.NODE_ENV = 'development';
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.REDIS_URL;
  }

  describe('validateEnvVars', () => {
    it('passes (no exit) when all required vars are valid', () => {
      setValidEnv();
      validateEnvVars();
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('exits when a required var is missing', () => {
      setValidEnv();
      delete process.env.MONGODB_URI;
      validateEnvVars();
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('exits when a required var fails its format check', () => {
      setValidEnv();
      process.env.JWT_ACCESS_SECRET = 'too-short';
      validateEnvVars();
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('exits when an optional var is present but malformed', () => {
      setValidEnv();
      process.env.DEEPSEEK_API_KEY = 'not-a-key';
      validateEnvVars();
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('accepts a valid optional var', () => {
      setValidEnv();
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.DEEPSEEK_API_KEY = 'sk-validkey';
      validateEnvVars();
      expect(exitSpy).not.toHaveBeenCalled();
    });
  });

  describe('warnMissingOptionalVars', () => {
    it('warns in production when Google OAuth is unset', () => {
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined as never);
      process.env.NODE_ENV = 'production';
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
      warnMissingOptionalVars();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('does not warn outside production', () => {
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined as never);
      process.env.NODE_ENV = 'development';
      warnMissingOptionalVars();
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});
