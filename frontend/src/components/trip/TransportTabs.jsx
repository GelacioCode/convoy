import { TRANSPORT_MODES } from '../../lib/constants';

export default function TransportTabs({ value, onChange }) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {TRANSPORT_MODES.map((m) => {
        const active = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange?.(m.id)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm shadow-sm transition ${
              active
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-800 hover:bg-slate-100'
            }`}
          >
            <span className="mr-1">{m.icon}</span>
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
