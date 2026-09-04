import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleReader } from '@/components/article-reader';
import { ReaderStatePage } from '@/components/reader-state-page';
import { buildProvenance } from '@/lib/provenance';
import { loadCurrentRoute, loadCurrentRoutes } from '@/lib/current-corpus';
import { publicPath } from '@/lib/public-path';

function routeFromSlug(slug: string[]) {
  const joined = slug.join('/');
  const direct = `/wiki/${slug.map((segment) => segment.includes('%') ? segment : encodeURIComponent(segment)).join('/')}`;
  let decoded = joined;
  try { decoded = decodeURIComponent(joined); } catch { /* keep the bounded route candidate */ }
  const match = loadCurrentRoutes().find((entry) => {
    try { return decodeURIComponent(entry.route.slice('/wiki/'.length)) === decoded; } catch { return false; }
  });
  return match?.route ?? direct;
}

export function generateStaticParams() {
  return loadCurrentRoutes().map((entry) => ({
    slug: entry.route.slice('/wiki/'.length).split('/'),
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const result = loadCurrentRoute(routeFromSlug(slug));
  if (result.kind === 'article') return { title: result.record.displayTitle, description: result.record.plainTextExcerpt, alternates: { canonical: publicPath(result.record.route) } };
  if (result.kind === 'redirect') return {
    title: `${result.record.sourceTitle} redirect`,
    alternates: result.record.targetRoute ? { canonical: publicPath(result.record.targetRoute) } : undefined,
    robots: { index: false, follow: false },
  };
  return { title: 'Article unavailable', robots: { index: false, follow: false } };
}

export default async function WikiArticlePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const result = loadCurrentRoute(routeFromSlug(slug));
  if (result.kind === 'missing') notFound();
  if (result.kind === 'article') return <ArticleReader record={result.record} provenance={buildProvenance} />;
  const target = result.record.targetRoute ? publicPath(result.record.targetRoute) : null;
  return (
    <>
      {target ? <meta httpEquiv="refresh" content={`0;url=${target}`} /> : null}
      <ReaderStatePage state={{ kind: 'redirect', record: result.record }} provenance={buildProvenance} />
    </>
  );
}
