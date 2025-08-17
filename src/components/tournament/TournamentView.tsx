import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, Trophy, Settings, UserPlus, Edit3, Trash2, ExternalLink, Copy, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
  const [showManagement, setShowManagement] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

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

  const getEmbedUrl = () => {
    return `${window.location.origin}/tournaments/${tournamentId}/embed`;
  };

  const copyEmbedUrl = async () => {
    try {
      await navigator.clipboard.writeText(getEmbedUrl());
      toast({
        title: "Embed URL Copied",
        description: "The embed URL has been copied to your clipboard.",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy embed URL to clipboard.",
        variant: "destructive",
      });
    }
  };

  const completeRegistrationPeriod = async () => {
    if (!tournament) return;
    
    try {
      const { error } = await supabase
        .from('tournaments_new')
        .update({ registration_status: 'closed' })
        .eq('id', tournament.id);

      if (error) throw error;

      toast({
        title: "Registration Period Completed",
        description: "Tournament registration has been closed. The tournament bracket is now available.",
      });

      // Refresh tournament data
      fetchTournamentDetails();
      
    } catch (error: any) {
      console.error('Error closing registration:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to close registration period.",
        variant: "destructive",
      });
    }
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
              {tournament.type === 'singles' ? 'Singles' : 'Foursome'} Matchplay Tournament
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => setShowRegistration(true)}
            variant="default"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Register
          </Button>
          {user && (
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => setShowManagement(!showManagement)}
              >
                <Settings className="h-4 w-4 mr-2" />
                Manage
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Management Panel */}
      {showManagement && user && (
        <Card className="bg-card shadow-card mb-6">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Tournament Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {tournament.registration_status === 'open' && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={completeRegistrationPeriod}
                  className="text-warning hover:text-warning border-warning/30 hover:bg-warning/10"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Registration Period Completed
                </Button>
              )}
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open(getEmbedUrl(), '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Embed
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={copyEmbedUrl}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Embed URL
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  // TODO: Add edit tournament functionality
                  toast({
                    title: "Coming Soon",
                    description: "Tournament editing will be available soon.",
                  });
                }}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Edit Tournament
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  // TODO: Add manage registrations functionality
                  toast({
                    title: "Coming Soon", 
                    description: "Registration management will be available soon.",
                  });
                }}
              >
                <Users className="h-4 w-4 mr-2" />
                Manage Registrations
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={async () => {
                  if (!tournament) return;
                  
                  if (!confirm(`Are you sure you want to delete "${tournament.name}"? This action cannot be undone.`)) {
                    return;
                  }

                  try {
                    const { error } = await supabase
                      .from('tournaments_new')
                      .delete()
                      .eq('id', tournament.id);

                    if (error) throw error;

                    toast({
                      title: "Tournament Deleted",
                      description: `"${tournament.name}" has been successfully deleted.`,
                    });

                    onBack(); // Go back to tournament list
                  } catch (error: any) {
                    console.error('Error deleting tournament:', error);
                    toast({
                      title: "Delete Failed",
                      description: error.message || "Failed to delete tournament.",
                      variant: "destructive",
                    });
                  }
                }}
                className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Tournament
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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