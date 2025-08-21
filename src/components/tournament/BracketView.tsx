import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Settings, Play } from 'lucide-react';
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
  }, [tournamentId]);

  const fetchMatches = async () => {
    try {
      if (embedded) {
        const { data, error } = await supabase.functions.invoke('get-embed-bracket', {
          body: { tournamentId },
        });
        if (error) throw error;
        setMatches((data as any)?.matches || []);
        setBracketGenerated(((data as any)?.matches || []).length > 0);
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
    return (
      <Card className="bg-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Turnier-Tableau
            <Badge variant="outline">Not Generated</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Bracket Generated</h3>
            <p className="text-muted-foreground mb-6">
              Generate the tournament bracket structure to begin organizing matches.
              The bracket will be created with {tournament.max_players} {tournament.type === 'singles' ? 'player' : 'team'} slots.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Current registrations: {registrationCount} / {tournament.max_players}
            </p>
            
            {!embedded && (
              <Button 
                onClick={generateBracket}
                variant="default"
              >
                <Settings className="h-4 w-4 mr-2" />
                Generate Bracket
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
            Active
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
                        <p className="text-xs text-muted-foreground mt-1">
                          Deadline: {format(new Date(roundDeadlines[roundNumber]), 'MMM dd, yyyy HH:mm')}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {roundsData[roundNumber].length} matches
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