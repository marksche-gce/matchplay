import { HomeIcon, Trophy, Crown } from "lucide-react";
import Index from "@/pages/Index";
import { MatchPlayTournaments } from "@/pages/MatchPlayTournaments";
import SystemAdmin from "@/pages/SystemAdmin";

export const navItems = [
  {
    title: "Startseite",
    to: "/",
    icon: <HomeIcon className="h-4 w-4" />,
    page: <Index />,
  },
  {
    title: "Turniere",
    to: "/tournaments",
    icon: <Trophy className="h-4 w-4" />,
    page: <MatchPlayTournaments />,
  },
  {
    title: "System-Admin",
    to: "/system-admin",
    icon: <Crown className="h-4 w-4" />,
    page: <SystemAdmin />,
  },
];