import { Building2 } from 'lucide-react';
import { useCurrentTenant } from '@/hooks/useCurrentTenant';

export function TenantName() {
  const { currentTenant, loading } = useCurrentTenant();

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <div className="h-4 w-20 bg-muted animate-pulse rounded"></div>
      </div>
    );
  }

  if (!currentTenant) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium text-foreground truncate max-w-32">
        {currentTenant.tenant_name}
      </span>
    </div>
  );
}