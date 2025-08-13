import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Player, PlayerSecureView } from '@/types/player';

interface UseSecurePlayersOptions {
  tournamentId?: string;
  useFullAccess?: boolean; // For organizers who need full data
}

export function useSecurePlayers({ tournamentId, useFullAccess = false }: UseSecurePlayersOptions = {}) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchPlayers = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);

    try {
      if (useFullAccess) {
        // For organizers/admins - use direct table access
        let query = supabase
          .from('tournament_registrations')
          .select(`
            player_id,
            players!inner (
              id,
              name,
              email,
              handicap,
              phone,
              emergency_contact,
              user_id,
              created_at,
              updated_at
            )
          `);

        if (tournamentId) {
          query = query.eq('tournament_id', tournamentId);
        }

        const { data, error } = await query;
        if (error) throw error;

        const playersData: Player[] = (data || []).map((reg: any) => ({
          id: reg.players.id,
          name: reg.players.name,
          email: reg.players.email,
          handicap: reg.players.handicap,
          phone: reg.players.phone,
          emergency_contact: reg.players.emergency_contact,
          user_id: reg.players.user_id,
          wins: 0,
          losses: 0,
          status: "active" as const,
          created_at: reg.players.created_at,
          updated_at: reg.players.updated_at
        }));

        setPlayers(playersData);
      } else {
        // For regular users - use secure view
        let query = supabase
          .from('tournament_registrations')
          .select(`
            player_id,
            players_secure!inner (
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
          `);

        if (tournamentId) {
          query = query.eq('tournament_id', tournamentId);
        }

        const { data, error } = await query;
        if (error) throw error;

        const playersData: Player[] = (data || []).map((reg: any) => {
          const securePlayer = reg.players_secure;
          const player: Player = {
            id: securePlayer.id,
            name: securePlayer.name,
            handicap: securePlayer.handicap,
            wins: 0,
            losses: 0,
            status: "active" as const,
            created_at: securePlayer.created_at,
            updated_at: securePlayer.updated_at
          };

          // Only include contact info if accessible
          if (securePlayer.email) {
            (player as any).email = securePlayer.email;
            (player as any).phone = securePlayer.phone;
            (player as any).emergency_contact = securePlayer.emergency_contact;
            (player as any).user_id = securePlayer.user_id;
          }

          return player;
        });

        setPlayers(playersData);
      }
    } catch (err: any) {
      console.error('Error fetching players:', err);
      setError(err.message || 'Failed to fetch players');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, [user, tournamentId, useFullAccess]);

  return {
    players,
    loading,
    error,
    refetch: fetchPlayers
  };
}