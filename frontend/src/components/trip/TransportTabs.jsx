import {
  FaCar,
  FaMotorcycle,
  FaBicycle,
  FaPersonRunning,
  FaPersonWalking,
} from 'react-icons/fa6';
import { TRANSPORT_MODES } from '../../lib/constants';

const ICON_BY_MODE = {
  driving: FaCar,
  motorcycling: FaMotorcycle,
  cycling: FaBicycle,
  running: FaPersonRunning,
  walking: FaPersonWalking,
};

export default function TransportTabs({ value, onChange }) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {TRANSPORT_MODES.map((m) => {
        const active = value === m.id;
        const Icon = ICON_BY_MODE[m.id];
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange?.(m.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm shadow-sm transition ${
              active
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-800 hover:bg-slate-100'
            }`}
          >
            {Icon && <Icon className="h-4 w-4" aria-hidden />}
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
