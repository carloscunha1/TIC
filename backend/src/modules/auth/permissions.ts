import type { UserRole } from '@prisma/client';

export const permissions = {
  auditRead: 'audit.read',
  categoriesManage: 'categories.manage',
  categoriesRead: 'categories.read',
  customersManage: 'customers.manage',
  dashboardView: 'dashboard.view',
  entriesManage: 'entries.manage',
  loyaltyPolicyManage: 'loyalty-policy.manage',
  loyaltyRead: 'loyalty.read',
  productsManage: 'products.manage',
  productsRead: 'products.read',
  reportsRead: 'reports.read',
  salesManage: 'sales.manage',
  settingsManage: 'settings.manage',
  stockManage: 'stock.manage',
  suppliersManage: 'suppliers.manage',
  suppliersRead: 'suppliers.read',
  usersManage: 'users.manage',
} as const;

export type Permission = (typeof permissions)[keyof typeof permissions];

const allPermissions: Permission[] = Object.values(permissions);

const rolePermissions: Record<UserRole, Permission[]> = {
  ADMIN: allPermissions,
  OPERATOR: [
    permissions.dashboardView,
    permissions.categoriesManage,
    permissions.categoriesRead,
    permissions.customersManage,
    permissions.entriesManage,
    permissions.loyaltyRead,
    permissions.productsManage,
    permissions.productsRead,
    permissions.reportsRead,
    permissions.salesManage,
    permissions.stockManage,
    permissions.suppliersManage,
    permissions.suppliersRead,
  ],
  VIEWER: [
    permissions.dashboardView,
    permissions.categoriesRead,
    permissions.loyaltyRead,
    permissions.productsRead,
    permissions.reportsRead,
    permissions.suppliersRead,
  ],
};

export function getPermissionsForRole(role: UserRole): Permission[] {
  return rolePermissions[role] ?? [];
}

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return getPermissionsForRole(role).includes(permission);
}
