/**
 * Environment variable validation
 * Runs at server startup to ensure all required variables are configured
 */

interface EnvVar {
  name: string;
  required: boolean;
  validation?: (value: string) => boolean | string;
}

const envVars: EnvVar[] = [
  {
    name: 'MONGODB_URI',
    required: true,
    validation: (val) => val.startsWith('mongodb') ? true : 'Must be a valid MongoDB URI',
  },
  {
    name: 'JWT_ACCESS_SECRET',
    required: true,
    validation: (val) => val.length >= 32 ? true : 'Must be at least 32 characters',
  },
  {
    name: 'JWT_REFRESH_SECRET',
    required: true,
    validation: (val) => val.length >= 32 ? true : 'Must be at least 32 characters',
  },
  {
    name: 'CLIENT_URL',
    required: true,
    validation: (val) => /^https?:\/\//.test(val) ? true : 'Must be a valid URL',
  },
  {
    name: 'NODE_ENV',
    required: true,
    validation: (val) => ['development', 'staging', 'production'].includes(val) ? true : 'Must be development, staging, or production',
  },
  {
    name: 'DEEPSEEK_API_KEY',
    required: false,
    validation: (val) => val.startsWith('sk-') ? true : 'Invalid DeepSeek API key format',
  },
  {
    name: 'GOOGLE_CLIENT_ID',
    required: false,
  },
  {
    name: 'GOOGLE_CLIENT_SECRET',
    required: false,
  },
  {
    name: 'REDIS_URL',
    required: false,
    validation: (val) => val.startsWith('redis') ? true : 'Must be a valid Redis URL',
  },
];

export function validateEnvVars(): void {
  const errors: string[] = [];

  for (const envVar of envVars) {
    const value = process.env[envVar.name];

    // Check if required variable is missing
    if (envVar.required && !value) {
      errors.push(`Missing required environment variable: ${envVar.name}`);
      continue;
    }

    // Skip validation if optional and not provided
    if (!envVar.required && !value) {
      continue;
    }

    // Run validation function if provided
    if (envVar.validation && value) {
      const result = envVar.validation(value);
      if (result !== true) {
        errors.push(`${envVar.name}: ${result}`);
      }
    }
  }

  if (errors.length > 0) {
    console.error('Environment variable validation failed:');
    errors.forEach((err) => console.error(`  ✗ ${err}`));
    process.exit(1);
  }

  console.log('✓ All environment variables validated successfully');
}

/**
 * Warn about optional but recommended variables
 */
export function warnMissingOptionalVars(): void {
  const warnings: string[] = [];

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      warnings.push('GOOGLE_CLIENT_*: Google OAuth is recommended for user convenience');
    }
  }

  if (warnings.length > 0) {
    console.warn('Optional environment variables not configured:');
    warnings.forEach((warn) => console.warn(`  ⚠ ${warn}`));
  }
}
