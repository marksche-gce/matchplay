import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Users, Trophy, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface Tournament {
  id: string;
  name: string;
  type: 'singles' | 'foursome';
  max_players: number;
  start_date: string;
  end_date: string;
  registration_status: 'open' | 'closed' | 'full';
}

interface EmbedRegistrationFormProps {
  tournament: Tournament;
  registrationCount: number;
  onRegistrationComplete: () => void;
}

export function EmbedRegistrationForm({ tournament, registrationCount, onRegistrationComplete }: EmbedRegistrationFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [handicap, setHandicap] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Team registration state for foursome tournaments
  const [teamName, setTeamName] = useState('');
  const [player1Name, setPlayer1Name] = useState('');
  const [player1Email, setPlayer1Email] = useState('');
  const [player1Handicap, setPlayer1Handicap] = useState('');
  const [player2Name, setPlayer2Name] = useState('');
  const [player2Email, setPlayer2Email] = useState('');
  const [player2Handicap, setPlayer2Handicap] = useState('');
  
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (tournament.type === 'foursome') {
      // Handle team registration
      if (!teamName.trim() || !player1Name.trim() || !player1Email.trim() || 
          !player1Handicap.trim() || !player2Name.trim() || !player2Email.trim() || 
          !player2Handicap.trim()) {
        toast({
          title: "Fehlende Informationen",
          description: "Bitte füllen Sie alle Felder für beide Spieler aus.",
          variant: "destructive",
        });
        return;
      }

      setLoading(true);

      try {
        // Create or get player 1
        const { data: existingPlayer1 } = await supabase
          .from('players_new')
          .select('id')
          .eq('email', player1Email.trim())
          .single();

        let player1Id = existingPlayer1?.id;

        if (!player1Id) {
          const { data: newPlayer1, error: player1Error } = await supabase
            .from('players_new')
            .insert({
              name: player1Name.trim(),
              email: player1Email.trim(),
              handicap: parseFloat(player1Handicap),
            })
            .select('id')
            .single();

          if (player1Error) throw player1Error;
          player1Id = newPlayer1.id;
        }

        // Create or get player 2
        const { data: existingPlayer2 } = await supabase
          .from('players_new')
          .select('id')
          .eq('email', player2Email.trim())
          .single();

        let player2Id = existingPlayer2?.id;

        if (!player2Id) {
          const { data: newPlayer2, error: player2Error } = await supabase
            .from('players_new')
            .insert({
              name: player2Name.trim(),
              email: player2Email.trim(),
              handicap: parseFloat(player2Handicap),
            })
            .select('id')
            .single();

          if (player2Error) throw player2Error;
          player2Id = newPlayer2.id;
        }

        // Create team
        const { data: team, error: teamError } = await supabase
          .from('teams')
          .insert({
            tournament_id: tournament.id,
            name: teamName.trim(),
            player1_id: player1Id,
            player2_id: player2Id,
          })
          .select('id')
          .single();

        if (teamError) throw teamError;

        // Register team for tournament
        const { error: registrationError } = await supabase
          .from('tournament_registrations_new')
          .insert({
            tournament_id: tournament.id,
            team_id: team.id,
          });

        if (registrationError) throw registrationError;

        toast({
          title: "Team-Registrierung erfolgreich!",
          description: `Team ${teamName} wurde für ${tournament.name} registriert.`,
        });

        // Reset form
        setTeamName('');
        setPlayer1Name('');
        setPlayer1Email('');
        setPlayer1Handicap('');
        setPlayer2Name('');
        setPlayer2Email('');
        setPlayer2Handicap('');
        
        onRegistrationComplete();
        
      } catch (error: any) {
        console.error('Team registration error:', error);
        toast({
          title: "Registrierung fehlgeschlagen",
          description: error.message || "Team-Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    } else {
      // Handle individual player registration
      if (!name.trim() || !email.trim()) {
        toast({
          title: "Fehlende Informationen",
          description: "Bitte füllen Sie Name und E-Mail-Felder aus.",
          variant: "destructive",
        });
        return;
      }

      const handicapNumber = parseFloat(handicap) || 0;

      setLoading(true);

      try {
        // First, create or find the player
        let playerId: string;
        
        // Check if player with this email already exists
        const { data: existingPlayer } = await supabase
          .from('players_new')
          .select('id')
          .eq('email', email.trim())
          .single();

        if (existingPlayer) {
          playerId = existingPlayer.id;
        } else {
          // Create new player
          const { data: newPlayer, error: playerError } = await supabase
            .from('players_new')
            .insert({
              name: name.trim(),
              email: email.trim(),
              handicap: handicapNumber,
            })
            .select('id')
            .single();

          if (playerError) throw playerError;
          playerId = newPlayer.id;
        }

        // Check if already registered for this tournament
        const { data: existingRegistration } = await supabase
          .from('tournament_registrations_new')
          .select('id')
          .eq('tournament_id', tournament.id)
          .eq('player_id', playerId)
          .single();

        if (existingRegistration) {
          toast({
            title: "Bereits registriert",
            description: "Sie sind bereits für dieses Turnier registriert.",
            variant: "destructive",
          });
          return;
        }

        // Register for tournament
        const { error: registrationError } = await supabase
          .from('tournament_registrations_new')
          .insert({
            tournament_id: tournament.id,
            player_id: playerId,
          });

        if (registrationError) throw registrationError;

        toast({
          title: "Registrierung erfolgreich!",
          description: `Sie wurden für ${tournament.name} registriert.`,
        });

        // Reset form
        setName('');
        setEmail('');
        setHandicap('');
        
        onRegistrationComplete();
        
      } catch (error: any) {
        console.error('Registration error:', error);
        toast({
          title: "Registrierung fehlgeschlagen",
          description: error.message || "Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
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

  const isRegistrationClosed = tournament.registration_status !== 'open';
  const isFull = registrationCount >= tournament.max_players;

  return (
    <Card className="shadow-sm">
          <CardHeader className="p-3 md:p-6">
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <UserPlus className="h-4 w-4 md:h-5 md:w-5" />
              Turnier-Registrierung
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 md:space-y-6 p-3 md:p-6 pt-0">
            {isRegistrationClosed || isFull ? (
              <div className="text-center py-8">
                <div className="mb-4">
                  {isFull ? (
                    <Badge className="bg-warning/10 text-warning border-warning/30 text-lg px-4 py-2">
                      Turnier voll
                    </Badge>
                  ) : (
                    <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-lg px-4 py-2">
                      Anmeldung geschlossen
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">
                  {isFull 
                    ? 'Dieses Turnier hat seine maximale Kapazität erreicht.' 
                    : 'Die Anmeldung für dieses Turnier ist beendet.'}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {tournament.type === 'foursome' ? (
                  // Team registration form
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="teamName">Teamname *</Label>
                      <Input
                        id="teamName"
                        type="text"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        placeholder="Teamnamen eingeben"
                        required
                      />
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Spieler 1
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="player1Name">Name *</Label>
                          <Input
                            id="player1Name"
                            type="text"
                            value={player1Name}
                            onChange={(e) => setPlayer1Name(e.target.value)}
                            placeholder="Name von Spieler 1"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="player1Handicap">Handicap *</Label>
                          <Input
                            id="player1Handicap"
                            type="number"
                            step="0.1"
                            value={player1Handicap}
                            onChange={(e) => setPlayer1Handicap(e.target.value)}
                            placeholder="Handicap von Spieler 1"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="player1Email">E-Mail *</Label>
                        <Input
                          id="player1Email"
                          type="email"
                          value={player1Email}
                          onChange={(e) => setPlayer1Email(e.target.value)}
                          placeholder="E-Mail von Spieler 1"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Spieler 2
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="player2Name">Name *</Label>
                          <Input
                            id="player2Name"
                            type="text"
                            value={player2Name}
                            onChange={(e) => setPlayer2Name(e.target.value)}
                            placeholder="Name von Spieler 2"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="player2Handicap">Handicap *</Label>
                          <Input
                            id="player2Handicap"
                            type="number"
                            step="0.1"
                            value={player2Handicap}
                            onChange={(e) => setPlayer2Handicap(e.target.value)}
                            placeholder="Handicap von Spieler 2"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="player2Email">E-Mail *</Label>
                        <Input
                          id="player2Email"
                          type="email"
                          value={player2Email}
                          onChange={(e) => setPlayer2Email(e.target.value)}
                          placeholder="E-Mail von Spieler 2"
                          required
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  // Individual player registration form
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Vollständiger Name *</Label>
                        <Input
                          id="name"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Geben Sie Ihren vollständigen Namen ein"
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="email">E-Mail-Adresse *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Geben Sie Ihre E-Mail ein"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="handicap">Golf-Handicap</Label>
                      <Input
                        id="handicap"
                        type="number"
                        step="0.1"
                        value={handicap}
                        onChange={(e) => setHandicap(e.target.value)}
                        placeholder="Geben Sie Ihr Handicap ein (optional)"
                      />
                      <p className="text-xs text-muted-foreground">
                        Lassen Sie das Feld leer, wenn Sie kein Handicap haben
                      </p>
                    </div>
                  </>
                )}

                 <div className="bg-muted/50 p-4 rounded-lg">
                   <p className="text-sm text-muted-foreground">
                     <strong>Turnierdetails:</strong><br />
                     • Format: {tournament.type === 'singles' ? 'Einzel Matchplay' : 'Vierer Matchplay'}<br />
                     • Tableau-Größe: {tournament.max_players} {tournament.type === 'singles' ? 'Spieler' : 'Teams'}<br />
                     • Aktuelle Anmeldungen: {registrationCount}
                     {registrationCount > tournament.max_players && (
                       <><br />• ⚠️ Mehr Anmeldungen als Tableau-Plätze - Größe muss angepasst werden</>
                     )}
                   </p>
                 </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading}
                  size="lg"
                >
                  {loading ? 'Registriere...' : tournament.type === 'foursome' ? 'Team registrieren' : 'Für Turnier registrieren'}
                </Button>
              </form>
            )}
          </CardContent>
    </Card>
  );
}