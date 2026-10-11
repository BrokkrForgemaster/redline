-- ============================================================
-- Redline Landscaping – Demo / Seed Data
-- Run this in the Supabase SQL Editor after all migrations.
-- Safe to re-run: all INSERTs use ON CONFLICT (id) DO NOTHING.
-- ============================================================

BEGIN;

-- ============================================================
-- CUSTOMERS  (8 records — 7 active, 1 inactive)
-- ============================================================
INSERT INTO customers (
  id, account_type, first_name, last_name, business_name,
  email, mobile_phone,
  billing_address_line1, billing_city, billing_state, billing_zip,
  status, customer_source, tags
) VALUES
  ('00000100-0000-0000-0000-000000000001', 'individual', 'Mike',      'Thompson',  NULL,
   'mike.thompson@gmail.com',     '859-555-0101',
   '124 Maple Drive',       'Lexington',     'KY', '40503', 'active',   'referral', ARRAY['mowing','seasonal']),
  ('00000100-0000-0000-0000-000000000002', 'individual', 'Sarah',     'Williams',  NULL,
   'sarah.williams@outlook.com',  '859-555-0202',
   '837 Ashwood Lane',      'Nicholasville', 'KY', '40356', 'active',   'website',  ARRAY['landscaping','snow']),
  ('00000100-0000-0000-0000-000000000003', 'business',  'James',     'Harrington','Lakeside HOA',
   'jharrington@lakesidehoa.org', '859-555-0303',
   '1 Lakeside Drive',      'Lexington',     'KY', '40514', 'active',   'direct',   ARRAY['commercial','snow','mowing']),
  ('00000100-0000-0000-0000-000000000004', 'individual', 'David',     'Chen',      NULL,
   'dchen@yahoo.com',             '859-555-0404',
   '2204 Tates Creek Rd',   'Lexington',     'KY', '40502', 'active',   'google',   ARRAY['landscaping']),
  ('00000100-0000-0000-0000-000000000005', 'individual', 'Patricia',  'Moore',     NULL,
   'pmoore@gmail.com',            '859-555-0505',
   '509 Cardinal Ct',       'Georgetown',    'KY', '40324', 'active',   'referral', ARRAY['mowing','mulch']),
  ('00000100-0000-0000-0000-000000000006', 'business',  'Robert',    'Banks',     'Oak Creek Apartments',
   'rbanks@oakcreekapts.com',     '859-555-0606',
   '400 Oak Creek Blvd',    'Lexington',     'KY', '40509', 'active',   'direct',   ARRAY['commercial','snow','mowing']),
  ('00000100-0000-0000-0000-000000000007', 'individual', 'Linda',     'Davis',     NULL,
   'ldavis@icloud.com',           '859-555-0707',
   '78 Ridgemont Way',      'Richmond',      'KY', '40475', 'active',   'nextdoor', ARRAY['mowing']),
  ('00000100-0000-0000-0000-000000000008', 'individual', 'Tom',       'Garrett',   NULL,
   'tgarrett@gmail.com',          '859-555-0808',
   '3310 Palomar Dr',       'Lexington',     'KY', '40513', 'inactive', 'website',  ARRAY['landscaping'])
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- PROPERTIES  (9 records)
-- ============================================================
INSERT INTO properties (
  id, customer_id,
  address_line1, city, state, zip,
  property_type, lot_size_sqft, turf_area_sqft,
  pets_on_property, active
) VALUES
  ('00000200-0000-0000-0000-000000000001', '00000100-0000-0000-0000-000000000001',
   '124 Maple Drive',       'Lexington',     'KY', '40503', 'residential',  9500,  7800, FALSE, TRUE),
  ('00000200-0000-0000-0000-000000000002', '00000100-0000-0000-0000-000000000002',
   '837 Ashwood Lane',      'Nicholasville', 'KY', '40356', 'residential', 12000,  9200, TRUE,  TRUE),
  ('00000200-0000-0000-0000-000000000003', '00000100-0000-0000-0000-000000000003',
   '1 Lakeside Drive',      'Lexington',     'KY', '40514', 'commercial',  85000, 62000, FALSE, TRUE),
  ('00000200-0000-0000-0000-000000000004', '00000100-0000-0000-0000-000000000003',
   '5 Lakeside Commons',    'Lexington',     'KY', '40514', 'commercial',  42000, 28000, FALSE, TRUE),
  ('00000200-0000-0000-0000-000000000005', '00000100-0000-0000-0000-000000000004',
   '2204 Tates Creek Rd',   'Lexington',     'KY', '40502', 'residential', 11200,  8800, FALSE, TRUE),
  ('00000200-0000-0000-0000-000000000006', '00000100-0000-0000-0000-000000000005',
   '509 Cardinal Ct',       'Georgetown',    'KY', '40324', 'residential',  8600,  6900, TRUE,  TRUE),
  ('00000200-0000-0000-0000-000000000007', '00000100-0000-0000-0000-000000000006',
   '400 Oak Creek Blvd',    'Lexington',     'KY', '40509', 'commercial', 120000, 75000, FALSE, TRUE),
  ('00000200-0000-0000-0000-000000000008', '00000100-0000-0000-0000-000000000007',
   '78 Ridgemont Way',      'Richmond',      'KY', '40475', 'residential',  7800,  6200, FALSE, TRUE),
  ('00000200-0000-0000-0000-000000000009', '00000100-0000-0000-0000-000000000008',
   '3310 Palomar Dr',       'Lexington',     'KY', '40513', 'residential',  9100,  7400, FALSE, TRUE)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- LEADS  (6 records — 3 new, 2 contacted, 1 estimate_in_progress)
