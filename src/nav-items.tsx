import { HomeIcon, Trophy } from "lucide-react";
import Index from "@/pages/Index";
import { MatchPlayTournaments } from "@/pages/MatchPlayTournaments";

export const navItems = [
  {
    title: "Home",
    to: "/",
    icon: <HomeIcon className="h-4 w-4" />,
    page: <Index />,
  },
  {
    title: "Tournaments",
    to: "/tournaments",
    icon: <Trophy className="h-4 w-4" />,
    page: <MatchPlayTournaments />,
  },
];