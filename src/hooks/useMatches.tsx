import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface MatchPlayer {
  id: string;
  name: string;
  handicap: number;
  score?: number;
}

export interface MatchTeam {
  player1: MatchPlayer;
  player2: MatchPlayer;
  teamScore?: number;
}

export interface Match {
  id: string;
  tournament_id: string;
  type: "singles" | "foursome";
  player1?: MatchPlayer;
  player2?: MatchPlayer;
  team1?: MatchTeam;
  team2?: MatchTeam;
  round: string;
  status: "scheduled" | "in_progress" | "completed";
  match_date?: string;
  match_time?: string;
  tee?: number;
  winner_id?: string;
  next_match_id?: string;
  previous_match_1_id?: string;
  previous_match_2_id?: string;
  created_at?: string;
  updated_at?: string;
}

interface UseMatchesOptions {
  tournamentId: string;
}

export function useMatches({ tournamentId }: UseMatchesOptions) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchMatches = async () => {
    if (!user || !tournamentId) return;
    
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          match_participants (
            id,
            player_id,
            position,
            score,
            team_number,
            is_placeholder,
            placeholder_name,
            players (
              id,
              name,
              handicap
            )
          )
        `)
        .eq('tournament_id', tournamentId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const processedMatches: Match[] = (data || []).map((match: any) => {
        const participants = match.match_participants || [];
        
        // Sort participants by position to ensure consistent ordering
        participants.sort((a: any, b: any) => (a.position || 0) - (b.position || 0));

        if (match.type === 'singles') {
          const player1Data = participants.find((p: any) => p.position === 1);
          const player2Data = participants.find((p: any) => p.position === 2);

          return {
            id: match.id,
            tournament_id: match.tournament_id,
            type: match.type,
            round: match.round,
            status: match.status,
            match_date: match.match_date,
            match_time: match.match_time,
            tee: match.tee,
            winner_id: match.winner_id,
            next_match_id: match.next_match_id,
            previous_match_1_id: match.previous_match_1_id,
            previous_match_2_id: match.previous_match_2_id,
            created_at: match.created_at,
            updated_at: match.updated_at,
            player1: player1Data ? {
              id: player1Data.player_id || 'placeholder',
              name: player1Data.is_placeholder ? player1Data.placeholder_name : player1Data.players?.name || 'TBD',
              handicap: player1Data.players?.handicap || 0,
              score: player1Data.score
            } : undefined,
            player2: player2Data ? {
              id: player2Data.player_id || 'placeholder',
              name: player2Data.is_placeholder ? player2Data.placeholder_name : player2Data.players?.name || 'TBD',
              handicap: player2Data.players?.handicap || 0,
              score: player2Data.score
            } : undefined
          };
        } else {
          // Foursome match processing
          const team1Players = participants.filter((p: any) => p.team_number === 1);
          const team2Players = participants.filter((p: any) => p.team_number === 2);

          return {
            id: match.id,
            tournament_id: match.tournament_id,
            type: match.type,
            round: match.round,
            status: match.status,
            match_date: match.match_date,
            match_time: match.match_time,
            tee: match.tee,
            winner_id: match.winner_id,
            next_match_id: match.next_match_id,
            previous_match_1_id: match.previous_match_1_id,
            previous_match_2_id: match.previous_match_2_id,
            created_at: match.created_at,
            updated_at: match.updated_at,
            team1: team1Players.length >= 2 ? {
              player1: {
                id: team1Players[0]?.player_id || 'placeholder',
                name: team1Players[0]?.is_placeholder ? team1Players[0]?.placeholder_name : team1Players[0]?.players?.name || 'TBD',
                handicap: team1Players[0]?.players?.handicap || 0,
                score: team1Players[0]?.score
              },
              player2: {
                id: team1Players[1]?.player_id || 'placeholder',
                name: team1Players[1]?.is_placeholder ? team1Players[1]?.placeholder_name : team1Players[1]?.players?.name || 'TBD',
                handicap: team1Players[1]?.players?.handicap || 0,
                score: team1Players[1]?.score
              }
            } : undefined,
            team2: team2Players.length >= 2 ? {
              player1: {
                id: team2Players[0]?.player_id || 'placeholder',
                name: team2Players[0]?.is_placeholder ? team2Players[0]?.placeholder_name : team2Players[0]?.players?.name || 'TBD',
                handicap: team2Players[0]?.players?.handicap || 0,
                score: team2Players[0]?.score
              },
              player2: {
                id: team2Players[1]?.player_id || 'placeholder',
                name: team2Players[1]?.is_placeholder ? team2Players[1]?.placeholder_name : team2Players[1]?.players?.name || 'TBD',
                handicap: team2Players[1]?.players?.handicap || 0,
                score: team2Players[1]?.score
              }
            } : undefined
          };
        }
      });

      setMatches(processedMatches);
    } catch (err: any) {
      console.error('Error fetching matches:', err);
      setError(err.message || 'Failed to fetch matches');
    } finally {
      setLoading(false);
    }
  };

  const updateMatchResult = async (matchId: string, winnerId: string) => {
    try {
      // Update the match with the winner
      const { error: matchError } = await supabase
        .from('matches')
        .update({ 
          winner_id: winnerId,
          status: 'completed'
        })
        .eq('id', matchId);

      if (matchError) throw matchError;

      // Find the current match to get next match info
      const currentMatch = matches.find(m => m.id === matchId);
      if (!currentMatch) throw new Error('Match not found');

      // If there's a next match, advance the winner
      if (currentMatch.next_match_id) {
        await advanceWinnerToNextMatch(currentMatch.next_match_id, winnerId, matchId);
      }

      // Refresh matches to show updated data immediately
      await fetchMatches();

      toast({
        title: "Success",
        description: "Match result updated and winner advanced to next round."
      });

    } catch (err: any) {
      console.error('Error updating match result:', err);
      toast({
        title: "Error",
        description: err.message || "Failed to update match result",
        variant: "destructive"
      });
    }
  };

  const advanceWinnerToNextMatch = async (nextMatchId: string, winnerId: string, sourceMatchId: string) => {
    try {
      // Get the next match to determine which position to fill
      const { data: nextMatch, error: nextMatchError } = await supabase
        .from('matches')
        .select('*, match_participants(*)')
        .eq('id', nextMatchId)
        .single();

      if (nextMatchError) throw nextMatchError;

      // Determine which position in the next match to fill based on source match
      let position = 1;
      if (nextMatch.previous_match_1_id === sourceMatchId) {
        position = 1;
      } else if (nextMatch.previous_match_2_id === sourceMatchId) {
        position = 2;
      }

      // Check if there's already a participant in this position
      const existingParticipant = nextMatch.match_participants?.find((p: any) => p.position === position);

      if (existingParticipant) {
        // Update existing participant
        const { error: updateError } = await supabase
          .from('match_participants')
          .update({
            player_id: winnerId,
            is_placeholder: false,
            placeholder_name: null
          })
          .eq('id', existingParticipant.id);

        if (updateError) throw updateError;
      } else {
        // Create new participant
        const { error: insertError } = await supabase
          .from('match_participants')
          .insert({
            match_id: nextMatchId,
            player_id: winnerId,
            position: position,
            team_number: nextMatch.type === 'foursome' ? (position <= 2 ? 1 : 2) : null,
            is_placeholder: false
          });

        if (insertError) throw insertError;
      }

    } catch (err: any) {
      console.error('Error advancing winner:', err);
      throw err;
    }
  };

  const createMatch = async (matchData: Omit<Match, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .insert({
          tournament_id: matchData.tournament_id,
          type: matchData.type,
          round: matchData.round,
          status: matchData.status || 'scheduled',
          match_date: matchData.match_date,
          match_time: matchData.match_time,
          tee: matchData.tee,
          next_match_id: matchData.next_match_id,
          previous_match_1_id: matchData.previous_match_1_id,
          previous_match_2_id: matchData.previous_match_2_id
        })
        .select()
        .single();

      if (matchError) throw matchError;

      // Create participants based on match type
      const participants = [];

      if (matchData.type === 'singles') {
        if (matchData.player1) {
          participants.push({
            match_id: match.id,
            player_id: matchData.player1.id !== 'placeholder' ? matchData.player1.id : null,
            position: 1,
            is_placeholder: matchData.player1.id === 'placeholder',
            placeholder_name: matchData.player1.id === 'placeholder' ? matchData.player1.name : null
          });
        }
        if (matchData.player2) {
          participants.push({
            match_id: match.id,
            player_id: matchData.player2.id !== 'placeholder' ? matchData.player2.id : null,
            position: 2,
            is_placeholder: matchData.player2.id === 'placeholder',
            placeholder_name: matchData.player2.id === 'placeholder' ? matchData.player2.name : null
          });
        }
      } else if (matchData.type === 'foursome') {
        if (matchData.team1) {
          participants.push(
            {
              match_id: match.id,
              player_id: matchData.team1.player1.id !== 'placeholder' ? matchData.team1.player1.id : null,
              position: 1,
              team_number: 1,
              is_placeholder: matchData.team1.player1.id === 'placeholder',
              placeholder_name: matchData.team1.player1.id === 'placeholder' ? matchData.team1.player1.name : null
            },
            {
              match_id: match.id,
              player_id: matchData.team1.player2.id !== 'placeholder' ? matchData.team1.player2.id : null,
              position: 2,
              team_number: 1,
              is_placeholder: matchData.team1.player2.id === 'placeholder',
              placeholder_name: matchData.team1.player2.id === 'placeholder' ? matchData.team1.player2.name : null
            }
          );
        }
        if (matchData.team2) {
          participants.push(
            {
              match_id: match.id,
              player_id: matchData.team2.player1.id !== 'placeholder' ? matchData.team2.player1.id : null,
              position: 3,
              team_number: 2,
              is_placeholder: matchData.team2.player1.id === 'placeholder',
              placeholder_name: matchData.team2.player1.id === 'placeholder' ? matchData.team2.player1.name : null
            },
            {
              match_id: match.id,
              player_id: matchData.team2.player2.id !== 'placeholder' ? matchData.team2.player2.id : null,
              position: 4,
              team_number: 2,
              is_placeholder: matchData.team2.player2.id === 'placeholder',
              placeholder_name: matchData.team2.player2.id === 'placeholder' ? matchData.team2.player2.name : null
            }
          );
        }
      }

      if (participants.length > 0) {
        const { error: participantsError } = await supabase
          .from('match_participants')
          .insert(participants);

        if (participantsError) throw participantsError;
      }

      await fetchMatches();
      return match;

    } catch (err: any) {
      console.error('Error creating match:', err);
      throw err;
    }
  };

  // Set up realtime subscription for matches
  useEffect(() => {
    if (!tournamentId) return;

    const channel = supabase
      .channel('match-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `tournament_id=eq.${tournamentId}`
        },
        () => {
          fetchMatches();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_participants'
        },
        () => {
          fetchMatches();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  useEffect(() => {
    fetchMatches();
  }, [user, tournamentId]);

  return {
    matches,
    loading,
    error,
    refetch: fetchMatches,
    updateMatchResult,
    createMatch
  };
}