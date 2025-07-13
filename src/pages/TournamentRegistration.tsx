import { useState } from "react";
import { TournamentList } from "@/components/TournamentList";
import { TournamentRegistrationDialog } from "@/components/TournamentRegistrationDialog";

export function TournamentRegistration() {
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [showRegistrationDialog, setShowRegistrationDialog] = useState(false);

  const handleRegister = (tournamentId: string) => {
    setSelectedTournamentId(tournamentId);
    setShowRegistrationDialog(true);
  };

  const handleRegistrationComplete = () => {
    // Refresh the tournament list to show updated registration counts
    window.location.reload();
  };

  return (
    <>
      <TournamentList onRegister={handleRegister} />
      
      <TournamentRegistrationDialog
        open={showRegistrationDialog}
        onOpenChange={setShowRegistrationDialog}
        tournamentId={selectedTournamentId}
        onRegistrationComplete={handleRegistrationComplete}
      />
    </>
  );
}