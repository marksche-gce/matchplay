import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, Users } from 'lucide-react';

interface Tournament {
  type: 'singles' | 'foursome';
}

interface Match {
  id: string;
  match_number: number;
}

interface Player {
  id: string;
  name: string;
  handicap: number;
}

interface Team {
  id: string;
  name: string;
  player1?: Player;
  player2?: Player;
}

interface SetWinnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: Match;
  tournament: Tournament;
  player1?: Player | null;
  player2?: Player | null;
  team1?: Team | null;
  team2?: Team | null;
  onSetWinner: (winnerId: string) => void;
}

export function SetWinnerDialog({
  open,
  onOpenChange,
  match,
  tournament,
  player1,
  player2,
  team1,
  team2,
  onSetWinner
}: SetWinnerDialogProps) {
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Spielgewinner setzen</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Wählen Sie den Gewinner von Spiel {match.match_number}
          </p>
        </DialogHeader>
        
        <div className="space-y-3">
          {tournament.type === 'singles' ? (
            <>
              {player1 && (
                <Button
                  onClick={() => onSetWinner(player1.id)}
                  variant="outline"
                  className="w-full justify-start h-auto p-4 hover:bg-success/10 hover:border-success/30"
                >
                  <div className="flex items-center gap-3">
                    <Crown className="h-5 w-5 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">{player1.name}</p>
                      <p className="text-xs text-muted-foreground">Handicap: {player1.handicap}</p>
                    </div>
                  </div>
                </Button>
              )}
              
              {player2 && (
                <Button
                  onClick={() => onSetWinner(player2.id)}
                  variant="outline"
                  className="w-full justify-start h-auto p-4 hover:bg-success/10 hover:border-success/30"
                >
                  <div className="flex items-center gap-3">
                    <Crown className="h-5 w-5 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">{player2.name}</p>
                      <p className="text-xs text-muted-foreground">Handicap: {player2.handicap}</p>
                    </div>
                  </div>
                </Button>
              )}
            </>
          ) : (
            <>
              {team1 && (
                <Button
                  onClick={() => onSetWinner(team1.id)}
                  variant="outline"
                  className="w-full justify-start h-auto p-4 hover:bg-success/10 hover:border-success/30"
                >
                  <div className="flex items-center gap-3">
                    <Crown className="h-5 w-5 text-primary" />
                    <div className="text-left">
                      <p className="font-medium flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {team1.name}
                      </p>
                      {team1.player1 && team1.player2 && (
                        <p className="text-xs text-muted-foreground">
                          {team1.player1.name} & {team1.player2.name}
                        </p>
                      )}
                    </div>
                  </div>
                </Button>
              )}
              
              {team2 && (
                <Button
                  onClick={() => onSetWinner(team2.id)}
                  variant="outline"
                  className="w-full justify-start h-auto p-4 hover:bg-success/10 hover:border-success/30"
                >
                  <div className="flex items-center gap-3">
                    <Crown className="h-5 w-5 text-primary" />
                    <div className="text-left">
                      <p className="font-medium flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {team2.name}
                      </p>
                      {team2.player1 && team2.player2 && (
                        <p className="text-xs text-muted-foreground">
                          {team2.player1.name} & {team2.player2.name}
                        </p>
                      )}
                    </div>
                  </div>
                </Button>
              )}
            </>
          )}
        </div>
        
        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}