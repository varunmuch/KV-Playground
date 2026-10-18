/** What a slot of cache memory holds. Each kind has one data color (see styles). */
type SlotKind = 'shared' | 'a' | 'a-gen' | 'b' | 'b-gen' | 'reserved' | 'free';

const LABELS: Record<SlotKind, string> = {
  shared: 'Shared by both',
  a: 'Your prompt',
  'a-gen': 'Your answer',
  b: 'Their prompt',
  'b-gen': 'Their answer',
  reserved: 'Reserved, empty',
  free: 'Free',
};

export function MemoryLegend({ kinds }: { kinds: SlotKind[] }) {
  return (
    <ul className="legend">
      {kinds.map((kind) => (
        <li key={kind} className="legend__item">
          <span className={`slot slot--${kind} legend__swatch`} aria-hidden="true" />
          {LABELS[kind]}
        </li>
      ))}
    </ul>
  );
}
