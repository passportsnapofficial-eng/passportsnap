import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const localSourceDir = resolve(rootDir, 'Test');
const publicFixturesDir = resolve(rootDir, 'public', 'test-fixtures');
const localOutputDir = resolve(publicFixturesDir, 'local-batch');
const externalOutputDir = resolve(publicFixturesDir, 'external');
const manifestPath = resolve(publicFixturesDir, 'pipeline-batch.json');

const LOCAL_FILES = [
  '360_F_373522464_UzkM3IvqgqpS0qIy2kpkB5QiV7Bw7NyS.jpg',
  '4a9c9654-aa65-45e8-b34a-3ce3f730583d-background-removed.jpg',
  '4a9c9654-aa65-45e8-b34a-3ce3f730583d.webp',
  'glasses_close_up.webp',
  'official-portrait-woman-passport-photo-600nw-2370794875.webp',
  'passport-photo-serious-young-adult-600nw-2317626543.webp',
  'WhatsApp Image 2026-04-07 at 11.06.38 PM.jpeg',
  'WhatsApp Image 2026-04-07 at 11.23.51 PM.jpeg',
  'WhatsApp Image 2026-04-07 at 11.23.52 PM (1).jpeg',
  'WhatsApp Image 2026-04-07 at 11.23.52 PM (2).jpeg',
  'WhatsApp Image 2026-04-07 at 11.23.52 PM (3).jpeg',
  'WhatsApp Image 2026-04-07 at 11.23.52 PM.jpeg',
  'WhatsApp Image 2026-04-08 at 12.14.41 PM (1).jpeg',
];

const EXTERNAL_FIXTURES = [
  {
    id: 'unsplash-woman-1',
    provider: 'Unsplash',
    url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?fm=jpg&q=80&w=1200&fit=crop',
  },
  {
    id: 'unsplash-man-1',
    provider: 'Unsplash',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?fm=jpg&q=80&w=1200&fit=crop',
  },
  {
    id: 'unsplash-man-2',
    provider: 'Unsplash',
    url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?fm=jpg&q=80&w=1200&fit=crop',
  },
  {
    id: 'unsplash-woman-2',
    provider: 'Unsplash',
    url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?fm=jpg&q=80&w=1200&fit=crop',
  },
  {
    id: 'unsplash-woman-3',
    provider: 'Unsplash',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?fm=jpg&q=80&w=1200&fit=crop',
  },
  {
    id: 'pexels-man-1',
    provider: 'Pexels',
    url: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=1200&h=1600&fit=crop',
  },
  {
    id: 'pexels-woman-1',
    provider: 'Pexels',
    url: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=1200&h=1600&fit=crop',
  },
  {
    id: 'pexels-woman-2',
    provider: 'Pexels',
    url: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=1200&h=1600&fit=crop',
  },
  {
    id: 'pexels-man-2',
    provider: 'Pexels',
    url: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=1200&h=1600&fit=crop',
  },
  {
    id: 'pexels-woman-3',
    provider: 'Pexels',
    url: 'https://images.pexels.com/photos/697509/pexels-photo-697509.jpeg?auto=compress&cs=tinysrgb&w=1200&h=1600&fit=crop',
  },
  {
    id: 'pexels-headshot-man-1',
    provider: 'Pexels',
    url: 'https://images.pexels.com/photos/32721690/pexels-photo-32721690.jpeg?cs=srgb&dl=pexels-shootsaga-32721690.jpg&fm=jpg',
  },
  {
    id: 'pexels-headshot-man-2',
    provider: 'Pexels',
    url: 'https://images.pexels.com/photos/32721688/pexels-photo-32721688.jpeg?cs=srgb&dl=pexels-shootsaga-32721688.jpg&fm=jpg',
  },
  {
    id: 'pexels-headshot-man-3',
    provider: 'Pexels',
    url: 'https://images.pexels.com/photos/30124371/pexels-photo-30124371.jpeg?cs=srgb&dl=pexels-ipaye-gbolahan-2147547099-30124371.jpg&fm=jpg',
  },
  {
    id: 'pexels-headshot-woman-1',
    provider: 'Pexels',
    url: 'https://images.pexels.com/photos/35721589/pexels-photo-35721589.jpeg?cs=srgb&dl=pexels-eric-quinones-2149843819-35721589.jpg&fm=jpg',
  },
  {
    id: 'pexels-headshot-man-4',
    provider: 'Pexels',
    url: 'https://images.pexels.com/photos/37148339/pexels-photo-37148339.jpeg?cs=srgb&dl=pexels-vincent-santamaria-194760512-37148339.jpg&fm=jpg',
  },
  {
    id: 'pexels-headshot-man-5',
    provider: 'Pexels',
    url: 'https://images.pexels.com/photos/36687798/pexels-photo-36687798.jpeg?cs=srgb&dl=pexels-travel-with-lenses-734723610-36687798.jpg&fm=jpg',
  },
  {
    id: 'pexels-headshot-man-6',
    provider: 'Pexels',
    url: 'https://images.pexels.com/photos/37148308/pexels-photo-37148308.jpeg?cs=srgb&dl=pexels-vincent-santamaria-194760512-37148308.jpg&fm=jpg',
  },
  {
    id: 'pexels-headshot-woman-2',
    provider: 'Pexels',
    url: 'https://images.pexels.com/photos/31530222/pexels-photo-31530222.jpeg?cs=srgb&dl=pexels-oliver-dohrn-706160180-31530222.jpg&fm=jpg',
  },
  {
    id: 'pexels-headshot-woman-3',
    provider: 'Pexels',
    url: 'https://images.pexels.com/photos/30468636/pexels-photo-30468636.jpeg?cs=srgb&dl=pexels-augustocarneirojr-30468636.jpg&fm=jpg',
  },
  {
    id: 'pexels-headshot-woman-4',
    provider: 'Pexels',
    url: 'https://images.pexels.com/photos/3786525/pexels-photo-3786525.jpeg?cs=srgb&dl=pexels-olly-3786525.jpg&fm=jpg',
  },
];

