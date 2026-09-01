import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleReader } from '@/components/article-reader';
import { buildProvenance } from '@/lib/provenance';

const NAZCA_SLUG = 'Nazca_Railway_(Los_Sengas_Division)';

export const metadata: Metadata = {
  title: 'Nazca Railway',
  description:
    'Nazca Railway Los Sengas Division, with structured sections, route data, history, and source attribution.',
};

export function generateStaticParams() {
  return [{ slug: [NAZCA_SLUG] }];
}

export default async function WikiArticlePage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  if (slug.join('/') !== NAZCA_SLUG) notFound();
  return <ArticleReader provenance={buildProvenance} />;
}
