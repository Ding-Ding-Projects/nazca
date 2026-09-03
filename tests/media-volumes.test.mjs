import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mediaReleaseRegistry,
  mediaReleaseRegistrySchema,
  publishedMediaAssetForTitle,
} from '../lib/media-volumes.ts';

const source = {
  sourceHost: 'enlossengas.fandom.com',
  sourceUrl: 'https://enlossengas.fandom.com/wiki/File:tram.png',
  sourceSha1: '0123456789abcdef0123456789abcdef01234567',
  cutoffAt: '2026-01-01T00:00:00Z',
};

const rights = {
  id: 'rights-1',
  attribution: 'Source attribution',
  license: 'CC BY-SA',
  permissionBasis: 'Recorded permission',
  evidence: ['https://example.com/rights-1'],
};

function publishedRegistry(
  immutableUrl = 'https://github.com/Ding-Ding-Projects/nazca/releases/download/nazca-media-v1-000001/tram.png',
) {
  return {
    recordType: 'MediaReleaseRegistryV1',
    schemaVersion: '1.0.0',
    repository: 'Ding-Ding-Projects/nazca',
    maxAssetsPerRelease: 1000,
    registryState: 'contains-published-assets',
    note: 'Published test media',
    releases: [
      {
        recordType: 'MediaReleaseVolumeV1',
        schemaVersion: '1.0.0',
        releaseTag: 'nazca-media-v1-000001',
        releaseUrl:
          'https://github.com/Ding-Ding-Projects/nazca/releases/tag/nazca-media-v1-000001',
        reservedAssetSlots: 1000,
        expectedAssetCount: 1,
        publicationState: 'published',
        assets: [
          {
            recordType: 'MediaReleaseAssetV1',
            schemaVersion: '1.0.0',
            mediaId: 'media-1',
            canonicalTitle: 'Tram image',
            kind: 'image',
            source,
            rights,
            releaseAssetName: 'tram.png',
            expectedBytes: 1,
            expectedMime: 'image/png',
            expectedSha256:
              '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            assetState: 'published',
            immutableUrl,
            githubDigest:
              '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            verifiedBytes: 1,
            verifiedAt: '2026-01-01T00:00:00Z',
          },
        ],
        manifestSha256:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        checksumsFile: 'checksums.txt',
      },
    ],
  };
}

test('the shipped registry is an honest empty registry', () => {
  assert.equal(mediaReleaseRegistry.registryState, 'empty');
  assert.deepEqual(mediaReleaseRegistry.releases, []);
  assert.equal(publishedMediaAssetForTitle('Tram image'), null);
});

test('published asset lookup requires the exact immutable release URL', () => {
  const parsed = mediaReleaseRegistrySchema.safeParse(publishedRegistry());
  assert.equal(parsed.success, true);
  assert.equal(
    parsed.success && parsed.data.releases[0].assets[0].immutableUrl,
    'https://github.com/Ding-Ding-Projects/nazca/releases/download/nazca-media-v1-000001/tram.png',
  );

  const invalid = mediaReleaseRegistrySchema.safeParse(
    publishedRegistry('https://example.com/tram.png'),
  );
  assert.equal(invalid.success, false);
});

test('pending state cannot exist without a release record', () => {
  const invalid = mediaReleaseRegistrySchema.safeParse({
    ...mediaReleaseRegistry,
    registryState: 'contains-pending-assets',
  });
  assert.equal(invalid.success, false);
});
