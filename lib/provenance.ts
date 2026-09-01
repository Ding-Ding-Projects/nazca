export type BuildProvenance = {
  schemaVersion: string;
  version: string;
  builtAt: string | null;
  timezone: string;
  commitSha: string | null;
  dirty: boolean;
  deployment: string;
};

export const buildProvenance: BuildProvenance = {
  schemaVersion: '1.0.0',
  version: process.env.NEXT_PUBLIC_BUILD_VERSION ?? 'unavailable',
  builtAt: process.env.NEXT_PUBLIC_BUILD_TIMESTAMP ?? null,
  timezone: 'UTC',
  commitSha: process.env.NEXT_PUBLIC_BUILD_COMMIT_SHA ?? null,
  dirty: process.env.NEXT_PUBLIC_BUILD_DIRTY === 'true',
  deployment: process.env.NEXT_PUBLIC_BUILD_DEPLOYMENT ?? 'unavailable',
};

export function formatBuildTime(value: string | null) {
  if (!value) return 'Updated time unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return 'Updated time unavailable';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}
