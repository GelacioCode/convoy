import {
  FaThumbsUp,
  FaHand,
  FaCircleStop,
  FaBullhorn,
  FaTriangleExclamation,
  FaArrowsRotate,
} from 'react-icons/fa6';
import { useTripStore } from '../../store/tripStore';
import { REACTIONS } from '../../lib/constants';

const REACTION_ICON = {
  thumbsup: FaThumbsUp,
  wait: FaHand,
  pullover: FaCircleStop,
  horn: FaBullhorn,
};

export default function ReactionToasts() {
  const toasts = useTripStore((s) => s.toasts);
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none absolute bottom-32 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => {
        if (t.type === 'system') {
          let cls = 'bg-slate-100 text-slate-800 ring-slate-200';
          let Icon = null;
          if (t.variant === 'warning') {
            cls = 'bg-amber-100 text-amber-900 ring-amber-200';
            Icon = FaTriangleExclamation;
          } else if (t.variant === 'info') {
            cls = 'bg-blue-100 text-blue-900 ring-blue-200';
            Icon = FaArrowsRotate;
          }
          return (
            <div
              key={t.id}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm shadow-lg ring-1 ${cls}`}
            >
              {Icon && <Icon className="h-4 w-4" aria-hidden />}
              <span>{t.message}</span>
            </div>
          );
        }
        const reaction = REACTIONS.find((r) => r.id === t.reactionType);
        const Icon = REACTION_ICON[t.reactionType];
        return (
          <div
            key={t.id}
            className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm shadow-lg ring-1 ring-slate-200"
          >
            <span className="font-semibold" style={{ color: t.color }}>
              {t.participantName}
            </span>
            {Icon && <Icon className="h-4 w-4 text-slate-700" aria-hidden />}
            <span className="text-slate-500">{reaction?.description}</span>
          </div>
        );
      })}
    </div>
  );
}