-- ============================================================
INSERT INTO leads (
  id, source, first_name, last_name, email, phone,
  service_address, requested_services, status, notes
) VALUES
  ('00000300-0000-0000-0000-000000000001', 'website',  'Amanda', 'Foster',
   'amanda.foster@gmail.com',  '859-555-1001',
   '1822 Bellefonte Dr, Lexington KY 40503',
   ARRAY['lawn_mowing','fertilization'], 'new',
   'Wants weekly mowing starting spring. Has 2 dogs.'),
  ('00000300-0000-0000-0000-000000000002', 'referral', 'Jason',  'Kirk',
   'jkirk@hotmail.com',        '859-555-1002',
   '445 Pimlico Dr, Lexington KY 40517',
   ARRAY['landscaping_design','mulching'], 'new',
   'Complete front yard redesign. Budget around $4k.'),
  ('00000300-0000-0000-0000-000000000003', 'google',   'Connie', 'Sutton',
   'csutton@yahoo.com',        '859-555-1003',
   '290 Clays Mill Rd, Lexington KY 40503',
   ARRAY['snow_removal'], 'new',
   'Commercial property. Needs 24hr snow response contract.'),
  ('00000300-0000-0000-0000-000000000004', 'nextdoor', 'Greg',   'Holt',
   'greg.holt@icloud.com',     '859-555-1004',
   '718 Chinoe Rd, Lexington KY 40502',
   ARRAY['lawn_mowing','aeration'], 'contacted',
   'Left voicemail. Follow up Thursday.'),
  ('00000300-0000-0000-0000-000000000005', 'website',  'Melissa','Park',
   'mpark@gmail.com',          '859-555-1005',
   '2901 Regency Rd, Lexington KY 40503',
   ARRAY['lawn_mowing','landscaping_design'], 'contacted',
   'Site visit scheduled for next week.'),
  ('00000300-0000-0000-0000-000000000006', 'direct',   'Brandon','Shaw',
   'bshaw@corp.com',           '859-555-1006',
   '100 Corporate Way, Nicholasville KY 40356',
   ARRAY['commercial_mowing','snow_removal','fertilization'], 'estimate_in_progress',
   'Commercial complex – annual contract potential ~$18k.')
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- SUPPLIERS  (3 records)
-- ============================================================
INSERT INTO suppliers (id, company_name, contact_name, email, phone, active) VALUES
  ('00000400-0000-0000-0000-000000000001', 'SiteOne Landscape Supply', 'Derek Hollis', 'derek.hollis@siteone.com', '800-555-3001', TRUE),
  ('00000400-0000-0000-0000-000000000002', 'Home Depot Pro',           'Tina Marsh',  'tmarsh@homedepotpro.com',  '800-555-3002', TRUE),
  ('00000400-0000-0000-0000-000000000003', 'Ariens / Gravely of KY',   'Phil Norris', 'pnorris@gravely-ky.com',   '859-555-3003', TRUE)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- PRODUCTS / INVENTORY  (10 records — 3 below reorder point)
