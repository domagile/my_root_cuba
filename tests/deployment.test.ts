import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHostingConfig } from '../scripts/hosting-config.mjs';
import { validateDeploySettings } from '../scripts/deploy-settings.mjs';
const template = JSON.parse(await readFile(new URL('../firebase.json', import.meta.url), 'utf8'));
const settings = { RUN_PROJECT_ID: 'synthetic-run-project', HOSTING_PROJECT_ID: 'synthetic-host-project', FIREBASE_HOSTING_SITE: 'synthetic-host',
  RUN_REGION: 'europe-west2', RUN_SERVICE: 'my-root-cuba-api', ARTIFACT_REPOSITORY: 'my-root-cuba', GEMINI_SECRET_NAME: 'my-root-cuba-key',
  GCP_RUNTIME_SERVICE_ACCOUNT: 'runtime@synthetic-run-project.iam.gserviceaccount.com' };
test('Hosting configuration publishes only the client, preserves the source template and cannot deploy database rules', () => {
  const before = structuredClone(template), config = createHostingConfig(template, 'synthetic-host', '/app');
  assert.equal(config.hosting.public, '/app/dist/client'); assert.equal(config.hosting.site, 'synthetic-host');
  assert.deepEqual(Object.keys(config), ['hosting']); assert.deepEqual(template, before); assert.deepEqual(config.hosting.rewrites, [{ source: '**', destination: '/index.html' }]);
});
test('an ambiguous Hosting destination or a directory containing the server bundle is refused', () => {
  for (const site of ['', '../site', 'site;echo bad', 'site.example.com']) assert.throws(() => createHostingConfig(template, site, '/app'));
  assert.throws(() => createHostingConfig({ hosting: { public: 'dist' } }, 'synthetic-host', '/app'));
});
test('two explicit deployment projects are supported without changing the Firebase database project', () => {
  assert.equal(validateDeploySettings(settings), settings);
});
test('missing settings, injected shell text and replacing the AI Studio service are refused', () => {
  for (const name of Object.keys(settings)) { const value = { ...settings }; delete value[name]; assert.throws(() => validateDeploySettings(value)); }
  for (const value of ['bad;echo bad', 'project/another', '$(echo bad)']) assert.throws(() => validateDeploySettings({ ...settings, RUN_PROJECT_ID: value }));
  assert.throws(() => validateDeploySettings({ ...settings, RUN_SERVICE: 'ais-pre-existing' }));
});
