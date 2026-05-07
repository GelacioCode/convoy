import { useTripStore } from '../../store/tripStore';
import { REACTIONS } from '../../lib/constants';

export default function ReactionToasts() {
  const toasts = useTripStore((s) => s.toasts);
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none absolute bottom-32 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => {
        if (t.type === 'system') {
          let cls = 'bg-slate-100 text-slate-800 ring-slate-200';
          let icon = null;
          if (t.variant === 'warning') {
            cls = 'bg-amber-100 text-amber-900 ring-amber-200';
            icon = '⚠️';
          } else if (t.variant === 'info') {
            cls = 'bg-blue-100 text-blue-900 ring-blue-200';
            icon = '🔄';
          }
          return (
            <div
              key={t.id}
              className={`rounded-full px-3 py-1.5 text-sm shadow-lg ring-1 ${cls}`}
            >
              {icon && <span className="mr-1">{icon}</span>}
              {t.message}
            </div>
          );
        }
        const reaction = REACTIONS.find((r) => r.id === t.reactionType);
        return (
          <div
            key={t.id}
            className="rounded-full bg-white px-3 py-1.5 text-sm shadow-lg ring-1 ring-slate-200"
          >
            <span className="font-semibold" style={{ color: t.color }}>
              {t.participantName}
            </span>{' '}
            <span className="text-lg leading-none">{reaction?.label}</span>{' '}
            <span className="text-slate-500">{reaction?.description}</span>
          </div>
        );
      })}
    </div>
  );
}
