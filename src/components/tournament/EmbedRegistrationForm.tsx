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
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !email.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in both name and email fields.",
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
          title: "Already Registered",
          description: "You are already registered for this tournament.",
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
        title: "Registration Successful!",
        description: `You have been registered for ${tournament.name}.`,
      });

      // Reset form
      setName('');
      setEmail('');
      setHandicap('');
      
      onRegistrationComplete();
      
    } catch (error: any) {
      console.error('Registration error:', error);
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to register. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
    <div className="min-h-screen bg-background">
      {/* Tournament Header */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/20 border-b">
        <div className="max-w-4xl mx-auto p-6">
          <div className="space-y-4">
            <h1 className="text-3xl font-bold text-foreground">{tournament.name}</h1>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(new Date(tournament.start_date), 'MMM dd')} - {format(new Date(tournament.end_date), 'MMM dd, yyyy')}
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {registrationCount}/{tournament.max_players} Players
              </div>
              <div className="flex items-center gap-1">
                <Trophy className="h-4 w-4" />
                {tournament.type === 'singles' ? 'Singles' : 'Foursome'}
              </div>
              <Badge className={getRegistrationStatusColor(tournament.registration_status)}>
                {tournament.registration_status === 'open' ? 'Open for Registration' : 
                 tournament.registration_status === 'closed' ? 'Registration Closed' : 
                 'Tournament Full'}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Registration Form */}
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Tournament Registration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {isRegistrationClosed || isFull ? (
              <div className="text-center py-8">
                <div className="mb-4">
                  {isFull ? (
                    <Badge className="bg-warning/10 text-warning border-warning/30 text-lg px-4 py-2">
                      Tournament Full
                    </Badge>
                  ) : (
                    <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-lg px-4 py-2">
                      Registration Closed
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">
                  {isFull 
                    ? 'This tournament has reached its maximum capacity.' 
                    : 'Registration for this tournament has ended.'}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your full name"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="handicap">Golf Handicap</Label>
                  <Input
                    id="handicap"
                    type="number"
                    step="0.1"
                    value={handicap}
                    onChange={(e) => setHandicap(e.target.value)}
                    placeholder="Enter your handicap (optional)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank if you don't have a handicap
                  </p>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>Tournament Details:</strong><br />
                    • Format: {tournament.type === 'singles' ? 'Singles Match Play' : 'Foursome Match Play'}<br />
                    • Maximum Players: {tournament.max_players}<br />
                    • Current Registrations: {registrationCount}<br />
                    • Available Spots: {tournament.max_players - registrationCount}
                  </p>
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading}
                  size="lg"
                >
                  {loading ? 'Registering...' : 'Register for Tournament'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}