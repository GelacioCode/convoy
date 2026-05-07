import {
  FaThumbsUp,
  FaHand,
  FaCircleStop,
  FaBullhorn,
} from 'react-icons/fa6';
import { REACTIONS } from '../../lib/constants';
import { supabase } from '../../lib/supabase';

const ICON_BY_REACTION = {
  thumbsup: FaThumbsUp,
  wait: FaHand,
  pullover: FaCircleStop,
  horn: FaBullhorn,
};

const COLOR_BY_REACTION = {
  thumbsup: 'text-emerald-600',
  wait: 'text-amber-600',
  pullover: 'text-red-600',
  horn: 'text-blue-600',
};

export default function ReactionBar({ tripId, participantId }) {
  const send = async (reactionType) => {
    if (!tripId || !participantId) return;
    const { error } = await supabase.from('reactions').insert({
      trip_id: tripId,
      participant_id: participantId,
      reaction_type: reactionType,
    });
    if (error) console.warn('[convoy] reaction failed', error);
  };

  return (
    <div className="flex gap-1 rounded-full bg-white p-1.5 shadow-lg ring-1 ring-slate-200">
      {REACTIONS.map((r) => {
        const Icon = ICON_BY_REACTION[r.id];
        const color = COLOR_BY_REACTION[r.id] ?? 'text-slate-700';
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => send(r.id)}
            aria-label={r.description}
            title={r.description}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-slate-100 active:scale-95 ${color}`}
          >
            {Icon && <Icon className="h-5 w-5" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}
