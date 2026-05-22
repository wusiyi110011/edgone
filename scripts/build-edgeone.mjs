import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const h5DistDir = path.join(rootDir, 'apps/h5/dist');
const templateDir = path.join(rootDir, 'deploy/edgeone-template');
const outputDir = path.join(rootDir, 'edgeone-deploy');

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  await cp(h5DistDir, outputDir, { recursive: true });
  await cp(templateDir, outputDir, { recursive: true });

  const packageJson = {
    name: 'openclaw-edgeone',
    private: true,
    type: 'module',
    dependencies: {
      cors: '^2.8.5',
      express: '^5.1.0',
    },
  };

  await writeFile(
    path.join(outputDir, 'package.json'),
    `${JSON.stringify(packageJson, null, 2)}\n`,
    'utf8',
  );

  console.log(`EdgeOne deploy bundle created at ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
