import { z } from 'zod';

const sha1 = z.string().regex(/^[a-f0-9]{40}$/);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const httpsUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith('https://'));
const isoTime = z.string().datetime({ offset: true });
const identifier = z.string().min(1).max(512);

export const sourceReferenceSchema = z
  .object({
    sourceHost: z.literal('enlossengas.fandom.com'),
    sourceUrl: httpsUrl.refine(
      (value) => new URL(value).hostname === 'enlossengas.fandom.com',
      'Source URL must use enlossengas.fandom.com.',
    ),
    sourcePageId: z.number().int().positive().optional(),
    sourceRevisionId: z.number().int().positive().optional(),
    sourceTitle: z.string().min(1).max(512).optional(),
    sourceSha1: sha1.optional(),
    cutoffAt: isoTime,
  })
  .strict();

export const corpusSnapshotSchema = z
  .object({
    recordType: z.literal('CorpusSnapshotV1'),
    schemaVersion: z.literal('1.0.0'),
    id: z.string().min(1).max(160),
    capturedAt: isoTime,
    stableAt: isoTime.optional(),
    stable: z.boolean(),
    source: z
      .object({
        apiUrl: httpsUrl,
        rightsUrl: httpsUrl,
        termsUrl: httpsUrl,
        termsSha256: sha256,
        robotsUrl: httpsUrl,
        robotsState: z.enum(['allowed', 'blocked', 'challenge', 'unavailable']),
        robotsSha256: sha256.optional(),
        robotsPolicy: z
          .object({
            userAgentToken: z.string().min(1).max(160),
            matchedAgents: z.array(z.string().min(1).max(160)).max(32),
            decisions: z
              .array(
                z
                  .object({
                    pathname: z.string().min(1).max(2048),
                    allowed: z.boolean(),
                    winningRule: z
                      .object({
                        directive: z.enum(['allow', 'disallow']),
                        path: z.string().max(2048),
                      })
                      .strict()
                      .nullable(),
                  })
                  .strict(),
              )
              .min(1)
              .max(128),
          })
          .strict(),
      })
      .strict(),
    counts: z
      .object({
        totalPages: z.number().int().nonnegative(),
        articles: z.number().int().nonnegative(),
        routes: z.number().int().nonnegative(),
        redirects: z.number().int().nonnegative(),
        templates: z.number().int().nonnegative(),
        modules: z.number().int().nonnegative(),
        maps: z.number().int().nonnegative(),
        revisions: z.number().int().nonnegative(),
        media: z.number().int().nonnegative(),
        mediaBytes: z.number().int().nonnegative(),
      })
      .strict(),
    captureCoverage: z
      .object({
        titleInventory: z.boolean(),
        currentMediaInventory: z.boolean(),
        pageBodies: z.boolean(),
        categoryEdges: z.boolean(),
        redirectTargets: z.boolean(),
        templateModuleClosure: z.boolean(),
        mapPayloads: z.boolean(),
        revisionBundles: z.boolean(),
        stableReconciliation: z.boolean(),
      })
      .strict(),
    bundleSha256: z.record(z.string().min(1).max(80), sha256),
    manifestSha256: sha256,
    importerVersion: z.string().min(1).max(80),
  })
  .strict();

export const pageRecordSchema = z
  .object({
    recordType: z.literal('PageRecordV1'),
    schemaVersion: z.literal('1.0.0'),
    id: z.string().min(1).max(160),
    pageId: z.number().int().positive(),
    title: z.string().min(1).max(512),
    normalizedTitle: z.string().min(1).max(512),
    route: z.string().min(1).max(1024),
    summary: z.string().max(16_384).optional(),
    aliases: z.array(identifier).max(512),
    safeBody: z.string().max(8_388_608),
    sections: z
      .array(
        z
          .object({
            id: z.string().min(1).max(512),
            anchor: z.string().min(1).max(512),
            level: z.number().int().min(1).max(6),
            heading: z.string().min(1).max(1024),
            markdown: z.string().max(1_048_576),
          })
          .strict(),
      )
      .max(512),
    categories: z.array(z.string().min(1).max(512)).max(512),
    tables: z.array(z.record(z.string().max(160), z.unknown())).max(512),
    citations: z.array(z.record(z.string().max(160), z.unknown())).max(2048),
    internalLinks: z.array(identifier).max(8192),
    externalLinks: z.array(httpsUrl).max(4096),
    mediaIds: z.array(z.string().min(1).max(512)).max(2048),
    mapIds: z.array(identifier).max(128),
    revisionBundleId: identifier,
    importTransforms: z.array(z.string().min(1).max(2048)).max(512),
    source: sourceReferenceSchema,
    translation: z
      .object({
        sourceLanguage: z.literal('en'),
        cantonese: z.enum(['untranslated', 'reviewed']),
      })
      .strict(),
    renderedSha256: sha256,
  })
  .strict();

