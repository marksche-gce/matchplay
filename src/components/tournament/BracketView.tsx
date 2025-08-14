import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Settings, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BracketGenerator } from '@/lib/bracketGenerator';
import { MatchCard } from './MatchCard';

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
}

export function BracketView({ tournamentId, tournament }: BracketViewProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [registrationCount, setRegistrationCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [bracketGenerated, setBracketGenerated] = useState(false);

  useEffect(() => {
    fetchMatches();
    fetchRegistrationCount();
  }, [tournamentId]);

  const fetchMatches = async () => {
    try {
      const { data, error } = await supabase
        .from('matches_new')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('round_number')
        .order('match_number');

      if (error) throw error;
      setMatches(data || []);
      setBracketGenerated((data || []).length > 0);
    } catch (error) {
      console.error('Error fetching matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRegistrationCount = async () => {
    try {
      const { count, error } = await supabase
        .from('tournament_registrations_new')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournamentId);

      if (error) throw error;
      setRegistrationCount(count || 0);
    } catch (error) {
      console.error('Error fetching registration count:', error);
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

  const getRoundName = (roundNumber: number, totalRounds: number) => {
    if (roundNumber === totalRounds) return 'Final';
    if (roundNumber === totalRounds - 1) return 'Semifinals';
    if (roundNumber === totalRounds - 2) return 'Quarterfinals';
    return `Round ${roundNumber}`;
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
            Tournament Bracket
            <Badge variant="outline">Not Generated</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Bracket Not Generated</h3>
            <p className="text-muted-foreground mb-6">
              Generate the tournament bracket to start the competition. 
              You currently have {registrationCount} registered {tournament.type === 'singles' ? 'players' : 'teams'}.
            </p>
            
            {registrationCount > 0 && (
              <Button 
                onClick={generateBracket}
                className="bg-gradient-primary hover:opacity-90"
              >
                <Settings className="h-4 w-4 mr-2" />
                Generate Bracket
              </Button>
            )}
            
            {registrationCount === 0 && (
              <p className="text-sm text-warning">
                At least one {tournament.type === 'singles' ? 'player' : 'team'} must be registered to generate the bracket.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const roundsData = groupMatchesByRound(matches);
  const rounds = Object.keys(roundsData).map(Number).sort((a, b) => a - b);

  return (
    <Card className="bg-card shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Tournament Bracket
          <Badge className="bg-success/10 text-success border-success/30">
            Active
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {rounds.map(roundNumber => (
            <div key={roundNumber} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">
                  {getRoundName(roundNumber, tournament.max_rounds)}
                </h3>
                <Badge variant="outline">
                  {roundsData[roundNumber].length} matches
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {roundsData[roundNumber].map(match => (
                  <MatchCard 
                    key={match.id} 
                    match={match} 
                    tournament={tournament}
                    onMatchUpdate={fetchMatches}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}