-- ============================================================
INSERT INTO products (
  id, name, category, supplier_id,
  unit_of_measure, purchase_cost, billable_price,
  reorder_point, reorder_quantity, current_quantity, active
) VALUES
  -- LOW STOCK (current_quantity <= reorder_point)
  ('00000500-0000-0000-0000-000000000001', 'Pre-Emergent Fertilizer (50 lb)',      'fertilizer',  '00000400-0000-0000-0000-000000000001',
   'bag',    28.00,  45.00, 10, 20,  4, TRUE),
  ('00000500-0000-0000-0000-000000000002', 'Rock Salt (50 lb)',                    'de-icer',     '00000400-0000-0000-0000-000000000001',
   'bag',     8.50,  14.00, 50, 100, 18, TRUE),
  ('00000500-0000-0000-0000-000000000006', 'Bar & Chain Oil (1 gal)',              'equipment',   '00000400-0000-0000-0000-000000000002',
   'gallon',  9.00,  18.00,  4,  8,  2, TRUE),
  -- IN STOCK
  ('00000500-0000-0000-0000-000000000003', 'Landscaping Mulch (2 cu ft)',          'mulch',       '00000400-0000-0000-0000-000000000001',
   'bag',     3.75,   7.00, 40, 80, 52, TRUE),
  ('00000500-0000-0000-0000-000000000004', 'Tall Fescue Grass Seed (10 lb)',       'seed',        '00000400-0000-0000-0000-000000000001',
   'bag',    22.00,  38.00,  5, 15,  9, TRUE),
  ('00000500-0000-0000-0000-000000000005', 'Roundup Pro Concentrate (1 gal)',      'herbicide',   '00000400-0000-0000-0000-000000000002',
   'gallon', 65.00, 110.00,  3,  6,  5, TRUE),
  ('00000500-0000-0000-0000-000000000007', 'Edger Blades (20-pack)',               'blades',      '00000400-0000-0000-0000-000000000002',
   'pack',   12.00,  22.00,  2,  5,  3, TRUE),
  ('00000500-0000-0000-0000-000000000008', 'Trimmer Line .095 (1 lb spool)',       'trimmer',     '00000400-0000-0000-0000-000000000002',
   'spool',   8.00,  14.00,  3,  6,  7, TRUE),
  ('00000500-0000-0000-0000-000000000009', 'Calcium Chloride Pellets (50 lb)',     'de-icer',     '00000400-0000-0000-0000-000000000001',
   'bag',    16.00,  28.00, 20, 40, 34, TRUE),
  ('00000500-0000-0000-0000-000000000010', 'Landscape Fabric (100 sq ft roll)',    'materials',   '00000400-0000-0000-0000-000000000001',
   'roll',   18.00,  32.00,  3,  6,  4, TRUE)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- ASSETS  (5 records — 2 maintenance_due)
