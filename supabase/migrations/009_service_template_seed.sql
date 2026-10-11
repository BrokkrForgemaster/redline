-- ============================================================
-- Service Template Seed Data
-- Migration: 009_service_template_seed.sql
-- Inserts seed data for service types, template lineages,
-- versions, sections, and items. No DDL — tables from 007.
-- ============================================================

-- Service types
INSERT INTO service_types (id, code, name, description, active) VALUES
  ('aa000001-0000-0000-0000-000000000001', 'mowing',    'Mowing Service',      'Lawn mowing, trimming, edging and blowing', true),
  ('aa000001-0000-0000-0000-000000000002', 'snow',      'Snow & Ice Service',  'Plowing, salting and sidewalk clearing',     true),
  ('aa000001-0000-0000-0000-000000000003', 'landscape', 'Landscaping',         'Planting, mulching, bed work, hardscape',   true),
  ('aa000001-0000-0000-0000-000000000004', 'general',   'General Maintenance', 'Cleanups, inspections, miscellaneous',      true)
ON CONFLICT (id) DO NOTHING;

-- Template lineages
INSERT INTO service_template_lineages (id, service_type_id, name, active) VALUES
  ('aa000002-0000-0000-0000-000000000001', 'aa000001-0000-0000-0000-000000000001', 'Standard Mowing',    true),
  ('aa000002-0000-0000-0000-000000000002', 'aa000001-0000-0000-0000-000000000002', 'Standard Snow',      true),
  ('aa000002-0000-0000-0000-000000000003', 'aa000001-0000-0000-0000-000000000003', 'Standard Landscape', true),
  ('aa000002-0000-0000-0000-000000000004', 'aa000001-0000-0000-0000-000000000004', 'Standard General',   true)
ON CONFLICT (id) DO NOTHING;

-- Template versions (active = frozen)
INSERT INTO service_template_versions (id, lineage_id, version_number, status, frozen_at) VALUES
  ('aa000003-0000-0000-0000-000000000001', 'aa000002-0000-0000-0000-000000000001', 1, 'active', NOW()),
  ('aa000003-0000-0000-0000-000000000002', 'aa000002-0000-0000-0000-000000000002', 1, 'active', NOW()),
  ('aa000003-0000-0000-0000-000000000003', 'aa000002-0000-0000-0000-000000000003', 1, 'active', NOW()),
  ('aa000003-0000-0000-0000-000000000004', 'aa000002-0000-0000-0000-000000000004', 1, 'active', NOW())
ON CONFLICT (id) DO NOTHING;

-- ── Mowing checklist ──────────────────────────────────────────