async function ensureDirs() {
  await mkdir(localOutputDir, { recursive: true });
  await mkdir(externalOutputDir, { recursive: true });
}

function relativeFixturePath(folder, filename) {
  return `/test-fixtures/${folder}/${filename}`;
}

async function copyLocalFixtures() {
  const cases = [];

  for (const file of LOCAL_FILES) {
    const sourcePath = resolve(localSourceDir, file);
    const outputPath = resolve(localOutputDir, file);
    await mkdir(dirname(outputPath), { recursive: true });
    await copyFile(sourcePath, outputPath);

    cases.push({
      sourcePath: relativeFixturePath('local-batch', file),
      description: `Local test image: ${file}`,
      sourceType: 'local',
    });
  }

  return cases;
}

async function downloadExternalFixtures() {
  const cases = [];

  for (const entry of EXTERNAL_FIXTURES) {
    const extension = extname(new URL(entry.url).pathname) || '.jpg';
    const filename = `${entry.id}${extension}`;
    const outputPath = resolve(externalOutputDir, filename);
    const response = await fetch(entry.url, {
      headers: {
        'User-Agent': 'PassportSnap validation bot',
      },
    });

    if (!response.ok) {
      throw new Error(`Could not download ${entry.id}: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(outputPath, buffer);

    cases.push({
      sourcePath: relativeFixturePath('external', filename),
      description: `${entry.provider} portrait: ${entry.id}`,
      sourceType: 'external',
      provider: entry.provider,
      remoteUrl: entry.url,
    });
  }

  return cases;
}

async function main() {
  await ensureDirs();

  const localCases = await copyLocalFixtures();
  const externalCases = await downloadExternalFixtures();
  const manifest = {
    generatedAt: new Date().toISOString(),
    localCount: localCases.length,
    externalCount: externalCases.length,
    cases: [...localCases, ...externalCases],
  };

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(JSON.stringify({
    manifestPath,
    localCount: localCases.length,
    externalCount: externalCases.length,
    totalCount: manifest.cases.length,
  }, null, 2));
}

await main();
