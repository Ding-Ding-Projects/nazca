import rawRegistry from '../data/media/release-volumes.json' with { type: 'json' };
import { sourceReferenceSchema } from './contracts.ts';
import { z } from 'zod';

export const MAX_MEDIA_ASSETS_PER_RELEASE = 1_000;

const sha1 = z.string().regex(/^[a-f0-9]{40}$/);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const httpsUrl = z.url().refine((value) => value.startsWith('https://'));
const safeAssetName = z
  .string()
  .min(1)
  .max(127)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
  .refine(
    (value) => !value.includes('..'),
    'Asset names cannot contain parent-directory segments.',
  );

const rightsSchema = z
  .object({
    id: z.string().min(1).max(512),
    attribution: z.string().min(1).max(8_192),
    license: z.string().min(1).max(512),
    permissionBasis: z.string().min(1).max(2_048),
    evidence: z.array(httpsUrl).min(1).max(32),
  })
  .strict();

const imageMimeSchema = z.enum([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

export const mediaReleaseAssetSchema = z
  .object({
    recordType: z.literal('MediaReleaseAssetV1'),
    schemaVersion: z.literal('1.0.0'),
    mediaId: z.string().min(1).max(512),
    canonicalTitle: z.string().min(1).max(512),
    kind: z.literal('image'),
    source: sourceReferenceSchema.extend({ sourceSha1: sha1 }),
    rights: rightsSchema,
    releaseAssetName: safeAssetName,
    expectedBytes: z.number().int().positive(),
    expectedMime: imageMimeSchema,
    expectedSha256: sha256,
    assetState: z.enum(['planned', 'uploaded', 'verified', 'published']),
    immutableUrl: httpsUrl.optional(),
    githubDigest: sha256.optional(),
    verifiedBytes: z.number().int().positive().optional(),
    verifiedAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict()
  .superRefine((asset, context) => {
    if (asset.assetState !== 'published') return;
    for (const field of [
      'immutableUrl',
      'githubDigest',
      'verifiedBytes',
      'verifiedAt',
    ] as const) {
      if (asset[field] === undefined) {
        context.addIssue({
          code: 'custom',
          path: [field],
          message: `${field} is required for a published asset.`,
        });
      }
    }
    if (
      asset.verifiedBytes !== undefined &&
      asset.verifiedBytes !== asset.expectedBytes
    ) {
      context.addIssue({
        code: 'custom',
        path: ['verifiedBytes'],
        message: 'Verified bytes must match expectedBytes.',
      });
    }
    if (
      asset.githubDigest !== undefined &&
      asset.githubDigest !== asset.expectedSha256
    ) {
      context.addIssue({
        code: 'custom',
        path: ['githubDigest'],
        message: 'GitHub digest must match expectedSha256.',
      });
    }
  });

export const mediaReleaseVolumeSchema = z
  .object({
    recordType: z.literal('MediaReleaseVolumeV1'),
    schemaVersion: z.literal('1.0.0'),
    releaseTag: z.string().regex(/^nazca-media-v1-\d{6}$/),
    releaseUrl: httpsUrl,
    reservedAssetSlots: z.literal(MAX_MEDIA_ASSETS_PER_RELEASE),
    expectedAssetCount: z
      .number()
      .int()
      .min(1)
      .max(MAX_MEDIA_ASSETS_PER_RELEASE),
    publicationState: z.enum(['planned', 'uploading', 'published']),
    assets: z
      .array(mediaReleaseAssetSchema)
      .min(1)
      .max(MAX_MEDIA_ASSETS_PER_RELEASE),
    manifestSha256: sha256,
    checksumsFile: safeAssetName,
  })
  .strict()
  .superRefine((volume, context) => {
    if (volume.assets.length !== volume.expectedAssetCount) {
      context.addIssue({
        code: 'custom',
        path: ['expectedAssetCount'],
        message: 'expectedAssetCount must equal the tracked asset count.',
      });
    }
    if (
      volume.publicationState === 'published' &&
      volume.assets.some((asset) => asset.assetState !== 'published')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['publicationState'],
        message: 'A published volume cannot contain an incomplete asset.',
      });
    }
    for (const [index, asset] of volume.assets.entries()) {
      if (
        volume.publicationState === 'published' &&
        asset.assetState !== 'published'
      ) {
        context.addIssue({
          code: 'custom',
          path: ['assets', index, 'assetState'],
          message: 'Published volumes require published assets.',
        });
      }
    }
  });

export const mediaReleaseRegistrySchema = z
  .object({
    recordType: z.literal('MediaReleaseRegistryV1'),
    schemaVersion: z.literal('1.0.0'),
    repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
    maxAssetsPerRelease: z.literal(MAX_MEDIA_ASSETS_PER_RELEASE),
    registryState: z.enum([
      'empty',
      'contains-pending-assets',
      'contains-published-assets',
    ]),
    note: z.string().min(1).max(2_048),
    releases: z.array(mediaReleaseVolumeSchema).max(1_000),
  })
  .strict()
  .superRefine((registry, context) => {
    const releaseTags = new Set<string>();
    const mediaIds = new Set<string>();
    const titles = new Set<string>();
    const assetNames = new Set<string>();
    let publishedAssets = 0;

    for (const [releaseIndex, release] of registry.releases.entries()) {
      if (releaseTags.has(release.releaseTag)) {
        context.addIssue({
          code: 'custom',
          path: ['releases', releaseIndex, 'releaseTag'],
          message: 'Release tags must be unique.',
        });
      }
      releaseTags.add(release.releaseTag);
      const expectedReleaseUrl = `https://github.com/${registry.repository}/releases/tag/${release.releaseTag}`;
      if (release.releaseUrl !== expectedReleaseUrl) {
        context.addIssue({
          code: 'custom',
          path: ['releases', releaseIndex, 'releaseUrl'],
          message: 'Release URL must address the exact immutable release tag.',
        });
      }
      for (const [assetIndex, asset] of release.assets.entries()) {
        if (mediaIds.has(asset.mediaId))
          context.addIssue({
            code: 'custom',
            path: ['releases', releaseIndex, 'assets', assetIndex, 'mediaId'],
            message: 'Media IDs must be unique.',
          });
        if (titles.has(asset.canonicalTitle))
          context.addIssue({
            code: 'custom',
            path: [
              'releases',
              releaseIndex,
              'assets',
              assetIndex,
              'canonicalTitle',
            ],
            message: 'Canonical media titles must be unique.',
          });
        if (assetNames.has(asset.releaseAssetName))
          context.addIssue({
            code: 'custom',
            path: [
              'releases',
              releaseIndex,
              'assets',
              assetIndex,
              'releaseAssetName',
            ],
            message: 'Release asset names must be unique.',
          });
        mediaIds.add(asset.mediaId);
        titles.add(asset.canonicalTitle);
        assetNames.add(asset.releaseAssetName);
        if (asset.assetState === 'published') {
          publishedAssets += 1;
          const expectedAssetUrl = `https://github.com/${registry.repository}/releases/download/${release.releaseTag}/${asset.releaseAssetName}`;
          if (asset.immutableUrl !== expectedAssetUrl) {
            context.addIssue({
              code: 'custom',
              path: [
                'releases',
                releaseIndex,
                'assets',
                assetIndex,
                'immutableUrl',
              ],
              message:
                'Published assets must use the exact GitHub release download URL.',
            });
          }
        }
      }
    }

    if (
      registry.registryState === 'empty' &&
      (registry.releases.length !== 0 || publishedAssets !== 0)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['registryState'],
        message:
          'An empty registry cannot contain releases or published assets.',
      });
    }
    if (
      registry.registryState === 'contains-pending-assets' &&
      registry.releases.length === 0
    ) {
      context.addIssue({
        code: 'custom',
        path: ['registryState'],
        message: 'A pending registry requires at least one release.',
      });
    }
    if (
      registry.registryState === 'contains-published-assets' &&
      publishedAssets === 0
    ) {
      context.addIssue({
        code: 'custom',
        path: ['registryState'],
        message: 'A non-empty registry requires at least one published asset.',
      });
    }
  });

export type MediaReleaseAssetV1 = z.infer<typeof mediaReleaseAssetSchema>;
export type MediaReleaseVolumeV1 = z.infer<typeof mediaReleaseVolumeSchema>;
export type MediaReleaseRegistryV1 = z.infer<typeof mediaReleaseRegistrySchema>;

export const mediaReleaseRegistry = mediaReleaseRegistrySchema.parse(
  rawRegistry,
) as MediaReleaseRegistryV1;

/** Exact-title lookup for the reader. Unverified or non-published records are never returned. */
export function publishedMediaAssetForTitle(
  title: string,
): MediaReleaseAssetV1 | null {
  for (const release of mediaReleaseRegistry.releases) {
    if (release.publicationState !== 'published') continue;
    const asset = release.assets.find(
      (candidate) => candidate.canonicalTitle === title,
    );
    if (!asset || asset.assetState !== 'published' || !asset.immutableUrl)
      continue;
    const expectedUrl = `https://github.com/${mediaReleaseRegistry.repository}/releases/download/${release.releaseTag}/${asset.releaseAssetName}`;
    if (asset.immutableUrl !== expectedUrl) continue;
    return asset;
  }
  return null;
}
