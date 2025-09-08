import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BracketView } from '@/components/tournament/BracketView';
import { EmbedRegistrationForm } from '@/components/tournament/EmbedRegistrationForm';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Users, Trophy, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { getRoundDisplayName, calculateTotalRounds } from '@/lib/tournamentUtils';

interface Tournament {
  id: string;
  name: string;
  type: 'singles' | 'foursome';
  max_players: number;
  start_date: string;
  end_date: string;
  registration_status: 'open' | 'closed' | 'full';
  max_rounds: number;
}


export default function TournamentEmbed() {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [registrationCount, setRegistrationCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [nextDeadline, setNextDeadline] = useState<{round: number, date: string} | null>(null);
  const [roundDeadlines, setRoundDeadlines] = useState<Array<{round_number: number; closing_date: string}>>([]);

  useEffect(() => {
    if (id) {
      fetchTournament();
      fetchRegistrationCount();
      fetchNextDeadline();
    }
  }, [id]);

  const fetchTournament = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-embed-tournament', {
        body: { tournamentId: id },
      });

      if (error) throw error;
      setTournament(data?.tournament || null);
    } catch (error) {
      console.error('Error fetching tournament:', error);
      setTournament(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchRegistrationCount = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-embed-bracket', {
        body: { tournamentId: id },
      });

      if (error) throw error;
      setRegistrationCount((data as any)?.registrationCount || 0);
    } catch (error) {
      console.error('Error fetching registration count:', error);
    }
  };

  const fetchNextDeadline = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-embed-bracket', {
        body: { tournamentId: id },
      });

      if (error) throw error;
      
      let deadlines = (data as any)?.roundDeadlines || [];
      console.log('TournamentEmbed - Round deadlines received:', deadlines);

      // Fallback: fetch directly if edge function returned no deadlines
      if ((!deadlines || deadlines.length === 0) && id) {
        const { data: fallbackDeadlines, error: fallbackError } = await supabase
          .from('round_deadlines')
          .select('*')
          .eq('tournament_id', id)
          .order('round_number');
        if (!fallbackError && fallbackDeadlines) {
          console.log('TournamentEmbed - Fallback deadlines received:', fallbackDeadlines);
          deadlines = fallbackDeadlines as any;
        } else if (fallbackError) {
          console.warn('TournamentEmbed - Fallback deadlines error:', fallbackError);
        }
      }

      setRoundDeadlines(deadlines);
      const now = new Date();
      
      // Find next upcoming deadline
      const upcomingDeadlines = deadlines
        .filter((d: any) => new Date(d.closing_date) > now)
        .sort((a: any, b: any) => new Date(a.closing_date).getTime() - new Date(b.closing_date).getTime());
      
      if (upcomingDeadlines.length > 0) {
        const next = upcomingDeadlines[0];
        setNextDeadline({ round: next.round_number, date: next.closing_date });
      } else {
        setNextDeadline(null);
      }
    } catch (error) {
      console.error('Error fetching next deadline:', error);
    }
  };

  const getRegistrationStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-success/10 text-success border-success/30';
      case 'closed': return 'bg-destructive/10 text-destructive border-destructive/30';
      case 'full': return 'bg-warning/10 text-warning border-warning/30';
      default: return 'bg-secondary/10 text-secondary-foreground border-secondary/30';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-7xl mx-auto space-y-4">
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
      {/* Tournament Header */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/20 border-b">
        <div className="max-w-full mx-auto p-3 md:p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h1 className="text-lg md:text-2xl font-bold text-foreground">{tournament.name}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3 md:gap-4 text-xs md:text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3 md:h-4 md:w-4" />
                <span className="whitespace-nowrap">{format(new Date(tournament.start_date), 'dd. MMM', { locale: de })} - {format(new Date(tournament.end_date), 'dd. MMM yyyy', { locale: de })}</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3 md:h-4 md:w-4" />
                <span>{registrationCount}/{tournament.max_players} Spieler</span>
              </div>
              <div className="flex items-center gap-1">
                <Trophy className="h-3 w-3 md:h-4 md:w-4" />
                <span>{tournament.type === 'singles' ? 'Einzel' : 'Vierer'}</span>
              </div>
              <Button asChild variant="outline" size="sm" className="touch-manipulation min-h-[44px] md:min-h-auto">
                <a 
                  href={`/embed/${id}/participants`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1"
                >
                  <Users className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                  <span className="whitespace-nowrap">Teilnehmerliste</span>
                </a>
              </Button>
              <Badge className={`${getRegistrationStatusColor(tournament.registration_status)} text-xs`}>
                 {tournament.registration_status === 'open' ? 'Anmeldung offen' : 
                  tournament.registration_status === 'closed' ? 'Anmeldung geschlossen' : 
                  'Turnier voll'}
              </Badge>
            </div>
          </div>
        </div>
      </div>


      {/* Tournament Bracket */}
      <div className="max-w-full mx-auto p-2 md:p-4">
        <div className="bg-card rounded-lg border shadow-sm p-2 md:p-4">
          {tournament && (
            tournament.registration_status === 'open' ? (
              <EmbedRegistrationForm 
                tournament={tournament}
                registrationCount={registrationCount}
                onRegistrationComplete={fetchRegistrationCount}
              />
            ) : (
              <BracketView 
                tournamentId={tournament.id} 
                tournament={tournament}
                embedded={true}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}