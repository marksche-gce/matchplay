// Player data types for secure access

// Main player interface with optional sensitive fields
export interface Player {
  id: string;
  name: string;
  handicap: number;
  wins: number;
  losses: number;
  status: "active" | "eliminated" | "champion";
  created_at?: string;
  updated_at?: string;
  // These fields are only populated based on access level
  email?: string;
  phone?: string;
  emergency_contact?: string;
  user_id?: string;
}

// Type guard to check if player has full data access
export function hasFullPlayerAccess(player: Player): boolean {
  return player.email !== null && player.email !== undefined;
}

// Database view type matching the secure view
export interface PlayerSecureView {
  id: string;
  name: string;
  handicap: number;
  email: string | null;
  phone: string | null;
  emergency_contact: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}