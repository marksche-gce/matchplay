import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, ArrowLeft } from 'lucide-react';
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
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments_new')
        .select('id, name, type, max_players, registration_status')
        .eq('id', id)
        .single();

      if (tournamentError) {
        console.error('Error fetching tournament:', tournamentError);
        return;
      }

      setTournament(tournamentData);

      // Fetch participants based on tournament type
      if (tournamentData.type === 'singles') {
        const { data: participantsData, error: participantsError } = await supabase
          .from('tournament_registrations_new')
          .select(`
            id,
            registered_at,
            player_id,
            players_new (
              id,
              name,
              email,
              handicap
            )
          `)
          .eq('tournament_id', id)
          .order('registered_at');

        if (participantsError) {
          console.error('Error fetching participants:', participantsError);
        } else {
          const formattedParticipants = participantsData.map((reg: any) => ({
            id: reg.player_id,
            name: reg.players_new?.name || 'Unknown Player',
            email: reg.players_new?.email,
            handicap: reg.players_new?.handicap,
            registered_at: reg.registered_at
          }));
          setParticipants(formattedParticipants);
        }
      } else {
        // For foursome tournaments, fetch teams and their players
        const { data: teamsData, error: teamsError } = await supabase
          .from('tournament_registrations_new')
          .select(`
            id,
            registered_at,
            team_id,
            teams (
              id,
              name,
              player1_id,
              player2_id,
              player1:players_new!teams_player1_id_fkey (
                id,
                name,
                email,
                handicap
              ),
              player2:players_new!teams_player2_id_fkey (
                id,
                name,
                email,
                handicap
              )
            )
          `)
          .eq('tournament_id', id)
          .order('registered_at');

        if (teamsError) {
          console.error('Error fetching teams:', teamsError);
        } else {
          const formattedTeams = teamsData.map((reg: any) => ({
            id: reg.team_id,
            name: reg.teams?.name || 'Unknown Team',
            player1: reg.teams?.player1,
            player2: reg.teams?.player2,
            registered_at: reg.registered_at
          }));
          setParticipants(formattedTeams as any);
        }
      }
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
                <span>{participants.length}/{tournament.max_players} {tournament.type === 'singles' ? 'Spieler' : 'Teams'}</span>
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
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {tournament.type === 'singles' ? 'Teilnehmerliste' : 'Teamliste'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {participants.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Noch keine {tournament.type === 'singles' ? 'Spieler' : 'Teams'} registriert</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tournament.type === 'singles' ? (
                  participants.map((participant, index) => (
                    <div key={participant.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground">{participant.name}</h3>
                          {participant.email && (
                            <p className="text-sm text-muted-foreground">{participant.email}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {participant.handicap !== null && participant.handicap !== undefined && (
                          <div className="text-sm text-muted-foreground">
                            HCP: {participant.handicap}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {new Date(participant.registered_at).toLocaleDateString('de-DE')}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  participants.map((team: any, index) => (
                    <div key={team.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-4 mb-2">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <h3 className="font-medium text-foreground">{team.name}</h3>
                      </div>
                      <div className="ml-12 space-y-2">
                        {team.player1 && (
                          <div className="flex justify-between items-center text-sm">
                            <span>{team.player1.name}</span>
                            {team.player1.handicap !== null && (
                              <span className="text-muted-foreground">HCP: {team.player1.handicap}</span>
                            )}
                          </div>
                        )}
                        {team.player2 && (
                          <div className="flex justify-between items-center text-sm">
                            <span>{team.player2.name}</span>
                            {team.player2.handicap !== null && (
                              <span className="text-muted-foreground">HCP: {team.player2.handicap}</span>
                            )}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          Angemeldet: {new Date(team.registered_at).toLocaleDateString('de-DE')}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}