-- ============================================================
INSERT INTO assets (
  id, asset_number, asset_type, make, model, year,
  status, purchase_date, purchase_price,
  current_mileage, last_maintenance_date, next_maintenance_date, storage_location
) VALUES
  ('00000600-0000-0000-0000-000000000001', 'VEH-001', 'truck',         'Chevrolet', 'Silverado 2500HD', 2024,
   'available',       '2024-01-15', 52000.00, 31200, '2026-07-10', '2027-01-10', 'Main Lot'),
  ('00000600-0000-0000-0000-000000000002', 'EQP-001', 'zero_turn_mower','Gravely',  'Pro-Turn 272',     2023,
   'available',       '2023-03-20', 14800.00, NULL,  '2026-08-22', '2027-01-01', 'Equipment Bay'),
  ('00000600-0000-0000-0000-000000000003', 'EQP-002', 'zero_turn_mower','Exmark',   'Lazer Z X-Series', 2022,
   'maintenance_due', '2022-04-05', 13200.00, NULL,  '2026-04-01', '2026-09-30', 'Equipment Bay'),
  ('00000600-0000-0000-0000-000000000004', 'VEH-002', 'truck',         'Ford',      'F-250 Super Duty',  2023,
   'available',       '2023-06-01', 49500.00, 48700, '2026-09-15', '2027-03-15', 'Main Lot'),
  ('00000600-0000-0000-0000-000000000005', 'EQP-003', 'salt_spreader', 'SnowEx',    'V-Maxx 8500',      2021,
   'maintenance_due', '2021-10-12',  4200.00, NULL,  '2025-11-30', '2026-09-01', 'Equipment Bay')
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- ESTIMATES  (4 records)
-- ============================================================
INSERT INTO estimates (
  id, estimate_number, customer_id, property_id,
  status, title,
  issue_date, expiration_date,
  subtotal, total
) VALUES
  ('00000700-0000-0000-0000-000000000001', 'EST-2026-00001',
   '00000100-0000-0000-0000-000000000002', '00000200-0000-0000-0000-000000000002',
   'sent', 'Fall Landscape Refresh – Ashwood Lane',
   '2026-09-25', '2026-10-25', 2850.00, 2850.00),
  ('00000700-0000-0000-0000-000000000002', 'EST-2026-00002',
   '00000100-0000-0000-0000-000000000004', '00000200-0000-0000-0000-000000000005',
   'approved', 'Backyard Hardscape & Planting Bed – Chen',
   '2026-09-10', '2026-10-10', 6400.00, 6400.00),
  ('00000700-0000-0000-0000-000000000003', 'EST-2026-00003',
   '00000100-0000-0000-0000-000000000003', '00000200-0000-0000-0000-000000000003',
   'draft', 'Lakeside HOA – 2027 Annual Maintenance Proposal',
   '2026-10-01', '2026-11-01', 24000.00, 24000.00),
  ('00000700-0000-0000-0000-000000000004', 'EST-2026-00004',
   '00000100-0000-0000-0000-000000000006', '00000200-0000-0000-0000-000000000007',
   'converted', 'Oak Creek – Fall Cleanup & Pre-Emergent',
   '2026-09-05', '2026-10-05', 1850.00, 1850.00)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- JOBS  (8 records — 3 today, 5 historical)
-- ============================================================
INSERT INTO jobs (
  id, job_number, customer_id, property_id, estimate_id,
  service_type, priority, status, title,
  scheduled_date, estimated_hours
) VALUES
  -- Today's active jobs
  ('00000800-0000-0000-0000-000000000001', 'JOB-2026-00001',
   '00000100-0000-0000-0000-000000000001', '00000200-0000-0000-0000-000000000001', NULL,
   'mowing', 'normal', 'in_progress', 'Weekly Mow & Edge – Thompson',
   CURRENT_DATE, 1.5),
  ('00000800-0000-0000-0000-000000000002', 'JOB-2026-00002',
   '00000100-0000-0000-0000-000000000005', '00000200-0000-0000-0000-000000000006', NULL,
   'mowing', 'normal', 'scheduled', 'Weekly Mow – Moore',
   CURRENT_DATE, 1.0),
  ('00000800-0000-0000-0000-000000000003', 'JOB-2026-00003',
   '00000100-0000-0000-0000-000000000006', '00000200-0000-0000-0000-000000000007', '00000700-0000-0000-0000-000000000004',
   'landscaping', 'high', 'en_route', 'Oak Creek – Fall Cleanup & Pre-Emergent',
   CURRENT_DATE, 4.0),
  -- Historical / completed
  ('00000800-0000-0000-0000-000000000004', 'JOB-2026-00004',
   '00000100-0000-0000-0000-000000000002', '00000200-0000-0000-0000-000000000002', '00000700-0000-0000-0000-000000000001',
   'landscaping', 'normal', 'completed', 'Fall Landscape Refresh – Williams',
   '2026-10-01', 3.0),
  ('00000800-0000-0000-0000-000000000005', 'JOB-2026-00005',
   '00000100-0000-0000-0000-000000000004', '00000200-0000-0000-0000-000000000005', '00000700-0000-0000-0000-000000000002',
   'landscaping', 'normal', 'completed', 'Backyard Hardscape & Planting Bed – Chen',
   '2026-09-22', 6.0),
  ('00000800-0000-0000-0000-000000000006', 'JOB-2026-00006',
   '00000100-0000-0000-0000-000000000007', '00000200-0000-0000-0000-000000000008', NULL,
   'mowing', 'normal', 'completed', 'Weekly Mow – Davis',
   '2026-09-30', 1.0),
  ('00000800-0000-0000-0000-000000000007', 'JOB-2026-00007',
   '00000100-0000-0000-0000-000000000003', '00000200-0000-0000-0000-000000000003', NULL,
   'mowing', 'normal', 'completed', 'Lakeside HOA – Mow & Trim',
   '2026-09-28', 5.0),
  ('00000800-0000-0000-0000-000000000008', 'JOB-2026-00008',
   '00000100-0000-0000-0000-000000000001', '00000200-0000-0000-0000-000000000001', NULL,
   'mowing', 'normal', 'completed', 'Weekly Mow & Edge – Thompson',
   '2026-09-30', 1.5)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- INVOICES  (6 records — 3 overdue, 2 paid, 1 sent)
