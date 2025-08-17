import { useState } from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useTenant } from '@/hooks/useTenantContext';

export function TenantSelector() {
  const { currentTenant, userTenants, switchTenant } = useTenant();

  if (userTenants.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{currentTenant?.name || 'Kein Mandant'}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="text-sm">{currentTenant?.name || 'Mandant wählen'}</span>
          </div>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {userTenants.map((tenant) => (
          <DropdownMenuItem
            key={tenant.tenant_id}
            onClick={() => switchTenant(tenant.tenant_id)}
            className="flex items-center justify-between"
          >
            <div className="flex flex-col gap-1">
              <span className="font-medium">{tenant.tenant_name}</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {tenant.user_role === 'tenant_admin' ? 'Admin' : 
                   tenant.user_role === 'organizer' ? 'Organizer' : 'Spieler'}
                </Badge>
              </div>
            </div>
            {currentTenant?.id === tenant.tenant_id && (
              <Check className="h-4 w-4" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}