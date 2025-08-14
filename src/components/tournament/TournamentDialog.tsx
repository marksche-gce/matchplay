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
        title: "Fehlende Informationen",
        description: "Bitte füllen Sie alle Pflichtfelder aus.",
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
        title: "Turnier erstellt",
        description: `${formData.name} wurde erfolgreich mit generiertem Bracket erstellt.`,
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
        title: "Fehler",
        description: "Turnier konnte nicht erstellt werden. Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getRoundsForPlayers = (maxPlayers: number): number => {
    switch (maxPlayers) {
      case 8: return 3;   // quarterfinal, semifinal and final
      case 16: return 4;  // Round of 8, quarterfinal, semifinal and final
      case 32: return 5;  // Round of 16, Round of 8, quarterfinal, semifinal and final
      case 64: return 6;  // Round of 32, Round of 16, Round of 8, quarterfinal, semifinal and final
      case 128: return 7; // Round of 64, Round of 32, Round of 16, Round of 8, quarterfinal, semifinal and final
      default: return Math.ceil(Math.log2(maxPlayers));
    }
  };

  const calculateMaxRounds = (maxPlayers: number): number => {
    return Math.ceil(Math.log2(maxPlayers));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Turnier erstellen</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Turniername *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Frühjahrs-Meisterschaft 2024"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="type">Turnierart</Label>
            <Select value={formData.type} onValueChange={(value: 'singles' | 'foursome') => setFormData({ ...formData, type: value })}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="singles">Einzel Match Play</SelectItem>
                <SelectItem value="foursome">Vierer Match Play</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {formData.type === 'singles' ? 'Zwei Spieler treten gegeneinander an' : 'Zwei Teams mit je zwei Spielern treten gegeneinander an'}
            </p>
          </div>

          <div>
            <Label htmlFor="maxPlayers">Maximum {formData.type === 'singles' ? 'Spieler' : 'Teams'}</Label>
            <Select value={formData.maxPlayers.toString()} onValueChange={(value) => setFormData({ ...formData, maxPlayers: parseInt(value) })}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="8">8 (3 Runden - Viertelfinale, Halbfinale, Finale)</SelectItem>
                <SelectItem value="16">16 (4 Runden - Achtelfinale, Viertelfinale, Halbfinale, Finale)</SelectItem>
                <SelectItem value="32">32 (5 Runden - Sechzehntelfinale, Achtelfinale, Viertelfinale, Halbfinale, Finale)</SelectItem>
                <SelectItem value="64">64 (6 Runden - Zweiunddreißigstelfinale, Sechzehntelfinale, Achtelfinale, Viertelfinale, Halbfinale, Finale)</SelectItem>
                <SelectItem value="128">128 (7 Runden - Vierundsechzigstelfinale, Zweiunddreißigstelfinale, Sechzehntelfinale, Achtelfinale, Viertelfinale, Halbfinale, Finale)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Startdatum *</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="endDate">Enddatum *</Label>
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
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading} variant="default">
              {loading ? 'Turnier wird erstellt & Bracket generiert...' : 'Turnier erstellen'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}