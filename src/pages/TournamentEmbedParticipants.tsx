import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, ArrowLeft, Mail, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Tournament {
  id: string;
  name: string;
  type: 'singles' | 'foursome';
  max_players: number;
  registration_status: 'open' | 'closed' | 'full';
}

interface Participant {
  id: string;
  name: string;
  email?: string;
  handicap?: number;
  registered_at: string;
}

export default function TournamentEmbedParticipants() {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchTournamentAndParticipants();
    }
  }, [id]);

  const fetchTournamentAndParticipants = async () => {
    try {
      // Fetch tournament info
      const { data, error } = await supabase.functions.invoke('get-embed-tournament', {
        body: { tournamentId: id },
      });

      if (error) {
        console.error('Error fetching tournament (edge):', error);
        setTournament(null);
        return;
      }

      const tournamentData = (data as any)?.tournament || null;
      if (!tournamentData) {
        console.warn('No tournament returned from edge function');
        setTournament(null);
        return;
      }

      setTournament(tournamentData);

      // Fetch participants ordered by position (manual ordering) first, then by registration time
      const { data: registrationsData, error: registrationsError } = await supabase
        .from('tournament_registrations_new')
        .select(`
          id,
          registered_at,
          player_id,
          team_id,
          position
        `)
        .eq('tournament_id', id)
        .order('position', { nullsFirst: false })
        .order('registered_at');

      if (registrationsError) {
        console.error('Error fetching registrations:', registrationsError);
        setParticipants([]);
        return;
      }

      const participantsWithDetails: any[] = [];
      
      for (const registration of registrationsData || []) {
        if (tournamentData.type === 'singles' && registration.player_id) {
          // Fetch player details
          const { data: playerData } = await supabase
            .from('players_new')
            .select('id, name, email, handicap')
            .eq('id', registration.player_id)
            .single();

          if (playerData) {
            participantsWithDetails.push({
              id: registration.id,
              player: playerData,
              registered_at: registration.registered_at,
              position: registration.position
            });
          }
        } else if (tournamentData.type === 'foursome' && registration.team_id) {
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
            const team: any = {
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

            participantsWithDetails.push({
              id: registration.id,
              team,
              registered_at: registration.registered_at,
              position: registration.position
            });
          }
        }
      }
      
      setParticipants(participantsWithDetails);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="h-20 bg-muted animate-pulse rounded-lg"></div>
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

  const getRegistrationStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-success/10 text-success border-success/30';
      case 'closed': return 'bg-destructive/10 text-destructive border-destructive/30';
      case 'full': return 'bg-warning/10 text-warning border-warning/30';
      default: return 'bg-secondary/10 text-secondary-foreground border-secondary/30';
    }
  };

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
            <h1 className="text-xl md:text-2xl font-bold text-foreground">{tournament.name}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{participants.length}/{tournament.max_players} Teilnehmer</span>
            </div>
              <Badge className={`${getRegistrationStatusColor(tournament.registration_status)} text-xs`}>
                {tournament.registration_status === 'open' ? 'Anmeldung offen' : 
                 tournament.registration_status === 'closed' ? 'Anmeldung geschlossen' : 
                 'Turnier voll'}
              </Badge>
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
            {participants.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Noch keine Anmeldungen vorhanden
              </div>
            ) : (
              <div className="space-y-4">
                {participants.map((registration: any) => (
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