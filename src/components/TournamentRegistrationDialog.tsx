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
        title: "Error",
        description: "Failed to load tournament details.",
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
          title: "Authentication Required",
          description: "Please sign in to register for tournaments.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Validation
      if (!playerData.name.trim() || !playerData.email.trim()) {
        toast({
          title: "Missing Information",
          description: "Please fill in all required fields.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      if (!validateEmail(playerData.email)) {
        toast({
          title: "Invalid Email",
          description: "Please enter a valid email address.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      if (!validatePhone(playerData.phone)) {
        toast({
          title: "Invalid Phone Number",
          description: "Please enter a valid phone number.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      if (!validateHandicap(playerData.handicap)) {
        toast({
          title: "Invalid Handicap",
          description: "Handicap must be between 0 and 36.",
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
            emergency_contact: sanitizedData.emergency_contact
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
            title: "Already Registered",
            description: "You are already registered for this tournament.",
            variant: "destructive"
          });
        } else {
          throw registrationError;
        }
        setLoading(false);
        return;
      }

      toast({
        title: "Registration Successful!",
        description: `You have been registered for ${tournament?.name}.`,
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
        title: "Registration Failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getFormatDisplay = (format: string) => {
    switch (format) {
      case "matchplay": return "Match Play";
      case "strokeplay": return "Stroke Play";
      case "scramble": return "Scramble";
      default: return format;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tournament Registration</DialogTitle>
          <DialogDescription>
            Complete your registration for {tournament?.name}
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
                  <span className="font-medium">Course:</span> {tournament.course}
                </div>
                <div>
                  <span className="font-medium">Format:</span> {getFormatDisplay(tournament.format)}
                </div>
                <div>
                  <span className="font-medium">Start Date:</span> {new Date(tournament.start_date).toLocaleDateString()}
                </div>
                <div>
                  <span className="font-medium">Max Players:</span> {tournament.max_players}
                </div>
                {tournament.entry_fee && tournament.entry_fee > 0 && (
                  <div className="col-span-2">
                    <span className="font-medium">Entry Fee:</span> ${tournament.entry_fee}
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
              Player Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={playerData.name}
                  onChange={(e) => setPlayerData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter your full name"
                />
              </div>
              
              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={playerData.email}
                  onChange={(e) => setPlayerData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter your email"
                />
              </div>
              
              <div>
                <Label htmlFor="handicap">Golf Handicap *</Label>
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
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={playerData.phone}
                  onChange={(e) => setPlayerData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Enter your phone number"
                />
              </div>
              
              <div className="md:col-span-2">
                <Label htmlFor="emergency_contact">Emergency Contact</Label>
                <Input
                  id="emergency_contact"
                  value={playerData.emergency_contact}
                  onChange={(e) => setPlayerData(prev => ({ ...prev, emergency_contact: e.target.value }))}
                  placeholder="Name and phone number of emergency contact"
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={playerData.notes}
              onChange={(e) => setPlayerData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Any special requests or dietary requirements..."
              rows={3}
            />
          </div>

          {tournament?.entry_fee && tournament.entry_fee > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This tournament has an entry fee of ${tournament.entry_fee}. Payment details will be provided after registration.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleRegister} disabled={loading}>
            {loading ? "Registering..." : "Complete Registration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}