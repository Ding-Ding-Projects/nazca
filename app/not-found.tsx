import { ReaderStatePage } from '@/components/reader-state-page';
import { loadCurrentSearchIndex } from '@/lib/current-corpus';
import { buildProvenance } from '@/lib/provenance';

export default function NotFound() {
  return (
    <ReaderStatePage
      state={{ kind: 'not-found' }}
      provenance={buildProvenance}
      corpusSearch={loadCurrentSearchIndex()}
    />
  );
}
