import { loadEnvConfig } from '@next/env';
import { checkEnvironmentReadiness } from '../src/libs/environmentReadiness';

loadEnvConfig(process.cwd());

const production = process.argv.includes('--production');
const checks = checkEnvironmentReadiness(
  process.env,
  production || process.env.NODE_ENV === 'production',
);
const errors = checks.filter((check) => check.level === 'error');
const warnings = checks.filter((check) => check.level === 'warning');

console.log(
  `FeedSync environment check (${production ? 'production' : 'local/staging'})`,
);
console.log(
  errors.length === 0
    ? 'Required configuration: ready'
    : `Required configuration: ${errors.length} issue(s)`,
);

for (const check of checks) {
  console.log(
    `${check.level === 'error' ? 'ERROR' : 'WARN'} ${check.key}: ${check.message}`,
  );
}

if (errors.length === 0) {
  console.log(
    warnings.length === 0
      ? 'No outstanding configuration warnings.'
      : `${warnings.length} warning(s): social provider integrations still need real verification.`,
  );
}

process.exitCode = errors.length === 0 ? 0 : 1;
