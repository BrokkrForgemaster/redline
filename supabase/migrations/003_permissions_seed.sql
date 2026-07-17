-- ============================================================
-- Redline – Permissions & Role Permission Defaults
-- Migration: 003_permissions_seed.sql
-- ============================================================

INSERT INTO permissions (name, description) VALUES
  ('customers.view',           'View customer records'),
  ('customers.create',         'Create new customers'),
  ('customers.edit',           'Edit customer information'),
  ('customers.archive',        'Archive or restore customers'),
  ('customers.export',         'Export customer data'),
  ('properties.view',          'View property records'),
  ('properties.edit',          'Create and edit properties'),
  ('leads.view',               'View lead pipeline'),
  ('leads.create',             'Create leads'),
  ('leads.edit',               'Edit and manage leads'),
  ('estimates.view',           'View estimates'),
  ('estimates.create',         'Create estimates'),
  ('estimates.edit',           'Edit draft estimates'),
  ('estimates.send',           'Send estimates to customers'),
  ('estimates.approve',        'Approve estimates on behalf of customer'),
  ('estimates.void',           'Void estimates'),
  ('contracts.view',           'View contracts'),
  ('contracts.manage',         'Create and manage contracts'),
  ('contracts.sign',           'Record contract signatures'),
  ('jobs.view',                'View job records'),
  ('jobs.create',              'Create jobs'),
  ('jobs.assign',              'Assign crews and employees to jobs'),
  ('jobs.complete',            'Mark jobs complete'),
  ('jobs.manage',              'Full job management'),
  ('routes.view',              'View routes'),
  ('routes.manage',            'Create and manage routes'),
  ('snow_events.view',         'View snow events'),
  ('snow_events.manage',       'Create and manage snow events'),
  ('inventory.view',           'View inventory'),
  ('inventory.adjust',         'Adjust inventory quantities'),
  ('inventory.manage',         'Full inventory management'),
  ('equipment.view',           'View equipment records'),
  ('equipment.manage',         'Create and manage equipment'),
  ('employees.view',           'View employee directory'),
  ('employees.manage',         'Manage employee accounts'),
  ('employees.invite',         'Invite new employees'),
  ('roles.manage',             'Change user roles and permissions'),
  ('invoices.view',            'View invoices'),
  ('invoices.create',          'Create invoices'),
  ('invoices.issue',           'Issue invoices to customers'),
  ('invoices.void',            'Void invoices'),
  ('payments.view',            'View payment records'),
  ('payments.record',          'Record payments'),
  ('payments.refund',          'Issue refunds'),
  ('reports.view',             'View business reports'),
  ('reports.export',           'Export report data'),
  ('gallery.view',             'View gallery management'),
  ('gallery.create',           'Create gallery projects'),
  ('gallery.edit',             'Edit gallery projects'),
  ('gallery.publish',          'Publish gallery projects'),
  ('gallery.unpublish',        'Unpublish gallery projects'),
  ('gallery.archive',          'Archive gallery projects'),
  ('gallery.delete',           'Delete gallery projects'),
  ('gallery.manage_consent',   'Manage customer photo consents'),
  ('gallery.manage_featured',  'Manage homepage featured content'),
  ('settings.manage',          'Manage business settings'),
  ('audit_logs.view',          'View audit logs')
ON CONFLICT (name) DO NOTHING;

-- Owner: all permissions
INSERT INTO role_permissions (role, permission)
SELECT 'owner', name FROM permissions
ON CONFLICT DO NOTHING;

-- Administrator: all permissions
INSERT INTO role_permissions (role, permission)
SELECT 'administrator', name FROM permissions
ON CONFLICT DO NOTHING;

-- Operations Manager
INSERT INTO role_permissions (role, permission) VALUES
  ('operations_manager', 'customers.view'),
  ('operations_manager', 'customers.create'),
  ('operations_manager', 'customers.edit'),
  ('operations_manager', 'properties.view'),
  ('operations_manager', 'properties.edit'),
  ('operations_manager', 'leads.view'),
  ('operations_manager', 'leads.create'),
  ('operations_manager', 'leads.edit'),
  ('operations_manager', 'estimates.view'),
  ('operations_manager', 'estimates.create'),
  ('operations_manager', 'estimates.edit'),
  ('operations_manager', 'estimates.send'),
  ('operations_manager', 'contracts.view'),
  ('operations_manager', 'contracts.manage'),
  ('operations_manager', 'jobs.view'),
  ('operations_manager', 'jobs.create'),
  ('operations_manager', 'jobs.assign'),
  ('operations_manager', 'jobs.complete'),
  ('operations_manager', 'jobs.manage'),
  ('operations_manager', 'routes.view'),
  ('operations_manager', 'routes.manage'),
  ('operations_manager', 'snow_events.view'),
  ('operations_manager', 'snow_events.manage'),
  ('operations_manager', 'inventory.view'),
  ('operations_manager', 'inventory.adjust'),
  ('operations_manager', 'equipment.view'),
  ('operations_manager', 'equipment.manage'),
  ('operations_manager', 'employees.view'),
  ('operations_manager', 'gallery.view'),
  ('operations_manager', 'gallery.create'),
  ('operations_manager', 'gallery.edit'),
  ('operations_manager', 'gallery.publish'),
  ('operations_manager', 'gallery.unpublish'),
  ('operations_manager', 'gallery.archive'),
  ('operations_manager', 'gallery.manage_consent'),
  ('operations_manager', 'gallery.manage_featured'),
  ('operations_manager', 'reports.view'),
  ('operations_manager', 'invoices.view'),
  ('operations_manager', 'payments.view')
ON CONFLICT DO NOTHING;

