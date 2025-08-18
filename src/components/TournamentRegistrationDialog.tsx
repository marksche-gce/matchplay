import { useState, useEffect } from "react";
import { User, Mail, Phone, Users, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { validateEmail, validatePhone, validateHandicap, sanitizeInput } from "@/lib/validation";

interface Tournament {
  id: string;
  name: string;
  course: string;
  description?: string;
  start_date: string;
  end_date: string;
  max_players: number;
  format: "matchplay" | "strokeplay" | "scramble";
  entry_fee?: number;
  registration_deadline?: string;
}

interface PlayerData {
  name: string;
  email: string;
  handicap: number;
  phone: string;
  emergency_contact: string;
  notes: string;
}

interface TournamentRegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string | null;
  onRegistrationComplete: () => void;
}

export function TournamentRegistrationDialog({
  open,
  onOpenChange,
  tournamentId,
  onRegistrationComplete
}: TournamentRegistrationDialogProps) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [playerData, setPlayerData] = useState<PlayerData>({
    name: "",
    email: "",
    handicap: 0,
    phone: "",
    emergency_contact: "",
    notes: ""
  });
  const [loading, setLoading] = useState(false);
  const [existingPlayer, setExistingPlayer] = useState<any>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (open && tournamentId) {
      fetchTournament();
      checkExistingPlayer();
    }
  }, [open, tournamentId]);

  const fetchTournament = async () => {
    if (!tournamentId) return;

    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (error) throw error;
      setTournament({
        ...data,
        format: data.format as "matchplay" | "strokeplay" | "scramble"
      });
    } catch (error) {
      console.error('Error fetching tournament:', error);
        toast({
          title: "Fehler",
          description: "Turnierdetails konnten nicht geladen werden.",
          variant: "destructive"
        });
    }
  };

  const checkExistingPlayer = async () => {
    try {
      if (!user) return;

      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setExistingPlayer(data);
        setPlayerData({
          name: data.name || "",
          email: data.email || "",
          handicap: data.handicap || 0,
          phone: data.phone || "",
          emergency_contact: data.emergency_contact || "",
          notes: ""
        });
      }
    } catch (error) {
      console.error('Error checking existing player:', error);
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    
    try {
      if (!user) {
        toast({
          title: "Anmeldung erforderlich",
          description: "Bitte melden Sie sich an, um sich für Turniere zu registrieren.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Validation
      if (!playerData.name.trim() || !playerData.email.trim()) {
        toast({
          title: "Fehlende Informationen",
          description: "Bitte füllen Sie alle Pflichtfelder aus.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      if (!validateEmail(playerData.email)) {
        toast({
          title: "Ungültige E-Mail",
          description: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Only validate phone if it's provided (it's optional)
      if (playerData.phone && !validatePhone(playerData.phone)) {
        toast({
          title: "Ungültige Telefonnummer",
          description: "Bitte geben Sie eine gültige Telefonnummer ein.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      if (!validateHandicap(playerData.handicap)) {
        toast({
          title: "Ungültiges Handicap",
          description: "Das Handicap muss zwischen 0 und 36 liegen.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Sanitize inputs
      const sanitizedData = {
        name: sanitizeInput(playerData.name),
        email: sanitizeInput(playerData.email),
        phone: sanitizeInput(playerData.phone),
        emergency_contact: sanitizeInput(playerData.emergency_contact),
        notes: sanitizeInput(playerData.notes),
        handicap: playerData.handicap
      };

      let playerId = existingPlayer?.id;

      // Create or update player profile
      if (existingPlayer) {
        const { error: updateError } = await supabase
          .from('players')
          .update({
            name: sanitizedData.name,
            email: sanitizedData.email,
            handicap: sanitizedData.handicap,
            phone: sanitizedData.phone,
            emergency_contact: sanitizedData.emergency_contact
          })
          .eq('id', existingPlayer.id);

        if (updateError) throw updateError;
      } else {
        const { data: newPlayer, error: insertError } = await supabase
          .from('players')
          .insert({
            user_id: user.id,
            name: sanitizedData.name,
            email: sanitizedData.email,
            handicap: sanitizedData.handicap,
            phone: sanitizedData.phone,
            emergency_contact: sanitizedData.emergency_contact,
            tenant_id: (tournament as any)?.tenant_id as string,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        playerId = newPlayer.id;
      }

      // Register for tournament
      const { error: registrationError } = await supabase
        .from('tournament_registrations')
        .insert({
          tournament_id: tournamentId,
          player_id: playerId,
          notes: sanitizedData.notes
        });

      if (registrationError) {
        if (registrationError.code === '23505') { // Unique constraint violation
          toast({
            title: "Bereits registriert",
            description: "Sie sind bereits für dieses Turnier registriert.",
            variant: "destructive"
          });
        } else {
          throw registrationError;
        }
        setLoading(false);
        return;
      }

      toast({
        title: "Registrierung erfolgreich!",
        description: `Sie wurden für ${tournament?.name} registriert.`,
      });

      onRegistrationComplete();
      onOpenChange(false);
      
      // Reset form
      setPlayerData({
        name: "",
        email: "",
        handicap: 0,
        phone: "",
        emergency_contact: "",
        notes: ""
      });

    } catch (error) {
      console.error('Registration error:', error);
      toast({
        title: "Registrierung fehlgeschlagen",
        description: "Etwas ist schief gelaufen. Bitte versuchen Sie es erneut.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Turnier-Registrierung</DialogTitle>
          <DialogDescription>
            Vervollständigen Sie Ihre Registrierung für {tournament?.name}
          </DialogDescription>
        </DialogHeader>

        {tournament && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{tournament.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Platz:</span> {tournament.course}
                </div>
                <div>
                  <span className="font-medium">Format:</span> {getFormatDisplay(tournament.format)}
                </div>
                <div>
                  <span className="font-medium">Startdatum:</span> {new Date(tournament.start_date).toLocaleDateString()}
                </div>
                <div>
                  <span className="font-medium">Max. Spieler:</span> {tournament.max_players}
                </div>
                {tournament.entry_fee && tournament.entry_fee > 0 && (
                  <div className="col-span-2">
                    <span className="font-medium">Startgeld:</span> ${tournament.entry_fee}
                  </div>
                )}
              </div>
              {tournament.description && (
                <p className="text-sm text-muted-foreground mt-3">{tournament.description}</p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="h-5 w-5" />
              Spieler-Informationen
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Vollständiger Name *</Label>
                <Input
                  id="name"
                  value={playerData.name}
                  onChange={(e) => setPlayerData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Geben Sie Ihren vollständigen Namen ein"
                />
              </div>
              
              <div>
                <Label htmlFor="email">E-Mail-Adresse *</Label>
                <Input
                  id="email"
                  type="email"
                  value={playerData.email}
                  onChange={(e) => setPlayerData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Geben Sie Ihre E-Mail ein"
                />
              </div>
              
              <div>
                <Label htmlFor="handicap">Golf-Handicap *</Label>
                <Input
                  id="handicap"
                  type="number"
                  min="0"
                  max="36"
                  value={playerData.handicap}
                  onChange={(e) => setPlayerData(prev => ({ ...prev, handicap: parseInt(e.target.value) || 0 }))}
                  placeholder="0"
                />
              </div>
              
              <div>
                <Label htmlFor="phone">Telefonnummer</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={playerData.phone}
                  onChange={(e) => setPlayerData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Geben Sie Ihre Telefonnummer ein"
                />
              </div>
              
              <div className="md:col-span-2">
                <Label htmlFor="emergency_contact">Notfallkontakt</Label>
                <Input
                  id="emergency_contact"
                  value={playerData.emergency_contact}
                  onChange={(e) => setPlayerData(prev => ({ ...prev, emergency_contact: e.target.value }))}
                  placeholder="Name und Telefonnummer des Notfallkontakts"
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Zusätzliche Anmerkungen (Optional)</Label>
            <Textarea
              id="notes"
              value={playerData.notes}
              onChange={(e) => setPlayerData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Besondere Wünsche oder Diätanforderungen..."
              rows={3}
            />
          </div>

          {tournament?.entry_fee && tournament.entry_fee > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Dieses Turnier hat ein Startgeld von ${tournament.entry_fee}. Zahlungsdetails werden nach der Registrierung bereitgestellt.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleRegister} disabled={loading}>
            {loading ? "Registriere..." : "Registrierung abschließen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}