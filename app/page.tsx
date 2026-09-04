import { NazcaShell } from '@/components/nazca-shell';
import { loadCurrentSearchIndex } from '@/lib/current-corpus';
import { buildProvenance } from '@/lib/provenance';

export default function Home() {
  return <NazcaShell provenance={buildProvenance} corpusSearch={loadCurrentSearchIndex()} />;
}
