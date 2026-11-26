import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function createHostingConfig(template, siteId, root) {
  if (!/^[a-z0-9][a-z0-9-]{3,28}[a-z0-9]$/.test(siteId)) throw new Error('Specify an explicit Hosting site ID (5–30 lowercase letters, digits and hyphens).');
  if (template.hosting?.public !== 'dist/client') throw new Error('Hosting must publish only dist/client.');
  // A generated --config file lives under .firebase-deploy, one level below root.
  return { hosting: { ...template.hosting, site: siteId, public: path.join(root, 'dist/client') } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const config = createHostingConfig(JSON.parse(await readFile(path.join(root, 'firebase.json'), 'utf8')), process.env.FIREBASE_HOSTING_SITE || '', root);
  await mkdir(path.join(root, '.firebase-deploy'), { recursive: true });
  await writeFile(path.join(root, '.firebase-deploy/hosting.json'), JSON.stringify(config, null, 2) + '\n');
  console.log(`Prepared Hosting-only configuration for ${config.hosting.site}.`);
}
