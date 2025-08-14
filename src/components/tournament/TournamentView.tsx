import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, Trophy, Settings, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { RegistrationDialog } from './RegistrationDialog';
import { BracketView } from './BracketView';
import { useAuth } from '@/hooks/useAuth';

interface Tournament {
  id: string;
  name: string;
  type: 'singles' | 'foursome';
  max_players: number;
  max_rounds: number;
  start_date: string;
  end_date: string;
  registration_status: 'open' | 'closed' | 'full';
}

interface TournamentViewProps {
  tournamentId: string;
  onBack: () => void;
}

export function TournamentView({ tournamentId, onBack }: TournamentViewProps) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [registrationCount, setRegistrationCount] = useState(0);
  const [showRegistration, setShowRegistration] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchTournamentDetails();
    fetchRegistrationCount();
  }, [tournamentId]);

  const fetchTournamentDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments_new')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (error) throw error;
      setTournament(data);
    } catch (error) {
      console.error('Error fetching tournament:', error);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-success/10 text-success border-success/30';
      case 'closed': return 'bg-warning/10 text-warning border-warning/30';
      case 'full': return 'bg-destructive/10 text-destructive border-destructive/30';
      default: return 'bg-secondary/10 text-secondary-foreground border-secondary/30';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
        <div className="h-32 bg-muted rounded mb-6"></div>
        <div className="h-64 bg-muted rounded"></div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Tournament not found.</p>
        <Button onClick={onBack} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to List
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{tournament.name}</h1>
            <p className="text-muted-foreground">
              {tournament.type === 'singles' ? 'Singles' : 'Foursome'} Match Play Tournament
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => setShowRegistration(true)}
            className="bg-gradient-primary hover:opacity-90"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Register
          </Button>
          {user && (
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Manage
            </Button>
          )}
        </div>
      </div>

      {/* Tournament Info */}
      <Card className="bg-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Tournament Information
            <Badge className={getStatusColor(tournament.registration_status)}>
              {tournament.registration_status}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Tournament Dates</p>
              <p className="font-medium">{formatDate(tournament.start_date)}</p>
              <p className="font-medium">to {formatDate(tournament.end_date)}</p>
            </div>
            
            <div>
              <p className="text-sm text-muted-foreground">Participants</p>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="font-medium">
                  {registrationCount} / {tournament.max_players} {tournament.type === 'singles' ? 'players' : 'teams'}
                </span>
              </div>
            </div>
            
            <div>
              <p className="text-sm text-muted-foreground">Format</p>
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                <span className="font-medium">{tournament.max_rounds} rounds elimination</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bracket */}
      <BracketView tournamentId={tournamentId} tournament={tournament} />

      {/* Registration Dialog */}
      <RegistrationDialog 
        open={showRegistration}
        onOpenChange={setShowRegistration}
        tournament={tournament}
        onRegistrationComplete={() => {
          fetchRegistrationCount();
          setShowRegistration(false);
        }}
      />
    </div>
  );
}