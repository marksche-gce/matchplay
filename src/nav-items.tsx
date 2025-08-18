import { HomeIcon, Trophy, Building2 } from "lucide-react";
import Index from "@/pages/Index";
import { MatchPlayTournaments } from "@/pages/MatchPlayTournaments";
import TenantManagement from "@/pages/TenantManagement";

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
    title: "Mandanten",
    to: "/tenant-management",
    icon: <Building2 className="h-4 w-4" />,
    page: <TenantManagement />,
  },
];