-- Office Manager
INSERT INTO role_permissions (role, permission) VALUES
  ('office_manager', 'customers.view'),
  ('office_manager', 'customers.create'),
  ('office_manager', 'customers.edit'),
  ('office_manager', 'properties.view'),
  ('office_manager', 'properties.edit'),
  ('office_manager', 'leads.view'),
  ('office_manager', 'leads.create'),
  ('office_manager', 'leads.edit'),
  ('office_manager', 'estimates.view'),
  ('office_manager', 'estimates.create'),
  ('office_manager', 'estimates.edit'),
  ('office_manager', 'estimates.send'),
  ('office_manager', 'contracts.view'),
  ('office_manager', 'contracts.manage'),
  ('office_manager', 'jobs.view'),
  ('office_manager', 'invoices.view'),
  ('office_manager', 'invoices.create'),
  ('office_manager', 'invoices.issue'),
  ('office_manager', 'payments.view'),
  ('office_manager', 'payments.record'),
  ('office_manager', 'reports.view'),
  ('office_manager', 'gallery.view'),
  ('office_manager', 'gallery.create'),
  ('office_manager', 'gallery.edit')
ON CONFLICT DO NOTHING;

-- Estimator
INSERT INTO role_permissions (role, permission) VALUES
  ('estimator', 'customers.view'),
  ('estimator', 'customers.create'),
  ('estimator', 'properties.view'),
  ('estimator', 'properties.edit'),
  ('estimator', 'leads.view'),
  ('estimator', 'leads.create'),
  ('estimator', 'leads.edit'),
  ('estimator', 'estimates.view'),
  ('estimator', 'estimates.create'),
  ('estimator', 'estimates.edit'),
  ('estimator', 'estimates.send'),
  ('estimator', 'contracts.view'),
  ('estimator', 'jobs.view')
ON CONFLICT DO NOTHING;

-- Crew Leader
INSERT INTO role_permissions (role, permission) VALUES
  ('crew_leader', 'jobs.view'),
  ('crew_leader', 'jobs.complete'),
  ('crew_leader', 'routes.view'),
  ('crew_leader', 'snow_events.view'),
  ('crew_leader', 'inventory.view'),
  ('crew_leader', 'inventory.adjust'),
  ('crew_leader', 'equipment.view'),
  ('crew_leader', 'gallery.view'),
  ('crew_leader', 'gallery.create')
ON CONFLICT DO NOTHING;

-- Crew Member
INSERT INTO role_permissions (role, permission) VALUES
  ('crew_member', 'jobs.view'),
  ('crew_member', 'routes.view'),
  ('crew_member', 'snow_events.view'),
  ('crew_member', 'inventory.view'),
  ('crew_member', 'equipment.view'),
  ('crew_member', 'gallery.create')
ON CONFLICT DO NOTHING;

-- Snow Operations Manager
INSERT INTO role_permissions (role, permission) VALUES
  ('snow_operations_manager', 'customers.view'),
  ('snow_operations_manager', 'properties.view'),
  ('snow_operations_manager', 'contracts.view'),
  ('snow_operations_manager', 'jobs.view'),
  ('snow_operations_manager', 'jobs.assign'),
  ('snow_operations_manager', 'routes.view'),
  ('snow_operations_manager', 'routes.manage'),
  ('snow_operations_manager', 'snow_events.view'),
  ('snow_operations_manager', 'snow_events.manage'),
  ('snow_operations_manager', 'inventory.view'),
  ('snow_operations_manager', 'inventory.adjust'),
  ('snow_operations_manager', 'equipment.view'),
  ('snow_operations_manager', 'employees.view'),
  ('snow_operations_manager', 'reports.view'),
  ('snow_operations_manager', 'invoices.view')
ON CONFLICT DO NOTHING;

-- Inventory Manager
INSERT INTO role_permissions (role, permission) VALUES
  ('inventory_manager', 'inventory.view'),
  ('inventory_manager', 'inventory.adjust'),
  ('inventory_manager', 'inventory.manage'),
  ('inventory_manager', 'equipment.view'),
  ('inventory_manager', 'equipment.manage'),
  ('inventory_manager', 'reports.view'),
  ('inventory_manager', 'customers.view'),
  ('inventory_manager', 'properties.view'),
  ('inventory_manager', 'jobs.view')
ON CONFLICT DO NOTHING;

-- Bookkeeper
INSERT INTO role_permissions (role, permission) VALUES
  ('bookkeeper', 'customers.view'),
  ('bookkeeper', 'estimates.view'),
  ('bookkeeper', 'contracts.view'),
  ('bookkeeper', 'jobs.view'),
  ('bookkeeper', 'invoices.view'),
  ('bookkeeper', 'invoices.create'),
  ('bookkeeper', 'invoices.issue'),
  ('bookkeeper', 'invoices.void'),
  ('bookkeeper', 'payments.view'),
  ('bookkeeper', 'payments.record'),
  ('bookkeeper', 'payments.refund'),
  ('bookkeeper', 'reports.view'),
  ('bookkeeper', 'reports.export')
ON CONFLICT DO NOTHING;

-- Read Only
INSERT INTO role_permissions (role, permission) VALUES
  ('read_only', 'customers.view'),
  ('read_only', 'properties.view'),
  ('read_only', 'leads.view'),
  ('read_only', 'estimates.view'),
  ('read_only', 'contracts.view'),
  ('read_only', 'jobs.view'),
  ('read_only', 'routes.view'),
  ('read_only', 'snow_events.view'),
  ('read_only', 'inventory.view'),
  ('read_only', 'equipment.view'),
  ('read_only', 'employees.view'),
  ('read_only', 'invoices.view'),
  ('read_only', 'payments.view'),
  ('read_only', 'reports.view'),
  ('read_only', 'gallery.view')
ON CONFLICT DO NOTHING;
