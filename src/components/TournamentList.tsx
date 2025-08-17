import { useState, useEffect } from "react";
import { Calendar, Clock, Users, DollarSign, MapPin, Trophy, User, Mail, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Tournament {
  id: string;
  name: string;
  course: string;
  description?: string;
  start_date: string;
  end_date: string;
  max_players: number;
  format: "matchplay" | "strokeplay" | "scramble";
  status: "upcoming" | "active" | "completed";
  registration_open: boolean;
  registration_deadline?: string;
  entry_fee?: number;
  created_at: string;
}

interface Registration {
  id: string;
  tournament_id: string;
  player_id: string;
  status: "registered" | "confirmed" | "cancelled" | "waitlist";
  payment_status: "pending" | "paid" | "refunded";
  registration_date: string;
  player: {
    name: string;
    email?: string;
    handicap: number;
  };
}

interface TournamentListProps {
  onRegister: (tournamentId: string) => void;
}

export function TournamentList({ onRegister }: TournamentListProps) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchTournaments();
    fetchRegistrations();
  }, []);

  const fetchTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('registration_open', true)
        .order('start_date', { ascending: true });

      if (error) throw error;
      setTournaments((data || []).map(t => ({
        ...t,
        format: t.format as "matchplay" | "strokeplay" | "scramble",
        status: t.status as "upcoming" | "active" | "completed"
      })));
    } catch (error) {
      console.error('Error fetching tournaments:', error);
      toast({
        title: "Error",
        description: "Failed to load tournaments.",
        variant: "destructive"
      });
    }
  };

  const fetchRegistrations = async () => {
    try {
      const { data, error } = await supabase
        .from('tournament_registrations')
        .select(`
          *,
          player:players(name, email, handicap)
        `);

      if (error) throw error;
      setRegistrations((data || []).map(r => ({
        ...r,
        status: r.status as "registered" | "confirmed" | "cancelled" | "waitlist",
        payment_status: r.payment_status as "pending" | "paid" | "refunded"
      })));
    } catch (error) {
      console.error('Error fetching registrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRegistrationCount = (tournamentId: string) => {
    return registrations.filter(r => 
      r.tournament_id === tournamentId && 
      ['registered', 'confirmed'].includes(r.status)
    ).length;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "upcoming": return "bg-warning text-warning-foreground";
      case "active": return "bg-success text-success-foreground";
      case "completed": return "bg-muted text-muted-foreground";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const getFormatDisplay = (format: string) => {
    switch (format) {
      case "matchplay": return "Matchplay";
      case "strokeplay": return "Strokeplay";
      case "scramble": return "Scramble";
      default: return format;
    }
  };

  const isRegistrationOpen = (tournament: Tournament) => {
    if (!tournament.registration_open) return false;
    if (tournament.registration_deadline) {
      return new Date() <= new Date(tournament.registration_deadline);
    }
    return tournament.status === "upcoming";
  };

  const isTournamentFull = (tournament: Tournament) => {
    return getRegistrationCount(tournament.id) >= tournament.max_players;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-course">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center">
            <p>Loading tournaments...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-course">
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Tournament Registration</h1>
          <p className="text-muted-foreground">Browse and register for upcoming golf tournaments</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {tournaments.map((tournament) => {
            const registrationCount = getRegistrationCount(tournament.id);
            const canRegister = isRegistrationOpen(tournament) && !isTournamentFull(tournament);
            
            return (
              <Card key={tournament.id} className="shadow-card hover:shadow-elevated transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2">{tournament.name}</CardTitle>
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{tournament.course}</span>
                      </div>
                    </div>
                    <Badge className={getStatusColor(tournament.status)}>
                      {tournament.status}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      <div>
                        <p className="font-medium">Start Date</p>
                        <p className="text-muted-foreground">
                          {new Date(tournament.start_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-primary" />
                      <div>
                        <p className="font-medium">Format</p>
                        <p className="text-muted-foreground">{getFormatDisplay(tournament.format)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <div>
                        <p className="font-medium">Players</p>
                        <p className="text-muted-foreground">
                          {registrationCount}/{tournament.max_players}
                        </p>
                      </div>
                    </div>

                    {tournament.entry_fee && tournament.entry_fee > 0 && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-primary" />
                        <div>
                          <p className="font-medium">Entry Fee</p>
                          <p className="text-muted-foreground">${tournament.entry_fee}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {tournament.description && (
                    <>
                      <Separator />
                      <p className="text-sm text-muted-foreground">{tournament.description}</p>
                    </>
                  )}

                  {tournament.registration_deadline && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-warning" />
                      <span className="text-warning">
                        Registration closes: {new Date(tournament.registration_deadline).toLocaleDateString()}
                      </span>
                    </div>
                  )}

                  <div className="pt-2">
                    {isTournamentFull(tournament) ? (
                      <Badge variant="destructive" className="w-full justify-center py-2">
                        Tournament Full
                      </Badge>
                    ) : !isRegistrationOpen(tournament) ? (
                      <Badge variant="secondary" className="w-full justify-center py-2">
                        Registration Closed
                      </Badge>
                    ) : (
                      <Button 
                        onClick={() => onRegister(tournament.id)}
                        className="w-full"
                        variant="default"
                      >
                        Register Now
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {tournaments.length === 0 && (
          <Card className="shadow-card">
            <CardContent className="p-8 text-center">
              <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Tournaments Available</h3>
              <p className="text-muted-foreground">
                There are currently no tournaments open for registration. Check back later!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}