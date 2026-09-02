import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleReader } from '@/components/article-reader';
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
  if (result.kind === 'redirect') return { title: `${result.record.sourceTitle} redirect`, robots: { index: false, follow: false } };
  return { title: 'Article unavailable', robots: { index: false, follow: false } };
}

export default async function WikiArticlePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const result = loadCurrentRoute(routeFromSlug(slug));
  if (result.kind === 'missing') notFound();
  if (result.kind === 'article') return <ArticleReader record={result.record} provenance={buildProvenance} />;
  const target = result.record.targetRoute ? publicPath(result.record.targetRoute) : null;
  return (
    <main className="article-page redirect-page" id="main-content">
      {target ? <meta httpEquiv="refresh" content={`0;url=${target}`} /> : null}
      <p className="eyebrow">Nazca Railway current snapshot</p>
      <h1>{result.record.sourceTitle}</h1>
      <p>This title is a source redirect and is not indexed as an article.</p>
      <p>Target: {result.record.targetTitle}</p>
      {target ? <a className="button" href={target}>Continue to the current article</a> : <p>The target is outside this reader corpus or the redirect syntax was invalid. Open the <a href={result.record.sourceUrl}>source record</a> for details.</p>}
      <p><a href={result.record.sourceUrl} target="_blank" rel="noopener noreferrer external" referrerPolicy="no-referrer">Open source redirect record</a></p>
    </main>
  );
}
