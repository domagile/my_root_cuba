export function validateDeploySettings(env) {
  const required = ['RUN_PROJECT_ID', 'HOSTING_PROJECT_ID', 'FIREBASE_HOSTING_SITE', 'RUN_REGION', 'RUN_SERVICE', 'ARTIFACT_REPOSITORY', 'GCP_RUNTIME_SERVICE_ACCOUNT', 'GEMINI_SECRET_NAME'];
  for (const name of required) if (!env[name]) throw new Error(`Missing deployment setting: ${name}`);
  for (const name of ['RUN_PROJECT_ID', 'HOSTING_PROJECT_ID']) if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(env[name])) throw new Error(`Invalid project ID: ${name}`);
  for (const name of ['RUN_SERVICE', 'ARTIFACT_REPOSITORY', 'GEMINI_SECRET_NAME']) if (!/^[a-z][a-z0-9-]{1,61}[a-z0-9]$/.test(env[name])) throw new Error(`Invalid resource name: ${name}`);
  if (env.RUN_SERVICE.startsWith('ais-')) throw new Error('Use a separate service; do not replace the AI Studio deployment.');
  if (!/^[a-z]+-[a-z]+[0-9]+$/.test(env.RUN_REGION)) throw new Error('Invalid Run region');
  if (!/^[a-z0-9][a-z0-9-]{3,28}[a-z0-9]$/.test(env.FIREBASE_HOSTING_SITE)) throw new Error('Invalid Hosting site ID');
  if (!/^[a-z][a-z0-9-]+@[a-z][a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(env.GCP_RUNTIME_SERVICE_ACCOUNT)) throw new Error('Invalid runtime service account');
  return env;
}
if (process.argv[1]?.endsWith('deploy-settings.mjs')) { validateDeploySettings(process.env); console.log('Deployment settings validated.'); }
