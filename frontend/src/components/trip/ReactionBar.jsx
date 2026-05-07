import { REACTIONS } from '../../lib/constants';
import { supabase } from '../../lib/supabase';

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
      {REACTIONS.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => send(r.id)}
          aria-label={r.description}
          title={r.description}
          className="flex h-10 w-10 items-center justify-center rounded-full text-xl transition hover:bg-slate-100 active:scale-95"
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
