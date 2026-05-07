import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useTripStore } from '../store/tripStore';

export function useTripRealtime(tripId) {
  const updateParticipantPosition = useTripStore((s) => s.updateParticipantPosition);
  const upsertParticipant = useTripStore((s) => s.upsertParticipant);

  useEffect(() => {
    if (!tripId) return undefined;

    const channel = supabase
      .channel(`trip:${tripId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'position_updates',
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          const row = payload.new;
          if (!row?.participant_id) return;
          updateParticipantPosition(row.participant_id, {
            lat: row.lat,
            lng: row.lng,
            heading: row.heading,
            speed_kmh: row.speed_kmh,
            updated_at: row.updated_at,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'participants',
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          if (payload.new) upsertParticipant(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reactions',
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          const r = payload.new;
          if (!r) return;
          const state = useTripStore.getState();
          const participant = state.participants.find(
            (p) => p.id === r.participant_id
          );
          state.pushToast({
            type: 'reaction',
            participantName: participant?.display_name ?? 'Someone',
            color: participant?.color ?? '#3B82F6',
            reactionType: r.reaction_type,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId, updateParticipantPosition, upsertParticipant]);
}