export const redirectRecordSchema = z
  .object({
    recordType: z.literal('RedirectRecordV1'),
    schemaVersion: z.literal('1.0.0'),
    id: z.string().min(1).max(160),
    sourceTitle: z.string().min(1).max(512),
    sourceRoute: z.string().min(1).max(1024),
    targetTitle: z.string().min(1).max(512),
    targetRoute: z.string().min(1).max(1024).optional(),
    fragmentMap: z.record(z.string().max(512), z.string().max(512)),
    sourceRevisionId: z.number().int().positive(),
    state: z.enum([
      'resolved',
      'missing-target',
      'outside-reader-corpus',
      'invalid',
    ]),
    source: sourceReferenceSchema,
  })
  .strict();

export const mediaRecordSchema = z
  .object({
    recordType: z.literal('MediaRecordV1'),
    schemaVersion: z.literal('1.0.0'),
    id: z.string().min(1).max(512),
    canonicalTitle: z.string().min(1).max(512),
    sourceSha1: sha1,
    storedSha256: sha256.optional(),
    bytes: z.number().int().nonnegative(),
    mime: z.string().min(1).max(160),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    alt: z.string().min(1).max(2048),
    rightsId: z.string().min(1).max(512),
    state: z.enum([
      'manifest-only',
      'staged',
      'verified',
      'published',
      'blocked',
    ]),
    releaseTag: z.string().max(160).optional(),
    releaseAssetName: z.string().max(255).optional(),
    immutableUrl: httpsUrl.optional(),
    source: sourceReferenceSchema,
  })
  .strict()
  .superRefine((record, context) => {
    if (record.state !== 'published') return;
    for (const field of [
      'storedSha256',
      'releaseTag',
      'releaseAssetName',
      'immutableUrl',
    ]) {
      if (!record[field as keyof typeof record]) {
        context.addIssue({
          code: 'custom',
          path: [field],
          message: `${field} is required when media state is published.`,
        });
      }
    }
  });

export const revisionBundleSchema = z
  .object({
    recordType: z.literal('RevisionBundleV1'),
    schemaVersion: z.literal('1.0.0'),
    id: identifier,
    pageId: z.number().int().positive(),
    revisions: z
      .array(
        z
          .object({
            revisionId: z.number().int().positive(),
            parentId: z.number().int().nonnegative().optional(),
            timestamp: isoTime,
            contributor: z.string().min(1).max(512),
            comment: z.string().max(16_384),
            contentSha256: sha256,
          })
          .strict(),
      )
      .min(1),
    archiveTag: z.string().min(1).max(160),
    archiveAsset: z.string().min(1).max(255),
    archiveSha256: sha256,
    attributionState: z.enum(['complete', 'partial', 'blocked']),
  })
  .strict();

export const mapRecordSchema = z
  .object({
    recordType: z.literal('MapRecordV1'),
    schemaVersion: z.literal('1.0.0'),
    id: identifier,
    title: identifier,
    sourcePayloadSha256: sha256,
    bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    mediaId: identifier.optional(),
    layers: z.array(z.record(z.string().max(160), z.unknown())).max(512),
    markers: z.array(z.record(z.string().max(160), z.unknown())).max(100_000),
    deepLinks: z.array(z.string().min(1).max(2048)).max(100_000),
    textualEquivalent: z.string().min(1).max(2_097_152),
    source: sourceReferenceSchema,
  })
  .strict();

export const rightsRecordSchema = z
  .object({
    recordType: z.literal('RightsRecordV1'),
    schemaVersion: z.literal('1.0.0'),
    id: identifier,
    mediaId: identifier,
    creator: z.string().max(2048).nullable(),
    attribution: z.string().max(8192),
    license: z.string().min(1).max(512),
    permissionBasis: z.string().min(1).max(2048),
    reviewEvidence: z.array(z.string().min(1).max(2048)).max(128),
    obligations: z.array(z.string().min(1).max(2048)).max(128),
    takedownState: z.enum(['clear', 'requested', 'removed', 'disputed']),
  })
  .strict();