-- ============================================================
INSERT INTO invoices (
  id, invoice_number, customer_id, property_id, job_id,
  status, issue_date, due_date, payment_terms,
  subtotal, total, amount_paid, balance_due
) VALUES
  -- OVERDUE
  ('00000900-0000-0000-0000-000000000001', 'INV-2026-00001',
   '00000100-0000-0000-0000-000000000002', '00000200-0000-0000-0000-000000000002', '00000800-0000-0000-0000-000000000004',
   'overdue', '2026-09-01', '2026-09-15', 14,
   2850.00, 2850.00, 0.00, 2850.00),
  ('00000900-0000-0000-0000-000000000002', 'INV-2026-00002',
   '00000100-0000-0000-0000-000000000003', '00000200-0000-0000-0000-000000000003', '00000800-0000-0000-0000-000000000007',
   'overdue', '2026-09-05', '2026-09-19', 14,
   1200.00, 1200.00, 0.00, 1200.00),
  ('00000900-0000-0000-0000-000000000003', 'INV-2026-00003',
   '00000100-0000-0000-0000-000000000006', '00000200-0000-0000-0000-000000000007', NULL,
   'overdue', '2026-08-15', '2026-09-14', 30,
   4800.00, 4800.00, 0.00, 4800.00),
  -- PAID
  ('00000900-0000-0000-0000-000000000004', 'INV-2026-00004',
   '00000100-0000-0000-0000-000000000004', '00000200-0000-0000-0000-000000000005', '00000800-0000-0000-0000-000000000005',
   'paid', '2026-09-22', '2026-10-22', 30,
   6400.00, 6400.00, 6400.00, 0.00),
  ('00000900-0000-0000-0000-000000000005', 'INV-2026-00005',
   '00000100-0000-0000-0000-000000000001', '00000200-0000-0000-0000-000000000001', '00000800-0000-0000-0000-000000000008',
   'paid', '2026-10-01', '2026-10-31', 30,
   95.00, 95.00, 95.00, 0.00),
  -- SENT (outstanding, not yet overdue)
  ('00000900-0000-0000-0000-000000000006', 'INV-2026-00006',
   '00000100-0000-0000-0000-000000000007', '00000200-0000-0000-0000-000000000008', '00000800-0000-0000-0000-000000000006',
   'sent', '2026-10-01', '2026-10-31', 30,
   85.00, 85.00, 0.00, 85.00)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- INVOICE ITEMS
-- ============================================================
INSERT INTO invoice_items (id, invoice_id, sort_order, name, quantity, unit_price, total) VALUES
  ('00000901-0000-0000-0000-000000000001', '00000900-0000-0000-0000-000000000001', 1, 'Fall Landscape Refresh – Labor',         1,    2200.00, 2200.00),
  ('00000901-0000-0000-0000-000000000002', '00000900-0000-0000-0000-000000000001', 2, 'Mulch (32 bags)',                        32,     20.00,  640.00),
  ('00000901-0000-0000-0000-000000000003', '00000900-0000-0000-0000-000000000002', 1, 'Commercial Mow & Trim – Lakeside',        1,    1200.00, 1200.00),
  ('00000901-0000-0000-0000-000000000004', '00000900-0000-0000-0000-000000000003', 1, 'Seasonal Commercial Maintenance',         1,    4800.00, 4800.00),
  ('00000901-0000-0000-0000-000000000005', '00000900-0000-0000-0000-000000000004', 1, 'Backyard Hardscape – Labor',              1,    5000.00, 5000.00),
  ('00000901-0000-0000-0000-000000000006', '00000900-0000-0000-0000-000000000004', 2, 'Landscape Block & Gravel Materials',      1,    1400.00, 1400.00),
  ('00000901-0000-0000-0000-000000000007', '00000900-0000-0000-0000-000000000005', 1, 'Weekly Mow & Edge',                       1,      95.00,   95.00),
  ('00000901-0000-0000-0000-000000000008', '00000900-0000-0000-0000-000000000006', 1, 'Weekly Mow',                              1,      85.00,   85.00)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- PAYMENTS  (2 records — matching the paid invoices)
