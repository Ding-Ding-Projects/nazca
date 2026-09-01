export function shouldShowDimSumSurprise({
  hasSeen,
  schoolMode,
  randomUint32,
}: {
  hasSeen: boolean;
  schoolMode: boolean;
  randomUint32: number;
}) {
  if (!hasSeen || schoolMode) return false;
  return randomUint32 / 0x1_0000_0000 < 0.1;
}