export const mediaVolumeSchema = z
  .object({
    recordType: z.literal('MediaVolumeV1'),
    schemaVersion: z.literal('1.0.0'),
    id: z.string().regex(/^fandom-media-v1-\d{6}$/),
    releaseTag: z.string().regex(/^fandom-media-v1-\d{6}$/),
    objectCount: z.number().int().min(1).max(900),
    bytes: z.number().int().min(1).max(1_073_741_824),
    catalogSha256: sha256,
    publicationState: z.enum(['planned', 'draft', 'verified', 'published']),
  })
  .strict();

export const featureCoverageSchema = z
  .object({
    recordType: z.literal('FeatureCoverageV1'),
    schemaVersion: z.literal('1.0.0'),
    id: identifier,
    feature: identifier,
    route: z.string().min(1).max(1024),
    component: z.string().min(1).max(1024),
    localizedCopy: z.array(z.enum(['en', 'zh-HK', 'bilingual'])).min(1),
    persistence: z.string().min(1).max(1024),
    documentation: z.string().min(1).max(1024),
    focusedTest: z.string().min(1).max(1024),
    interactionProof: z.string().min(1).max(1024),
    captureEvidence: z.string().min(1).max(1024),
    negativeRegression: z.string().min(1).max(1024),
    state: z.enum(['missing', 'implemented', 'verified']),
  })
  .strict();

export const visitorStateSchema = z
  .object({
    recordType: z.literal('VisitorStateV1'),
    schemaVersion: z.literal('1.0.0'),
    revision: z.number().int().nonnegative(),
    settings: z.record(z.string().max(160), z.unknown()),
    tabs: z.array(z.record(z.string().max(160), z.unknown())).max(2048),
    groups: z.array(z.record(z.string().max(160), z.unknown())).max(512),
    appearance: z.record(z.string().max(160), z.unknown()),
    schedules: z.array(z.record(z.string().max(160), z.unknown())).max(2048),
    attentionModes: z.record(z.string().max(160), z.boolean()),
    notifications: z
      .array(z.record(z.string().max(160), z.unknown()))
      .max(10_000),
    converterQueue: z
      .array(z.record(z.string().max(160), z.unknown()))
      .max(100_000),
    encryptedSubrecords: z
      .array(
        z
          .object({
            id: identifier,
            kind: z.enum(['lock', 'authenticator', 'history-secret']),
            ciphertext: z.string().min(1).max(16_777_216),
            algorithm: z.string().min(1).max(160),
          })
          .strict(),
      )
      .max(10_000),
  })
  .strict();

export const searchSurfaceSchema = z
  .object({
    recordType: z.literal('SearchSurfaceV1'),
    schemaVersion: z.literal('1.0.0'),
    id: z.string().min(1).max(240),
    route: z.string().min(1).max(1024),
    owner: z.string().min(1).max(240),
    scope: z.string().min(1).max(512),
    fieldId: z.string().min(1).max(240),
    builderId: z.string().min(1).max(240),
    stateKey: z.string().min(1).max(240),
    activationTarget: z.string().min(1).max(240),
    focusReturnTarget: z.string().min(1).max(240),
    plainTextDefault: z.literal(true),
    anchoredBuilder: z.literal(true),
  })
  .strict();

export type CorpusSnapshotV1 = z.infer<typeof corpusSnapshotSchema>;
export type PageRecordV1 = z.infer<typeof pageRecordSchema>;
export type RedirectRecordV1 = z.infer<typeof redirectRecordSchema>;
export type MediaRecordV1 = z.infer<typeof mediaRecordSchema>;
export type SearchSurfaceV1 = z.infer<typeof searchSurfaceSchema>;
export type RevisionBundleV1 = z.infer<typeof revisionBundleSchema>;
export type MapRecordV1 = z.infer<typeof mapRecordSchema>;
export type RightsRecordV1 = z.infer<typeof rightsRecordSchema>;
export type MediaVolumeV1 = z.infer<typeof mediaVolumeSchema>;
export type FeatureCoverageV1 = z.infer<typeof featureCoverageSchema>;
export type VisitorStateV1 = z.infer<typeof visitorStateSchema>;
