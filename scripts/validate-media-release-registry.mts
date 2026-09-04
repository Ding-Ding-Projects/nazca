import { readFile } from 'node:fs/promises';
import { mediaReleaseRegistrySchema } from '../lib/media-volumes.ts';

const [manifestPath, expectedRepository] = process.argv.slice(2);

if (!manifestPath) {
  console.error(
    'Usage: node --experimental-strip-types scripts/validate-media-release-registry.mts <manifest> [repository]',
  );
  process.exitCode = 2;
} else {
  let rawManifest: string | undefined;
  try {
    rawManifest = await readFile(manifestPath, 'utf8');
  } catch (error) {
    console.error(
      `Unable to read media release registry: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }

  if (rawManifest !== undefined) {
    let value: unknown;
    try {
      value = JSON.parse(rawManifest) as unknown;
    } catch (error) {
      console.error(
        `Media release registry JSON is malformed: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 1;
      value = undefined;
    }

    if (value !== undefined) {
      const result = mediaReleaseRegistrySchema.safeParse(value);
      if (!result.success) {
        console.error('Media release registry validation failed:');
        for (const issue of result.error.issues) {
          console.error(`- ${issue.path.join('.')} ${issue.message}`);
        }
        process.exitCode = 1;
      } else if (
        expectedRepository !== undefined &&
        result.data.repository !== expectedRepository
      ) {
        console.error(
          `Media release registry repository ${result.data.repository} does not match expected repository ${expectedRepository}.`,
        );
        process.exitCode = 1;
      } else {
        console.log(
          `Media release registry validated: repository=${result.data.repository}, releases=${result.data.releases.length}.`,
        );
      }
    }
  }
}
