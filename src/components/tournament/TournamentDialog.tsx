import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BracketGenerator } from '@/lib/bracketGenerator';

interface TournamentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TournamentFormData {
  name: string;
  type: 'singles' | 'foursome';
  maxPlayers: number;
  startDate: string;
  endDate: string;
}

export function TournamentDialog({ open, onOpenChange }: TournamentDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<TournamentFormData>({
    name: '',
    type: 'singles',
    maxPlayers: 16,
    startDate: '',
    endDate: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.startDate || !formData.endDate) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      // Create tournament (max_rounds is generated automatically by database)
      const { data: tournamentData, error } = await supabase.from('tournaments_new').insert({
        name: formData.name,
        type: formData.type,
        max_players: formData.maxPlayers,
        start_date: formData.startDate,
        end_date: formData.endDate,
        registration_status: 'open',
      }).select().single();

      if (error) throw error;

      // Automatically generate bracket for the new tournament
      const generator = new BracketGenerator();
      await generator.generateBracket(tournamentData.id, {
        id: tournamentData.id,
        type: formData.type,
        max_players: formData.maxPlayers,
        max_rounds: tournamentData.max_rounds, // Use the generated value from database
      });

      toast({
        title: "Tournament Created",
        description: `${formData.name} has been created successfully with bracket generated.`,
      });

      // Reset form and close dialog
      setFormData({
        name: '',
        type: 'singles',
        maxPlayers: 16,
        startDate: '',
        endDate: '',
      });
      onOpenChange(false);
      
      // Refresh page to show new tournament
      window.location.reload();
      
    } catch (error) {
      console.error('Error creating tournament:', error);
      toast({
        title: "Error",
        description: "Failed to create tournament. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getRoundsForPlayers = (maxPlayers: number): number => {
    switch (maxPlayers) {
      case 8: return 2;   // semifinal and final
      case 16: return 3;  // quarterfinal, semifinal and final
      case 32: return 4;  // Round of 16, quarterfinal, semifinal and final
      case 64: return 5;  // Round of 32, Round of 16, quarterfinal, semifinal and final
      case 128: return 6; // Round of 64, Round of 32, Round of 16, quarterfinal, semifinal and final
      default: return Math.ceil(Math.log2(maxPlayers)) - 1;
    }
  };

  const calculateMaxRounds = (maxPlayers: number): number => {
    return Math.ceil(Math.log2(maxPlayers)) - 1;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Tournament</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Tournament Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Spring Championship 2024"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="type">Tournament Type</Label>
            <Select value={formData.type} onValueChange={(value: 'singles' | 'foursome') => setFormData({ ...formData, type: value })}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="singles">Singles Match Play</SelectItem>
                <SelectItem value="foursome">Foursome Match Play</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {formData.type === 'singles' ? 'Two players compete against each other' : 'Two teams of two players each compete'}
            </p>
          </div>

          <div>
            <Label htmlFor="maxPlayers">Maximum {formData.type === 'singles' ? 'Players' : 'Teams'}</Label>
            <Select value={formData.maxPlayers.toString()} onValueChange={(value) => setFormData({ ...formData, maxPlayers: parseInt(value) })}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="8">8 (2 rounds - Semifinal, Final)</SelectItem>
                <SelectItem value="16">16 (3 rounds - Quarterfinal, Semifinal, Final)</SelectItem>
                <SelectItem value="32">32 (4 rounds - Round of 16, Quarterfinal, Semifinal, Final)</SelectItem>
                <SelectItem value="64">64 (5 rounds - Round of 32, Round of 16, Quarterfinal, Semifinal, Final)</SelectItem>
                <SelectItem value="128">128 (6 rounds - Round of 64, Round of 32, Round of 16, Quarterfinal, Semifinal, Final)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="endDate">End Date *</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} variant="default">
              {loading ? 'Creating Tournament & Generating Bracket...' : 'Create Tournament'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}