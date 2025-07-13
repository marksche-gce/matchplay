import { HomeIcon, Trophy } from "lucide-react";
import Index from "@/pages/Index";
import { TournamentRegistration } from "@/pages/TournamentRegistration";

export const navItems = [
  {
    title: "Dashboard",
    to: "/",
    icon: <HomeIcon className="h-4 w-4" />,
    page: <Index />,
  },
  {
    title: "Tournament Registration",
    to: "/register",
    icon: <Trophy className="h-4 w-4" />,
    page: <TournamentRegistration />,
  },
];