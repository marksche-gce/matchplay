import { Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useCurrentTenant } from '@/hooks/useCurrentTenant';

export function TenantDisplay() {
  const { currentTenant, loading } = useCurrentTenant();

  if (loading) {
    return (
      <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm border rounded-lg px-3 py-2 shadow-sm">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <div className="h-4 w-20 bg-muted animate-pulse rounded"></div>
      </div>
    );
  }

  if (!currentTenant) {
    return null;
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'system_admin': return 'bg-destructive text-destructive-foreground';
      case 'tenant_admin': return 'bg-purple-500 text-white';
      case 'organizer': return 'bg-primary text-primary-foreground';
      case 'manager': return 'bg-blue-500 text-white';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'system_admin': return 'System';
      case 'tenant_admin': return 'Admin';
      case 'organizer': return 'Org';
      case 'manager': return 'Mgr';
      default: return role;
    }
  };

  return (
    <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm border rounded-lg px-3 py-2 shadow-sm">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground truncate max-w-32">
          {currentTenant.tenant_name}
        </span>
        <Badge className={`text-xs px-1.5 py-0.5 ${getRoleBadgeColor(currentTenant.role)}`}>
          {getRoleDisplayName(currentTenant.role)}
        </Badge>
      </div>
    </div>
  );
}