INSERT INTO checklist_sections (id, template_version_id, title, sort_order) VALUES
  ('aa000004-0000-0000-0000-000000000001', 'aa000003-0000-0000-0000-000000000001', 'Site Work', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO checklist_items (id, section_id, label, response_type, required, sort_order) VALUES
  ('aa000005-0000-0000-0000-000000000001', 'aa000004-0000-0000-0000-000000000001', 'Mow all turf areas',             'checkbox', true,  0),
  ('aa000005-0000-0000-0000-000000000002', 'aa000004-0000-0000-0000-000000000001', 'Trim / weed eat',                'checkbox', true,  1),
  ('aa000005-0000-0000-0000-000000000003', 'aa000004-0000-0000-0000-000000000001', 'Blow sidewalks & parking areas', 'checkbox', true,  2),
  ('aa000005-0000-0000-0000-000000000004', 'aa000004-0000-0000-0000-000000000001', 'Check & clean planting beds',    'checkbox', false, 3),
  ('aa000005-0000-0000-0000-000000000005', 'aa000004-0000-0000-0000-000000000001', 'Remove all debris & clippings',  'checkbox', true,  4),
  ('aa000005-0000-0000-0000-000000000006', 'aa000004-0000-0000-0000-000000000001', 'Gate / access locked on exit',   'checkbox', true,  5),
  ('aa000005-0000-0000-0000-000000000007', 'aa000004-0000-0000-0000-000000000001', 'Damage or issues to report',     'text',     false, 6)
ON CONFLICT (id) DO NOTHING;

-- ── Snow checklist ────────────────────────────────────────────

INSERT INTO checklist_sections (id, template_version_id, title, sort_order) VALUES
  ('aa000004-0000-0000-0000-000000000002', 'aa000003-0000-0000-0000-000000000002', 'Plowing',  0),
  ('aa000004-0000-0000-0000-000000000003', 'aa000003-0000-0000-0000-000000000002', 'Walks',    1),
  ('aa000004-0000-0000-0000-000000000004', 'aa000003-0000-0000-0000-000000000002', 'De-Icing', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO checklist_items (id, section_id, label, response_type, required, sort_order) VALUES
  ('aa000005-0000-0000-0000-000000000010', 'aa000004-0000-0000-0000-000000000002', 'Main lots & drive lanes cleared',  'checkbox', true,  0),
  ('aa000005-0000-0000-0000-000000000011', 'aa000004-0000-0000-0000-000000000002', 'Dumpster & service areas cleared', 'checkbox', false, 1),
  ('aa000005-0000-0000-0000-000000000012', 'aa000004-0000-0000-0000-000000000002', 'Handicap spaces cleared',          'checkbox', true,  2),
  ('aa000005-0000-0000-0000-000000000013', 'aa000004-0000-0000-0000-000000000003', 'Main entrance sidewalks cleared',  'checkbox', true,  0),
  ('aa000005-0000-0000-0000-000000000014', 'aa000004-0000-0000-0000-000000000003', 'All exits & emergency exits',      'checkbox', true,  1),
  ('aa000005-0000-0000-0000-000000000015', 'aa000004-0000-0000-0000-000000000004', 'De-icer applied to priority areas','checkbox', false, 0),
  ('aa000005-0000-0000-0000-000000000016', 'aa000004-0000-0000-0000-000000000004', 'Areas unable to be serviced',      'text',     false, 1)
ON CONFLICT (id) DO NOTHING;

-- ── Landscape checklist ───────────────────────────────────────

INSERT INTO checklist_sections (id, template_version_id, title, sort_order) VALUES
  ('aa000004-0000-0000-0000-000000000005', 'aa000003-0000-0000-0000-000000000003', 'Installation & Cleanup', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO checklist_items (id, section_id, label, response_type, required, sort_order) VALUES
  ('aa000005-0000-0000-0000-000000000020', 'aa000004-0000-0000-0000-000000000005', 'All plants/materials installed per plan', 'checkbox', true,  0),
  ('aa000005-0000-0000-0000-000000000021', 'aa000004-0000-0000-0000-000000000005', 'Mulch applied at correct depth',         'checkbox', false, 1),
  ('aa000005-0000-0000-0000-000000000022', 'aa000004-0000-0000-0000-000000000005', 'All debris removed from site',           'checkbox', true,  2),
  ('aa000005-0000-0000-0000-000000000023', 'aa000004-0000-0000-0000-000000000005', 'Customer walkthrough completed',         'checkbox', false, 3),
  ('aa000005-0000-0000-0000-000000000024', 'aa000004-0000-0000-0000-000000000005', 'Notes / issues observed',                'text',     false, 4)
ON CONFLICT (id) DO NOTHING;

-- ── General maintenance checklist ─────────────────────────────

INSERT INTO checklist_sections (id, template_version_id, title, sort_order) VALUES
  ('aa000004-0000-0000-0000-000000000006', 'aa000003-0000-0000-0000-000000000004', 'General Tasks', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO checklist_items (id, section_id, label, response_type, required, sort_order) VALUES
  ('aa000005-0000-0000-0000-000000000030', 'aa000004-0000-0000-0000-000000000006', 'Tasks completed as described', 'checkbox', true,  0),
  ('aa000005-0000-0000-0000-000000000031', 'aa000004-0000-0000-0000-000000000006', 'Site left clean & secure',     'checkbox', true,  1),
  ('aa000005-0000-0000-0000-000000000032', 'aa000004-0000-0000-0000-000000000006', 'Issues or observations',       'text',     false, 2)
ON CONFLICT (id) DO NOTHING;
