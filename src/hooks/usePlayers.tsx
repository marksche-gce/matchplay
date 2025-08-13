import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Player {
  id: string;
  name: string;
  handicap: number;
  wins: number;
  losses: number;
  status: "active" | "eliminated" | "champion";
  created_at?: string;
  updated_at?: string;
  email?: string;
  phone?: string;
  emergency_contact?: string;
  user_id?: string;
}

interface UsePlayersOptions {
  tournamentId?: string;
}

export function usePlayers({ tournamentId }: UsePlayersOptions = {}) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchPlayers = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);

    try {
      if (tournamentId) {
        // Fetch players for a specific tournament using the simple view
        const { data, error } = await supabase
          .from('tournament_registrations')
          .select(`
            player_id,
            players_simple!inner (
              id,
              name,
              handicap,
              email,
              phone,
              emergency_contact,
              user_id,
              created_at,
              updated_at
            )
          `)
          .eq('tournament_id', tournamentId);

        if (error) throw error;

        const playersData: Player[] = (data || []).map((reg: any) => ({
          id: reg.players_simple.id,
          name: reg.players_simple.name,
          handicap: reg.players_simple.handicap,
          wins: 0,
          losses: 0,
          status: "active" as const,
          created_at: reg.players_simple.created_at,
          updated_at: reg.players_simple.updated_at,
          email: reg.players_simple.email,
          phone: reg.players_simple.phone,
          emergency_contact: reg.players_simple.emergency_contact,
          user_id: reg.players_simple.user_id
        }));

        setPlayers(playersData);
      } else {
        // Fetch all players using the simple view
        const { data, error } = await supabase
          .from('players_simple')
          .select('*');

        if (error) throw error;

        const playersData: Player[] = (data || []).map((player: any) => ({
          id: player.id,
          name: player.name,
          handicap: player.handicap,
          wins: 0,
          losses: 0,
          status: "active" as const,
          created_at: player.created_at,
          updated_at: player.updated_at,
          email: player.email,
          phone: player.phone,
          emergency_contact: player.emergency_contact,
          user_id: player.user_id
        }));

        setPlayers(playersData);
      }
    } catch (err: any) {
      console.error('Error fetching players:', err);
      setError(err.message || 'Failed to fetch players');
    } finally {
      setLoading(false);
    }
  };

  const addPlayer = async (playerData: {
    name: string;
    email: string;
    handicap: number;
    phone?: string;
    emergency_contact?: string;
  }) => {
    if (!user) throw new Error('User must be logged in');

    const { data, error } = await supabase
      .from('players')
      .insert([{
        ...playerData,
        user_id: user.id
      }])
      .select()
      .single();

    if (error) throw error;

    // Refresh the players list
    await fetchPlayers();
    return data;
  };

  useEffect(() => {
    fetchPlayers();
  }, [user, tournamentId]);

  return {
    players,
    loading,
    error,
    refetch: fetchPlayers,
    addPlayer
  };
}