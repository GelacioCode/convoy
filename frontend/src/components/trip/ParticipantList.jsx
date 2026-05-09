import { FaChevronUp, FaRightFromBracket } from 'react-icons/fa6';
import Avatar from '../ui/Avatar';
import { distanceMeters } from '../../utils/geo';
import { estimateETA } from '../../utils/eta';
import { formatDuration, formatDistance } from '../../utils/formatters';

const MODE_AVG_SPEED_KMH = {
  driving: 50,
  motorcycling: 60,
  cycling: 18,
  running: 10,
  walking: 5,
};

function speedClass(speedKmh) {
  if (speedKmh == null || speedKmh < 1) {
    return { label: 'Stopped', cls: 'bg-slate-100 text-slate-600' };
  }
  if (speedKmh < 10) {
    return { label: 'Slow', cls: 'bg-yellow-100 text-yellow-700' };
  }
  if (speedKmh < 40) {
    return { label: 'Moving', cls: 'bg-blue-100 text-blue-700' };
  }
  return { label: 'Fast', cls: 'bg-emerald-100 text-emerald-700' };
}

function SpeedBadge({ speed }) {
  const { label, cls } = speedClass(speed);
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}

export default function ParticipantList({
  participants,
  myParticipantId,
  destination,
  transportMode = 'driving',
  onCollapse,
  onLeave,
  isHost = false,
}) {
  const modeAvg = MODE_AVG_SPEED_KMH[transportMode] ?? 30;
  const sorted = [...participants].sort((a, b) => {
    if (a.finished_at && b.finished_at) return (a.finish_rank ?? 99) - (b.finish_rank ?? 99);
    if (a.finished_at) return -1;
    if (b.finished_at) return 1;
    if (a.lat == null) return 1;
    if (b.lat == null) return -1;
    const da = distanceMeters({ lat: a.lat, lng: a.lng }, destination);
    const db = distanceMeters({ lat: b.lat, lng: b.lng }, destination);
    return da - db;
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Riders ({participants.length})
        </p>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Collapse riders panel"
            className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            <FaChevronUp className="h-3 w-3" aria-hidden />
          </button>
        )}
      </div>
      <ul className="max-h-[40vh] space-y-2 overflow-y-auto">
        {sorted.map((p) => {
          const dist =
            p.lat != null && p.lng != null
              ? distanceMeters({ lat: p.lat, lng: p.lng }, destination)
              : null;
          const eta = dist != null ? estimateETA(dist, p.speed_kmh, modeAvg) : null;

          let status;
          if (p.finished_at) {
            status = (
              <span className="font-semibold text-emerald-600">
                Finished #{p.finish_rank ?? '—'}
              </span>
            );
          } else if (dist == null) {
            status = <span className="text-slate-400">Locating…</span>;
          } else {
            status = (
              <>
                {formatDistance(dist)} • {formatDuration(eta)}
              </>
            );
          }

          return (
            <li key={p.id} className="flex items-center gap-2">
              <Avatar name={p.display_name} color={p.color} size={28} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">
                    {p.display_name}
                    {p.id === myParticipantId && (
                      <span className="ml-1 text-xs text-slate-500">(you)</span>
                    )}
                  </span>
                  {!p.finished_at && p.lat != null && (
                    <SpeedBadge speed={p.speed_kmh} />
                  )}
                </div>
                <div className="text-xs text-slate-500">{status}</div>
              </div>
            </li>
          );
        })}
      </ul>
      {onLeave && (
        <button
          type="button"
          onClick={onLeave}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
        >
          <FaRightFromBracket className="h-3 w-3" aria-hidden />
          {isHost ? 'End trip for everyone' : 'Leave trip'}
        </button>
      )}
    </div>
  );
}
