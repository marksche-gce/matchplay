import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Mail, Trophy, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Tournament {
  id: string;
  name: string;
  type: 'singles' | 'foursome';
  max_players: number;
}

interface Player {
  id: string;
  name: string;
  email: string;
  handicap: number;
}

interface Team {
  id: string;
  name: string;
  player1?: Player;
  player2?: Player;
}

interface Registration {
  id: string;
  player?: Player;
  team?: Team;
}

export default function TournamentParticipants() {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchTournamentData();
    }
  }, [id]);

  const fetchTournamentData = async () => {
    try {
      // Fetch tournament details
      const { data: tournamentData, error: tournamentError } = await supabase.functions.invoke('get-embed-tournament', {
        body: { tournamentId: id },
      });

      if (tournamentError) throw tournamentError;
      setTournament(tournamentData?.tournament || null);

      // Fetch registrations with player/team details
      const { data: registrationsData, error: registrationsError } = await supabase
        .from('tournament_registrations_new')
        .select(`
          id,
          player_id,
          team_id
        `)
        .eq('tournament_id', id);

      if (registrationsError) throw registrationsError;

      // Fetch player and team details
      const registrationsWithDetails: Registration[] = [];

      for (const registration of registrationsData || []) {
        if (registration.player_id) {
          // Fetch player details
          const { data: playerData } = await supabase
            .from('players_new')
            .select('id, name, email, handicap')
            .eq('id', registration.player_id)
            .single();

          if (playerData) {
            registrationsWithDetails.push({
              id: registration.id,
              player: playerData
            });
          }
        } else if (registration.team_id) {
          // Fetch team details
          const { data: teamData } = await supabase
            .from('teams')
            .select(`
              id,
              name,
              player1_id,
              player2_id
            `)
            .eq('id', registration.team_id)
            .single();

          if (teamData) {
            const team: Team = {
              id: teamData.id,
              name: teamData.name
            };

            // Fetch player1 details
            if (teamData.player1_id) {
              const { data: player1Data } = await supabase
                .from('players_new')
                .select('id, name, email, handicap')
                .eq('id', teamData.player1_id)
                .single();
              if (player1Data) team.player1 = player1Data;
            }

            // Fetch player2 details
            if (teamData.player2_id) {
              const { data: player2Data } = await supabase
                .from('players_new')
                .select('id, name, email, handicap')
                .eq('id', teamData.player2_id)
                .single();
              if (player2Data) team.player2 = player2Data;
            }

            registrationsWithDetails.push({
              id: registration.id,
              team
            });
          }
        }
      }

      setRegistrations(registrationsWithDetails);
    } catch (error) {
      console.error('Error fetching tournament data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="h-32 bg-muted animate-pulse rounded-lg"></div>
          <div className="h-96 bg-muted animate-pulse rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Turnier nicht gefunden</h1>
          <p className="text-muted-foreground">Das angeforderte Turnier konnte nicht gefunden werden.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/20 border-b">
        <div className="max-w-4xl mx-auto p-4">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.history.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Zurück
            </Button>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">{tournament.name} - Teilnehmerliste</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{registrations.length}/{tournament.max_players} Teilnehmer</span>
              </div>
              <div className="flex items-center gap-1">
                <Trophy className="h-4 w-4" />
                <span>{tournament.type === 'singles' ? 'Einzel' : 'Vierer'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Participants List */}
      <div className="max-w-4xl mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle>Angemeldete Teilnehmer</CardTitle>
          </CardHeader>
          <CardContent>
            {registrations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Noch keine Anmeldungen vorhanden
              </div>
            ) : (
              <div className="space-y-4">
                {registrations.map((registration) => (
                  <div key={registration.id} className="border rounded-lg p-4">
                    {registration.player && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">{registration.player.name}</h3>
                          <Badge variant="outline">Einzelspieler</Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span>{registration.player.email || 'Keine E-Mail'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-muted-foreground" />
                            <span>Handicap: {registration.player.handicap}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {registration.team && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">{registration.team.name}</h3>
                          <Badge variant="outline">Team</Badge>
                        </div>
                        
                        <div className="space-y-3">
                          {registration.team.player1 && (
                            <div className="bg-muted/50 rounded-lg p-3">
                              <h4 className="font-medium mb-2">Spieler 1: {registration.team.player1.name}</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                <div className="flex items-center gap-2">
                                  <Mail className="h-4 w-4 text-muted-foreground" />
                                  <span>{registration.team.player1.email || 'Keine E-Mail'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Trophy className="h-4 w-4 text-muted-foreground" />
                                  <span>Handicap: {registration.team.player1.handicap}</span>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {registration.team.player2 && (
                            <div className="bg-muted/50 rounded-lg p-3">
                              <h4 className="font-medium mb-2">Spieler 2: {registration.team.player2.name}</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                <div className="flex items-center gap-2">
                                  <Mail className="h-4 w-4 text-muted-foreground" />
                                  <span>{registration.team.player2.email || 'Keine E-Mail'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Trophy className="h-4 w-4 text-muted-foreground" />
                                  <span>Handicap: {registration.team.player2.handicap}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}