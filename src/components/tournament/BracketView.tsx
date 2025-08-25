import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Settings, Play, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BracketGenerator } from '@/lib/bracketGenerator';
import { getRoundDisplayName, calculateTotalRounds } from '@/lib/tournamentUtils';
import { MatchCard } from './MatchCard';
import { format } from 'date-fns';

interface Tournament {
  id: string;
  type: 'singles' | 'foursome';
  max_players: number;
  max_rounds: number;
}

interface Match {
  id: string;
  tournament_id: string;
  round_number: number;
  match_number: number;
  status: 'pending' | 'scheduled' | 'completed';
  player1_id?: string;
  player2_id?: string;
  team1_id?: string;
  team2_id?: string;
  winner_player_id?: string;
  winner_team_id?: string;
  feeds_to_match_id?: string;
  feeds_to_position?: number;
}

interface BracketViewProps {
  tournamentId: string;
  tournament: Tournament;
  embedded?: boolean;
}

export function BracketView({ tournamentId, tournament, embedded = false }: BracketViewProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [registrationCount, setRegistrationCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [bracketGenerated, setBracketGenerated] = useState(false);
  const [roundDeadlines, setRoundDeadlines] = useState<{[key: number]: string}>({});

  useEffect(() => {
    fetchMatches();
    fetchRegistrationCount();
    fetchRoundDeadlines();
  }, [tournamentId, tournament.max_players, tournament.max_rounds]);

  const fetchMatches = async () => {
    try {
      if (embedded) {
        const { data, error } = await supabase.functions.invoke('get-embed-bracket', {
          body: { tournamentId },
        });
        if (error) throw error;
        setMatches((data as any)?.matches || []);
        setBracketGenerated(((data as any)?.matches || []).length > 0);
        
        // Set round deadlines for embedded view
        const deadlines = (data as any)?.roundDeadlines || [];
        console.log('BracketView Embed deadlines received:', deadlines); // Debug log
        let deadlineMap: {[key: number]: string} = {};
        deadlines.forEach((deadline: any) => {
          deadlineMap[deadline.round_number] = deadline.closing_date;
        });

        // Fallback: fetch directly if edge function returned no deadlines
        if (Object.keys(deadlineMap).length === 0) {
          const { data: fallbackDeadlines, error: fallbackError } = await supabase
            .from('round_deadlines')
            .select('*')
            .eq('tournament_id', tournamentId)
            .order('round_number');
          if (!fallbackError && fallbackDeadlines) {
            console.log('BracketView - Fallback deadlines received:', fallbackDeadlines);
            deadlineMap = {};
            (fallbackDeadlines as any[]).forEach((d: any) => {
              deadlineMap[d.round_number] = d.closing_date;
            });
          } else if (fallbackError) {
            console.warn('BracketView - Fallback deadlines error:', fallbackError);
          }
        }

        console.log('BracketView Deadline map:', deadlineMap); // Debug log
        setRoundDeadlines(deadlineMap);
      } else {
        const { data, error } = await supabase
          .from('matches_new')
          .select('*')
          .eq('tournament_id', tournamentId)
          .order('round_number')
          .order('match_number');

        if (error) throw error;
        setMatches(data || []);
        setBracketGenerated((data || []).length > 0);
      }
    } catch (error) {
      console.error('Error fetching matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRegistrationCount = async () => {
    try {
      if (embedded) {
        const { data, error } = await supabase.functions.invoke('get-embed-bracket', {
          body: { tournamentId },
        });
        if (error) throw error;
        setRegistrationCount((data as any)?.registrationCount || 0);
      } else {
        const { count, error } = await supabase
          .from('tournament_registrations_new')
          .select('*', { count: 'exact', head: true })
          .eq('tournament_id', tournamentId);

        if (error) throw error;
        setRegistrationCount(count || 0);
      }
    } catch (error) {
      console.error('Error fetching registration count:', error);
    }
  };

  const fetchRoundDeadlines = async () => {
    try {
      if (!embedded) {
        const { data, error } = await supabase
          .from('round_deadlines')
          .select('*')
          .eq('tournament_id', tournamentId);

        if (error) throw error;
        
        const deadlineMap: {[key: number]: string} = {};
        (data || []).forEach(deadline => {
          deadlineMap[deadline.round_number] = deadline.closing_date;
        });
        setRoundDeadlines(deadlineMap);
      }
      // For embedded view, deadlines are already fetched in fetchMatches
    } catch (error) {
      console.error('Error fetching round deadlines:', error);
    }
  };

  const generateBracket = async () => {
    try {
      const generator = new BracketGenerator();
      await generator.generateBracket(tournamentId, tournament);
      await fetchMatches();
    } catch (error) {
      console.error('Error generating bracket:', error);
    }
  };

  const groupMatchesByRound = (matches: Match[]) => {
    const rounds: { [key: number]: Match[] } = {};
    matches.forEach(match => {
      if (!rounds[match.round_number]) {
        rounds[match.round_number] = [];
      }
      rounds[match.round_number].push(match);
    });
    return rounds;
  };


  if (loading) {
    return (
      <Card className="bg-card shadow-card">
        <CardContent className="p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!bracketGenerated) {
    if (embedded) {
      const totalRounds = calculateTotalRounds(tournament.max_players);
      const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1);
      return (
        <Card className="bg-card shadow-sm">
          <CardHeader className="p-3 md:p-4">
            <CardTitle className="flex items-center justify-between text-lg md:text-xl">
              Turnier-Tableau
              <Badge variant="outline">Nicht generiert</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 md:p-4">
            <div className="overflow-x-auto">
              <div className="flex gap-3 md:gap-6 min-w-fit pb-2">
                {rounds.map((roundNumber) => (
                  <div key={roundNumber} className="flex-shrink-0 w-64 md:w-72">
                    <div className="sticky top-0 bg-card z-10 pb-2 mb-2 border-b">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm md:text-base font-semibold text-foreground">
                            {getRoundDisplayName(roundNumber, totalRounds)}
                          </h3>
                          {roundDeadlines[roundNumber] && (
                            <Badge variant="destructive" className="mt-1 text-[10px] md:text-xs flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>Deadline: {format(new Date(roundDeadlines[roundNumber]), 'dd.MM.yyyy')}</span>
                            </Badge>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs">0 Spiele</Badge>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">Tableau noch nicht generiert</div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="bg-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Turnier-Tableau
            <Badge variant="outline">Nicht generiert</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Kein Tableau generiert</h3>
            <p className="text-muted-foreground mb-6">
              Generieren Sie die Turnier-Tableaustruktur, um mit der Organisation der Spiele zu beginnen.
              Das Tableau wird mit {tournament.max_players} {tournament.type === 'singles' ? 'Spieler' : 'Team'} Plätzen erstellt.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Aktuelle Anmeldungen: {registrationCount} / {tournament.max_players}
            </p>
            {!embedded && (
              <Button 
                onClick={generateBracket}
                variant="default"
              >
                <Settings className="h-4 w-4 mr-2" />
                Tableau generieren
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const roundsData = groupMatchesByRound(matches);
  const rounds = Object.keys(roundsData).map(Number).sort((a, b) => a - b);

  return (
    <Card className={`bg-card ${embedded ? 'shadow-sm' : 'shadow-card'}`}>
      <CardHeader className={embedded ? 'p-3 md:p-4' : 'p-6'}>
        <CardTitle className={`flex items-center justify-between ${embedded ? 'text-lg md:text-xl' : 'text-2xl'}`}>
          Turnier-Tableau
          <Badge className="bg-success/10 text-success border-success/30 text-xs">
            Aktiv
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className={embedded ? 'p-2 md:p-4' : 'p-6'}>
        <div className="overflow-x-auto">
          <div className={`flex ${embedded ? 'gap-3 md:gap-6' : 'gap-8'} min-w-fit pb-4`}>
            {rounds.map(roundNumber => (
              <div key={roundNumber} className={`flex-shrink-0 ${embedded ? 'w-64 md:w-72' : 'w-80'}`}>
                <div className={`sticky top-0 bg-card z-10 ${embedded ? 'pb-2 mb-2' : 'pb-4 mb-4'} border-b`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className={`${embedded ? 'text-sm md:text-base' : 'text-lg'} font-semibold text-foreground`}>
                        {getRoundDisplayName(roundNumber, calculateTotalRounds(tournament.max_players))}
                      </h3>
                      {roundDeadlines[roundNumber] && (
                        <Badge variant="destructive" className="mt-1 text-[10px] md:text-xs flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>Deadline: {format(new Date(roundDeadlines[roundNumber]), 'dd.MM.yyyy')}</span>
                        </Badge>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {roundsData[roundNumber].length} Spiele
                    </Badge>
                  </div>
                </div>
                
                <div className={`${embedded ? 'space-y-2 md:space-y-3' : 'space-y-4'}`}>
                  {roundsData[roundNumber].map(match => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      tournament={tournament}
                      onMatchUpdate={fetchMatches}
                      embedded={embedded}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}