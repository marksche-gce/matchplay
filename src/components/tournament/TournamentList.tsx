import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Users, Trophy, Trash2, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSystemAdminCheck } from '@/hooks/useSystemAdminCheck';

interface Tournament {
  id: string;
  name: string;
  type: 'singles' | 'foursome';
  max_players: number;
  max_rounds: number;
  start_date: string;
  end_date: string;
  registration_status: 'open' | 'closed' | 'full';
  created_at: string;
  tenant_name?: string;
}

interface TournamentListProps {
  onTournamentSelect: (tournamentId: string) => void;
  refreshTrigger?: number; // Add refresh trigger prop
}

export function TournamentList({ onTournamentSelect, refreshTrigger }: TournamentListProps) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { isSystemAdmin } = useSystemAdminCheck();

  useEffect(() => {
    fetchTournaments();
  }, [refreshTrigger]); // Add refreshTrigger as dependency

  const fetchTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments_new')
        .select(`
          *,
          tenants (
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Map the data to include tenant_name
      const tournamentsWithTenant = (data || []).map(tournament => ({
        ...tournament,
        tenant_name: tournament.tenants?.name || 'Unbekannter Mandant'
      }));
      
      setTournaments(tournamentsWithTenant);
    } catch (error) {
      console.error('Error fetching tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteTournament = async (tournamentId: string, tournamentName: string) => {
    if (!confirm(`Sind Sie sicher, dass Sie "${tournamentName}" löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
      return;
    }

    try {
      if (isSystemAdmin) {
        const { error } = await supabase.functions.invoke('delete-tournament', {
          body: { tournamentId },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tournaments_new')
          .delete()
          .eq('id', tournamentId);
        if (error) throw error;
      }

      toast({
        title: "Turnier gelöscht",
        description: `"${tournamentName}" wurde erfolgreich gelöscht.`,
      });

      // Refresh the tournaments list
      fetchTournaments();
    } catch (error: any) {
      console.error('Error deleting tournament:', error);
      toast({
        title: "Löschen fehlgeschlagen",
        description: error.message || "Turnier konnte nicht gelöscht werden.",
        variant: "destructive",
      });
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

  const getStatusText = (status: string) => {
    switch (status) {
      case 'open': return 'Offen';
      case 'closed': return 'Geschlossen';
      case 'full': return 'Voll';
      default: return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="bg-card shadow-card animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (tournaments.length === 0) {
    return (
      <Card className="bg-card shadow-card">
        <CardContent className="p-12 text-center">
          <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Noch keine Turniere</h3>
          <p className="text-muted-foreground">
            Erstellen Sie Ihr erstes Match-Play-Turnier, um zu beginnen.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground mb-4">Aktive Turniere</h2>
      
      {tournaments.map((tournament) => (
        <Card key={tournament.id} className="bg-card shadow-card hover:shadow-elevated transition-all duration-300">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg text-foreground">{tournament.name}</CardTitle>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {tournament.type === 'singles' ? 'Einzel' : 'Vierer'} • {tournament.max_players} max
                  </div>
                  <div className="flex items-center gap-1">
                    <Trophy className="h-4 w-4" />
                    {tournament.max_rounds} Runden
                  </div>
                </div>
              </div>
              <Badge className={getStatusColor(tournament.registration_status)}>
                {getStatusText(tournament.registration_status)}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDate(tournament.start_date)} - {formatDate(tournament.end_date)}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span className="font-medium">{tournament.tenant_name}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => onTournamentSelect(tournament.id)}
                  variant="default"
                >
                  Turnier anzeigen
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteTournament(tournament.id, tournament.name);
                  }}
                  className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}