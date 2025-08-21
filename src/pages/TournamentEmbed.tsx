import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { BracketView } from '@/components/tournament/BracketView';
import { EmbedRegistrationForm } from '@/components/tournament/EmbedRegistrationForm';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Users, Trophy, Clock } from 'lucide-react';
import { format } from 'date-fns';
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

// Create a public supabase client for embedded views
const supabase = createClient(
  "https://kdnbpbbwlcxfbiakegnf.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkbmJwYmJ3bGN4ZmJpYWtlZ25mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0MDA3ODIsImV4cCI6MjA2Nzk3Njc4Mn0.tzjFdV0FieoaDqybeyoFtl_yOMibQhYUv7m7x-jr1mY"
);

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
      
      const deadlines = (data as any)?.roundDeadlines || [];
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
            <h1 className="text-lg md:text-2xl font-bold text-foreground">{tournament.name}</h1>
            <div className="flex flex-wrap items-center gap-3 md:gap-4 text-xs md:text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3 md:h-4 md:w-4" />
                <span className="whitespace-nowrap">{format(new Date(tournament.start_date), 'MMM dd')} - {format(new Date(tournament.end_date), 'MMM dd, yyyy')}</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3 md:h-4 md:w-4" />
                <span>{registrationCount}/{tournament.max_players} Spieler</span>
              </div>
              <div className="flex items-center gap-1">
                <Trophy className="h-3 w-3 md:h-4 md:w-4" />
                <span>{tournament.type === 'singles' ? 'Einzel' : 'Vierer'}</span>
              </div>
              <Badge className={`${getRegistrationStatusColor(tournament.registration_status)} text-xs`}>
                 {tournament.registration_status === 'open' ? 'Anmeldung offen' : 
                  tournament.registration_status === 'closed' ? 'Anmeldung geschlossen' : 
                  'Turnier voll'}
              </Badge>
              {nextDeadline && (
                <div className="flex items-center gap-1 bg-warning/10 text-warning px-2 py-1 rounded text-xs border border-warning/30">
                  <Clock className="h-3 w-3" />
                  <span className="whitespace-nowrap">
                    {getRoundDisplayName(nextDeadline.round, calculateTotalRounds(tournament.max_players))} Deadline: {format(new Date(nextDeadline.date), 'dd.MM.yyyy')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Runden-Deadlines */}
      {roundDeadlines.length > 0 && (
        <div className="max-w-full mx-auto p-2 md:p-4">
          <div className="bg-card rounded-lg border shadow-sm p-2 md:p-4">
            <div className="flex flex-wrap gap-2">
              {roundDeadlines.map((d) => (
                <Badge key={d.round_number} variant="outline" className="text-xs">
                  {getRoundDisplayName(d.round_number, calculateTotalRounds(tournament.max_players))}: {format(new Date(d.closing_date), 'dd.MM.yyyy')}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}

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