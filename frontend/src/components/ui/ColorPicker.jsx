import { MARKER_COLORS } from '../../lib/constants';

export default function ColorPicker({ value, onChange, taken = [] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {MARKER_COLORS.map((c) => {
        const disabled = taken.includes(c);
        return (
          <button
            key={c}
            type="button"
            disabled={disabled}
            onClick={() => onChange?.(c)}
            className={`h-10 w-10 rounded-full border-2 transition ${
              value === c
                ? 'border-slate-900 ring-2 ring-slate-900 ring-offset-2'
                : 'border-transparent'
            } ${disabled ? 'cursor-not-allowed opacity-30' : 'hover:scale-105'}`}
            style={{ backgroundColor: c }}
            aria-label={`color ${c}`}
          />
        );
      })}
    </div>
  );
}
