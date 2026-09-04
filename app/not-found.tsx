import { ReaderStatePage } from '@/components/reader-state-page';
import { loadCurrentCorpusManifest, loadCurrentRoutes } from '@/lib/current-corpus';
import { buildProvenance } from '@/lib/provenance';

export default function NotFound() {
  const articleCount = loadCurrentCorpusManifest().counts.articles;
  const fallbackArticleRoute = loadCurrentRoutes().find((route) => route.title === 'Nazca Railway (Los Sengas Division)')?.route;
  return (
    <ReaderStatePage
      state={{ kind: 'not-found' }}
      provenance={buildProvenance}
      articleCount={articleCount}
      fallbackArticleRoute={fallbackArticleRoute}
    />
  );
}
