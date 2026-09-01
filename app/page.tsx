import { NazcaShell } from '@/components/nazca-shell';
import { buildProvenance } from '@/lib/provenance';

export default function Home() {
  return <NazcaShell provenance={buildProvenance} />;
}
