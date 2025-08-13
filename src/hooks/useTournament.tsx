import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Tournament {
  id: string;
  name: string;
  course: string;
  description?: string;
  start_date: string;
  end_date: string;
  max_players: number;
  format: "matchplay" | "strokeplay" | "scramble";
  status: "upcoming" | "active" | "completed";
  registration_open: boolean;
  entry_fee?: number;
  created_at?: string;
  updated_at?: string;
}

export function useTournament(tournamentId?: string) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [currentTournament, setCurrentTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchTournaments = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const tournamentData: Tournament[] = (data || []).map(t => ({
        id: t.id,
        name: t.name,
        course: t.course,
        description: t.description,
        start_date: t.start_date,
        end_date: t.end_date,
        max_players: t.max_players,
        format: t.format as "matchplay" | "strokeplay" | "scramble",
        status: t.status as "upcoming" | "active" | "completed",
        registration_open: t.registration_open,
        entry_fee: t.entry_fee,
        created_at: t.created_at,
        updated_at: t.updated_at
      }));

      setTournaments(tournamentData);

      // Set current tournament if specified
      if (tournamentId) {
        const tournament = tournamentData.find(t => t.id === tournamentId);
        setCurrentTournament(tournament || null);
      } else if (tournamentData.length > 0 && !currentTournament) {
        setCurrentTournament(tournamentData[0]);
      }

    } catch (err: any) {
      console.error('Error fetching tournaments:', err);
      setError(err.message || 'Failed to fetch tournaments');
    } finally {
      setLoading(false);
    }
  };

  const createTournament = async (tournamentData: Omit<Tournament, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .insert([tournamentData])
        .select()
        .single();

      if (error) throw error;

      await fetchTournaments();
      return data;

    } catch (err: any) {
      console.error('Error creating tournament:', err);
      throw err;
    }
  };

  const updateTournament = async (id: string, updates: Partial<Tournament>) => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await fetchTournaments();
      return data;

    } catch (err: any) {
      console.error('Error updating tournament:', err);
      throw err;
    }
  };

  const deleteTournament = async (id: string) => {
    try {
      const { error } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchTournaments();

    } catch (err: any) {
      console.error('Error deleting tournament:', err);
      throw err;
    }
  };

  // Set up realtime subscription for tournaments
  useEffect(() => {
    const channel = supabase
      .channel('tournament-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournaments'
        },
        () => {
          fetchTournaments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    fetchTournaments();
  }, [user, tournamentId]);

  return {
    tournaments,
    currentTournament,
    loading,
    error,
    refetch: fetchTournaments,
    createTournament,
    updateTournament,
    deleteTournament,
    setCurrentTournament
  };
}