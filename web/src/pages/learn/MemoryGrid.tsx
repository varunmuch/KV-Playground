import { tokenLabel } from '../../components/TokenChip';
import type { TokenPiece } from '../../data/types';
import type { MemoryState, RequestId, Slot } from '../../simulator';

function slotClass(slot: Slot): string {
  if (slot.state === 'free') return 'slot--free';
  if (slot.state === 'reserved') return 'slot--reserved';
  if (slot.owners.length > 1) return 'slot--shared';
  return `slot--${slot.owners[0]}${slot.kind === 'generated' ? '-gen' : ''}`;
}

function slotText(slot: Slot, sequences: Record<RequestId, TokenPiece[]>): string {
  if (slot.state !== 'filled' || slot.position === null) return '';
  const owner = slot.owners.includes('a') ? 'a' : 'b';
  const token = sequences[owner][slot.position];
  return token ? tokenLabel(token) : '';
}

interface MemoryGridProps {
  state: MemoryState;
  sequences: Record<RequestId, TokenPiece[]>;
  blockSize: number;
  paged: boolean;
  label: string;
}

/** GPU memory as token slots, drawn in groups of blockSize. Paged layouts get wider gaps between blocks. */
export function MemoryGrid({ state, sequences, blockSize, paged, label }: MemoryGridProps) {
  const blocks: Slot[][] = [];
  for (let i = 0; i < state.slots.length; i += blockSize) blocks.push(state.slots.slice(i, i + blockSize));

  return (
    <div className={`mem-grid${paged ? ' mem-grid--paged' : ''}`} role="img" aria-label={label}>
      {blocks.map((slots, b) => (
        <div key={b} className="mem-block">
          <div className="mem-block__slots">
            {slots.map((slot, i) => (
              <span key={i} className={`slot mem-slot ${slotClass(slot)}`}>
                <span className="mem-slot__text mono">{slotText(slot, sequences)}</span>
              </span>
            ))}
          </div>
          {paged && <span className="block__index mono">{b}</span>}
        </div>
      ))}
    </div>
  );
}
