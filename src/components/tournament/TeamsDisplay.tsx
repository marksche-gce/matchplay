import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Mail, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Team {
  id: string;
  name: string;
  player1: {
    id: string;
    name: string;
    email: string;
    handicap: number;
  };
  player2: {
    id: string;
    name: string;
    email: string;
    handicap: number;
  };
}

interface TeamsDisplayProps {
  tournamentId: string;
  refreshTrigger?: number;
}

export function TeamsDisplay({ tournamentId, refreshTrigger }: TeamsDisplayProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTeams = async () => {
    try {
      const { data: teamsData, error } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          player1:player1_id(id, name, email, handicap),
          player2:player2_id(id, name, email, handicap)
        `)
        .eq('tournament_id', tournamentId);

      if (error) throw error;

      const formattedTeams = teamsData?.map(team => ({
        id: team.id,
        name: team.name,
        player1: team.player1 as any,
        player2: team.player2 as any,
      })) || [];

      setTeams(formattedTeams);
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, [tournamentId, refreshTrigger]);

  if (loading) {
    return <div className="text-center py-8">Lade Teams...</div>;
  }

  if (teams.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Noch keine Teams registriert</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Registrierte Teams ({teams.length})</h3>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => (
          <Card key={team.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                {team.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Player 1 */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">Spieler 1</span>
                  <Badge variant="secondary" className="text-xs">
                    HCP: {team.player1.handicap}
                  </Badge>
                </div>
                <p className="font-medium">{team.player1.name}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{team.player1.email}</span>
                </div>
              </div>

              {/* Player 2 */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">Spieler 2</span>
                  <Badge variant="secondary" className="text-xs">
                    HCP: {team.player2.handicap}
                  </Badge>
                </div>
                <p className="font-medium">{team.player2.name}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{team.player2.email}</span>
                </div>
              </div>

              {/* Team Stats */}
              <div className="pt-2 border-t">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Durchschnitts-HCP:</span>
                  <span className="font-medium">
                    {((team.player1.handicap + team.player2.handicap) / 2).toFixed(1)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}