-- ============================================================
INSERT INTO payments (id, invoice_id, customer_id, amount, payment_method, payment_date) VALUES
  ('00001000-0000-0000-0000-000000000001',
   '00000900-0000-0000-0000-000000000004', '00000100-0000-0000-0000-000000000004',
   6400.00, 'check', '2026-09-30'),
  ('00001000-0000-0000-0000-000000000002',
   '00000900-0000-0000-0000-000000000005', '00000100-0000-0000-0000-000000000001',
   95.00, 'credit_card', '2026-10-03')
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- AUDIT LOGS  (8 recent entries — shown in dashboard activity feed)
-- ============================================================
INSERT INTO audit_logs (id, actor_email, action, entity_type, entity_id, created_at) VALUES
  ('00001100-0000-0000-0000-000000000001',
   'ryan@redlinelandscapingky.com', 'created', 'job',
   '00000800-0000-0000-0000-000000000003', NOW() - INTERVAL '18 minutes'),
  ('00001100-0000-0000-0000-000000000002',
   'ryan@redlinelandscapingky.com', 'updated', 'job',
   '00000800-0000-0000-0000-000000000001', NOW() - INTERVAL '45 minutes'),
  ('00001100-0000-0000-0000-000000000003',
   'ryan@redlinelandscapingky.com', 'created', 'invoice',
   '00000900-0000-0000-0000-000000000006', NOW() - INTERVAL '2 hours'),
  ('00001100-0000-0000-0000-000000000004',
   'ryan@redlinelandscapingky.com', 'updated', 'invoice',
   '00000900-0000-0000-0000-000000000001', NOW() - INTERVAL '3 hours'),
  ('00001100-0000-0000-0000-000000000005',
   'ryan@redlinelandscapingky.com', 'created', 'lead',
   '00000300-0000-0000-0000-000000000003', NOW() - INTERVAL '5 hours'),
  ('00001100-0000-0000-0000-000000000006',
   'ryan@redlinelandscapingky.com', 'updated', 'customer',
   '00000100-0000-0000-0000-000000000006', NOW() - INTERVAL '1 day'),
  ('00001100-0000-0000-0000-000000000007',
   'ryan@redlinelandscapingky.com', 'created', 'estimate',
   '00000700-0000-0000-0000-000000000003', NOW() - INTERVAL '1 day 2 hours'),
  ('00001100-0000-0000-0000-000000000008',
   'ryan@redlinelandscapingky.com', 'recorded', 'payment',
   '00001000-0000-0000-0000-000000000001', NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- DOCUMENT SEQUENCES  (keep numbering from conflicting with seed data)
-- ============================================================
INSERT INTO document_sequences (prefix, year, last_seq) VALUES
  ('EST', 2026, 4),
  ('JOB', 2026, 8),
  ('INV', 2026, 6)
ON CONFLICT (prefix, year)
  DO UPDATE SET last_seq = GREATEST(document_sequences.last_seq, EXCLUDED.last_seq);


COMMIT;

-- ============================================================
-- Dashboard stat summary after seed:
--   New Leads:          3  (Foster, Kirk, Sutton)
--   Active Customers:   7
--   Today's Jobs:       3  (Thompson in_progress, Moore scheduled, Oak Creek en_route)
--   Overdue Invoices:   3  ($2,850 / $1,200 / $4,800)
--   Low Stock Items:    3  (Pre-Emergent, Rock Salt, Bar Oil)
--   Maintenance Due:    2  (Exmark mower, SnowEx spreader)
-- ============================================================
