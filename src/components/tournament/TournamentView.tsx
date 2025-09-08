import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, Trophy, Settings, UserPlus, Trash2, ExternalLink, Copy, CheckCircle, RotateCcw, Calendar, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { RegistrationDialog } from './RegistrationDialog';
import { BracketView } from './BracketView';
import { RoundScheduleDialog } from './RoundScheduleDialog';
import { RegistrationManagement } from './RegistrationManagement';
import { TeamRegistrationManagement } from './TeamRegistrationManagement';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BracketGenerator } from '@/lib/bracketGenerator';
import { calculateTotalRounds } from '@/lib/tournamentUtils';

import { useAuth } from '@/hooks/useAuth';
import { useSystemAdminCheck } from '@/hooks/useSystemAdminCheck';
import { useOrganizerCheck } from '@/hooks/useOrganizerCheck';

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
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showRegistrationManagement, setShowRegistrationManagement] = useState(false);
  const [showBracketSizeDialog, setShowBracketSizeDialog] = useState(false);
  const [selectedBracketSize, setSelectedBracketSize] = useState(tournament?.max_players || 32);
  const { user } = useAuth();
  const { toast } = useToast();
  const { isSystemAdmin } = useSystemAdminCheck();
  const { isOrganizer } = useOrganizerCheck();

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
    return new Date(dateString).toLocaleDateString('de-DE', {
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
         title: "Embed URL kopiert",
         description: "Die Embed URL wurde in die Zwischenablage kopiert.",
      });
    } catch (error) {
       toast({
         title: "Kopieren fehlgeschlagen",
         description: "Embed URL konnte nicht in die Zwischenablage kopiert werden.",
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
         title: "Anmeldephase abgeschlossen",
         description: "Die Turnieranmeldung wurde geschlossen. Das Turnier-Tableau ist jetzt verfügbar.",
      });

      // Refresh tournament data
      fetchTournamentDetails();
      
    } catch (error: any) {
      console.error('Error closing registration:', error);
      toast({
         title: "Fehler",
         description: error.message || "Anmeldephase konnte nicht geschlossen werden.",
        variant: "destructive",
      });
    }
  };

  const reopenRegistration = async () => {
    if (!tournament) return;
    
    try {
      const { error } = await supabase
        .from('tournaments_new')
        .update({ registration_status: 'open' })
        .eq('id', tournament.id);

      if (error) throw error;

       toast({
         title: "Anmeldung wieder geöffnet",
         description: "Die Turnieranmeldung ist wieder geöffnet. Spieler können sich anmelden.",
      });

      // Refresh tournament data
      fetchTournamentDetails();
      
    } catch (error: any) {
      console.error('Error reopening registration:', error);
      toast({
         title: "Fehler",
         description: error.message || "Anmeldung konnte nicht wieder geöffnet werden.",
        variant: "destructive",
      });
    }
  };

  const updateBracketSize = async (newSize: number) => {
    if (!tournament) return;
    
    try {
      // First, delete all existing matches
      const { error: deleteMatchesError } = await supabase
        .from('matches_new')
        .delete()
        .eq('tournament_id', tournament.id);

      if (deleteMatchesError) throw deleteMatchesError;

      // Update tournament max_players (max_rounds will be calculated automatically)
      const { error: updateError } = await supabase
        .from('tournaments_new')
        .update({ 
          max_players: newSize
        })
        .eq('id', tournament.id);

      if (updateError) throw updateError;

      // Get the updated tournament data to get the calculated max_rounds
      const { data: updatedTournament, error: fetchError } = await supabase
        .from('tournaments_new')
        .select('*')
        .eq('id', tournament.id)
        .single();

      if (fetchError) throw fetchError;

      // Regenerate bracket using the updated tournament data (without player assignment)
      const bracketGenerator = new BracketGenerator();
      await bracketGenerator.generateBracket(tournament.id, {
        ...updatedTournament,
        type: tournament.type as 'singles' | 'foursome'
      }, true); // Skip player assignment to create empty bracket

      toast({
        title: "Tableau-Grösse angepasst",
        description: `Das Turnier-Tableau wurde für ${newSize} Spieler neu erstellt.`,
      });

      // Refresh tournament data
      fetchTournamentDetails();
      setShowBracketSizeDialog(false);
      
    } catch (error: any) {
      console.error('Error updating bracket size:', error);
      toast({
        title: "Fehler",
        description: error.message || "Tableau-Grösse konnte nicht angepasst werden.",
        variant: "destructive",
      });
    }
  };

  const handleClearAllMatches = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('clear-match-participants', {
        body: { tournamentId: tournament.id }
      });

      if (error) {
        console.error('Error clearing matches:', error);
        toast({
          title: "Fehler",
          description: "Matches konnten nicht gelöscht werden.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Matches gelöscht",
        description: `Alle ${data.matchesCleared || 0} Matches wurden erfolgreich zurückgesetzt.`,
      });
      
    } catch (error) {
      console.error('Error clearing matches:', error);
      toast({
        title: "Fehler",
        description: "Ein unerwarteter Fehler ist aufgetreten.",
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
        <p className="text-muted-foreground">Turnier nicht gefunden.</p>
        <Button onClick={onBack} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück zur Liste
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tournament.name}</h1>
          <p className="text-muted-foreground">
            {tournament.type === 'singles' ? 'Einzel' : 'Vierer'} Matchplay Turnier
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Zurück</span>
            <span className="sm:hidden">Back</span>
          </Button>
          {tournament.registration_status === 'open' && (
            <Button 
              onClick={() => setShowRegistration(true)}
              variant="default"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Registrieren</span>
              <span className="sm:hidden">Register</span>
            </Button>
          )}
          {user && (isSystemAdmin || isOrganizer) && (
            <Button 
              variant="outline"
              onClick={() => setShowManagement(!showManagement)}
            >
              <Settings className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Verwalten</span>
              <span className="sm:hidden">Manage</span>
            </Button>
          )}
        </div>
      </div>

      {/* Management Panel */}
      {showManagement && user && (isSystemAdmin || isOrganizer) && (
        <Card className="bg-card shadow-card mb-6">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Turnier Management</CardTitle>
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
                   Anmeldephase abgeschlossen
                </Button>
              )}
              
              {tournament.registration_status === 'closed' && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={reopenRegistration}
                  className="text-success hover:text-success border-success/30 hover:bg-success/10"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Anmeldung wieder öffnen
                </Button>
              )}
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open(getEmbedUrl(), '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Embed ansehen
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={copyEmbedUrl}
              >
                <Copy className="h-4 w-4 mr-2" />
                Embed URL kopieren
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowScheduleDialog(true)}
              >
                <Calendar className="h-4 w-4 mr-2" />
                 Rundenplan
              </Button>
              
               <Button 
                 variant="outline" 
                 size="sm"
                 onClick={() => setShowRegistrationManagement(true)}
               >
                 <Users className="h-4 w-4 mr-2" />
                 {tournament.type === 'singles' ? 'Anmeldungen verwalten' : 'Teams verwalten'}
               </Button>
               
               <Button 
                 variant="outline" 
                 size="sm"
                 onClick={() => {
                   setSelectedBracketSize(tournament.max_players);
                   setShowBracketSizeDialog(true);
                 }}
               >
                  <Target className="h-4 w-4 mr-2" />
                  Tableau-Grösse anpassen
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    if (!confirm('Sind Sie sicher, dass Sie alle zugewiesenen Spieler aus den Matches entfernen möchten? Diese Aktion kann nicht rückgängig gemacht werden.')) {
                      return;
                    }
                    handleClearAllMatches();
                  }}
                  className="text-warning hover:text-warning border-warning/30 hover:bg-warning/10"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Alle Matches löschen
                </Button>
               
               <Button 
                 variant="outline" 
                 size="sm"
                 onClick={async () => {
                   if (!tournament) return;
                   
                   if (!confirm(`Sind Sie sicher, dass Sie "${tournament.name}" löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
                     return;
                   }

                   try {
                     if (isSystemAdmin) {
                       const { error } = await supabase.functions.invoke('delete-tournament', {
                         body: { tournamentId: tournament.id }
                       });
                       if (error) throw error;
                     } else {
                       const { error } = await supabase
                         .from('tournaments_new')
                         .delete()
                         .eq('id', tournament.id);
                       if (error) throw error;
                     }

                     toast({
                        title: "Turnier gelöscht",
                        description: `"${tournament.name}" wurde erfolgreich gelöscht.`,
                     });

                     onBack(); // Go back to tournament list
                  } catch (error: any) {
                    console.error('Error deleting tournament:', error);
                    toast({
                       title: "Löschen fehlgeschlagen",
                       description: error.message || "Turnier konnte nicht gelöscht werden.",
                      variant: "destructive",
                    });
                  }
                }}
                className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Turnier löschen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tournament Info */}
      <Card className="bg-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Turnierinformationen
            <Badge className={getStatusColor(tournament.registration_status)}>
              {tournament.registration_status}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
               <p className="text-sm text-muted-foreground">Turnierdaten</p>
               <p className="font-medium">{formatDate(tournament.start_date)}</p>
               <p className="font-medium">bis {formatDate(tournament.end_date)}</p>
            </div>
            
            <div>
               <p className="text-sm text-muted-foreground">Teilnehmer</p>
               <div className="flex items-center gap-2">
                 <Users className="h-4 w-4 text-primary" />
                 <span className="font-medium">
                   {registrationCount} / {tournament.max_players} {tournament.type === 'singles' ? 'Spieler' : 'Teams'}
                </span>
              </div>
            </div>
            
            <div>
               <p className="text-sm text-muted-foreground">Format</p>
               <div className="flex items-center gap-2">
                 <Trophy className="h-4 w-4 text-primary" />
                 <span className="font-medium">{tournament.max_rounds} Runden K.O.</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bracket */}
      <BracketView key={`${tournament.id}-${tournament.max_players}`} tournamentId={tournamentId} tournament={tournament} />

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

      {/* Round Schedule Dialog */}
      <RoundScheduleDialog 
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        tournament={tournament}
        onSuccess={() => {
          // Refresh tournament data if needed
          fetchTournamentDetails();
        }}
      />

      {/* Registration Management Dialog */}
      {tournament.type === 'singles' ? (
        <RegistrationManagement 
          open={showRegistrationManagement}
          onOpenChange={setShowRegistrationManagement}
          tournament={tournament}
          onUpdate={() => {
            fetchRegistrationCount();
          }}
        />
      ) : (
        <TeamRegistrationManagement 
          open={showRegistrationManagement}
          onOpenChange={setShowRegistrationManagement}
          tournament={tournament}
          onUpdate={() => {
            fetchRegistrationCount();
          }}
        />
      )}

      {/* Bracket Size Dialog */}
      {showBracketSizeDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Tableau-Grösse anpassen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Aktuelle Grösse: {tournament.max_players} Spieler
                </p>
                <p className="text-sm text-destructive mb-4">
                  ⚠️ Alle bestehenden Matches werden gelöscht und das Tableau wird neu erstellt.
                </p>
                <Select
                  value={selectedBracketSize.toString()}
                  onValueChange={(value) => setSelectedBracketSize(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="8">8 Spieler</SelectItem>
                    <SelectItem value="16">16 Spieler</SelectItem>
                    <SelectItem value="32">32 Spieler</SelectItem>
                    <SelectItem value="64">64 Spieler</SelectItem>
                    <SelectItem value="128">128 Spieler</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setShowBracketSizeDialog(false)}
                >
                  Abbrechen
                </Button>
                <Button 
                  onClick={() => updateBracketSize(selectedBracketSize)}
                  disabled={selectedBracketSize === tournament.max_players}
                >
                  Anpassen
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}