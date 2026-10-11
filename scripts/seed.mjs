/**
 * Demo seed script — run with:
 *   node --env-file=.env.local scripts/seed.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function upsert(table, rows) {
  const { error } = await supabase
    .from(table)
    .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
  if (error) {
    console.error(`  ✗ ${table}:`, error.message);
    return false;
  }
  console.log(`  ✓ ${table}: ${rows.length} row${rows.length !== 1 ? "s" : ""}`);
  return true;
}

// ---------------------------------------------------------------
// SEED DATA
// ---------------------------------------------------------------

const customers = [
  { id: "00000100-0000-0000-0000-000000000001", account_type: "individual", first_name: "Mike",     last_name: "Thompson",  email: "mike.thompson@gmail.com",     mobile_phone: "859-555-0101", billing_address_line1: "124 Maple Drive",    billing_city: "Lexington",     billing_state: "KY", billing_zip: "40503", status: "active",   customer_source: "referral", tags: ["mowing","seasonal"] },
  { id: "00000100-0000-0000-0000-000000000002", account_type: "individual", first_name: "Sarah",    last_name: "Williams",  email: "sarah.williams@outlook.com",   mobile_phone: "859-555-0202", billing_address_line1: "837 Ashwood Lane",   billing_city: "Nicholasville", billing_state: "KY", billing_zip: "40356", status: "active",   customer_source: "website",  tags: ["landscaping","snow"] },
  { id: "00000100-0000-0000-0000-000000000003", account_type: "business",   first_name: "James",    last_name: "Harrington",email: "jharrington@lakesidehoa.org",  mobile_phone: "859-555-0303", billing_address_line1: "1 Lakeside Drive",   billing_city: "Lexington",     billing_state: "KY", billing_zip: "40514", status: "active",   customer_source: "direct",   tags: ["commercial","snow","mowing"], business_name: "Lakeside HOA" },
  { id: "00000100-0000-0000-0000-000000000004", account_type: "individual", first_name: "David",    last_name: "Chen",      email: "dchen@yahoo.com",              mobile_phone: "859-555-0404", billing_address_line1: "2204 Tates Creek Rd",billing_city: "Lexington",     billing_state: "KY", billing_zip: "40502", status: "active",   customer_source: "google",   tags: ["landscaping"] },
  { id: "00000100-0000-0000-0000-000000000005", account_type: "individual", first_name: "Patricia", last_name: "Moore",     email: "pmoore@gmail.com",             mobile_phone: "859-555-0505", billing_address_line1: "509 Cardinal Ct",    billing_city: "Georgetown",    billing_state: "KY", billing_zip: "40324", status: "active",   customer_source: "referral", tags: ["mowing","mulch"] },
  { id: "00000100-0000-0000-0000-000000000006", account_type: "business",   first_name: "Robert",   last_name: "Banks",     email: "rbanks@oakcreekapts.com",      mobile_phone: "859-555-0606", billing_address_line1: "400 Oak Creek Blvd", billing_city: "Lexington",     billing_state: "KY", billing_zip: "40509", status: "active",   customer_source: "direct",   tags: ["commercial","snow","mowing"], business_name: "Oak Creek Apartments" },
  { id: "00000100-0000-0000-0000-000000000007", account_type: "individual", first_name: "Linda",    last_name: "Davis",     email: "ldavis@icloud.com",            mobile_phone: "859-555-0707", billing_address_line1: "78 Ridgemont Way",   billing_city: "Richmond",      billing_state: "KY", billing_zip: "40475", status: "active",   customer_source: "nextdoor", tags: ["mowing"] },
  { id: "00000100-0000-0000-0000-000000000008", account_type: "individual", first_name: "Tom",      last_name: "Garrett",   email: "tgarrett@gmail.com",           mobile_phone: "859-555-0808", billing_address_line1: "3310 Palomar Dr",    billing_city: "Lexington",     billing_state: "KY", billing_zip: "40513", status: "inactive", customer_source: "website",  tags: ["landscaping"] },
];

const properties = [
  { id: "00000200-0000-0000-0000-000000000001", customer_id: "00000100-0000-0000-0000-000000000001", address_line1: "124 Maple Drive",    city: "Lexington",     state: "KY", zip: "40503", property_type: "residential", lot_size_sqft: 9500,   turf_area_sqft: 7800,  pets_on_property: false, active: true },
  { id: "00000200-0000-0000-0000-000000000002", customer_id: "00000100-0000-0000-0000-000000000002", address_line1: "837 Ashwood Lane",   city: "Nicholasville", state: "KY", zip: "40356", property_type: "residential", lot_size_sqft: 12000,  turf_area_sqft: 9200,  pets_on_property: true,  active: true },
  { id: "00000200-0000-0000-0000-000000000003", customer_id: "00000100-0000-0000-0000-000000000003", address_line1: "1 Lakeside Drive",   city: "Lexington",     state: "KY", zip: "40514", property_type: "commercial",  lot_size_sqft: 85000,  turf_area_sqft: 62000, pets_on_property: false, active: true },
  { id: "00000200-0000-0000-0000-000000000004", customer_id: "00000100-0000-0000-0000-000000000003", address_line1: "5 Lakeside Commons", city: "Lexington",     state: "KY", zip: "40514", property_type: "commercial",  lot_size_sqft: 42000,  turf_area_sqft: 28000, pets_on_property: false, active: true },
  { id: "00000200-0000-0000-0000-000000000005", customer_id: "00000100-0000-0000-0000-000000000004", address_line1: "2204 Tates Creek Rd",city: "Lexington",     state: "KY", zip: "40502", property_type: "residential", lot_size_sqft: 11200,  turf_area_sqft: 8800,  pets_on_property: false, active: true },
  { id: "00000200-0000-0000-0000-000000000006", customer_id: "00000100-0000-0000-0000-000000000005", address_line1: "509 Cardinal Ct",    city: "Georgetown",    state: "KY", zip: "40324", property_type: "residential", lot_size_sqft: 8600,   turf_area_sqft: 6900,  pets_on_property: true,  active: true },
  { id: "00000200-0000-0000-0000-000000000007", customer_id: "00000100-0000-0000-0000-000000000006", address_line1: "400 Oak Creek Blvd", city: "Lexington",     state: "KY", zip: "40509", property_type: "commercial",  lot_size_sqft: 120000, turf_area_sqft: 75000, pets_on_property: false, active: true },
  { id: "00000200-0000-0000-0000-000000000008", customer_id: "00000100-0000-0000-0000-000000000007", address_line1: "78 Ridgemont Way",   city: "Richmond",      state: "KY", zip: "40475", property_type: "residential", lot_size_sqft: 7800,   turf_area_sqft: 6200,  pets_on_property: false, active: true },
  { id: "00000200-0000-0000-0000-000000000009", customer_id: "00000100-0000-0000-0000-000000000008", address_line1: "3310 Palomar Dr",    city: "Lexington",     state: "KY", zip: "40513", property_type: "residential", lot_size_sqft: 9100,   turf_area_sqft: 7400,  pets_on_property: false, active: true },
];

const leads = [
  { id: "00000300-0000-0000-0000-000000000001", source: "website",  first_name: "Amanda", last_name: "Foster",  email: "amanda.foster@gmail.com", phone: "859-555-1001", service_address: "1822 Bellefonte Dr, Lexington KY 40503",        requested_services: ["lawn_mowing","fertilization"],                       status: "new",                  notes: "Wants weekly mowing starting spring. Has 2 dogs." },
  { id: "00000300-0000-0000-0000-000000000002", source: "referral", first_name: "Jason",  last_name: "Kirk",    email: "jkirk@hotmail.com",       phone: "859-555-1002", service_address: "445 Pimlico Dr, Lexington KY 40517",             requested_services: ["landscaping_design","mulching"],                    status: "new",                  notes: "Complete front yard redesign. Budget around $4k." },
  { id: "00000300-0000-0000-0000-000000000003", source: "google",   first_name: "Connie", last_name: "Sutton",  email: "csutton@yahoo.com",       phone: "859-555-1003", service_address: "290 Clays Mill Rd, Lexington KY 40503",         requested_services: ["snow_removal"],                                     status: "new",                  notes: "Commercial property. Needs 24hr snow response contract." },
  { id: "00000300-0000-0000-0000-000000000004", source: "nextdoor", first_name: "Greg",   last_name: "Holt",    email: "greg.holt@icloud.com",    phone: "859-555-1004", service_address: "718 Chinoe Rd, Lexington KY 40502",             requested_services: ["lawn_mowing","aeration"],                           status: "contacted",            notes: "Left voicemail. Follow up Thursday." },
  { id: "00000300-0000-0000-0000-000000000005", source: "website",  first_name: "Melissa",last_name: "Park",    email: "mpark@gmail.com",         phone: "859-555-1005", service_address: "2901 Regency Rd, Lexington KY 40503",           requested_services: ["lawn_mowing","landscaping_design"],                 status: "contacted",            notes: "Site visit scheduled for next week." },
  { id: "00000300-0000-0000-0000-000000000006", source: "direct",   first_name: "Brandon",last_name: "Shaw",    email: "bshaw@corp.com",          phone: "859-555-1006", service_address: "100 Corporate Way, Nicholasville KY 40356",     requested_services: ["commercial_mowing","snow_removal","fertilization"], status: "estimate_in_progress", notes: "Commercial complex – annual contract potential ~$18k." },
];

const suppliers = [
  { id: "00000400-0000-0000-0000-000000000001", company_name: "SiteOne Landscape Supply", contact_name: "Derek Hollis", email: "derek.hollis@siteone.com", phone: "800-555-3001", active: true },
  { id: "00000400-0000-0000-0000-000000000002", company_name: "Home Depot Pro",           contact_name: "Tina Marsh",  email: "tmarsh@homedepotpro.com",  phone: "800-555-3002", active: true },
  { id: "00000400-0000-0000-0000-000000000003", company_name: "Ariens / Gravely of KY",   contact_name: "Phil Norris", email: "pnorris@gravely-ky.com",   phone: "859-555-3003", active: true },
];

const products = [
  // Low stock (current_quantity <= reorder_point)
  { id: "00000500-0000-0000-0000-000000000001", name: "Pre-Emergent Fertilizer (50 lb)",    category: "fertilizer",  supplier_id: "00000400-0000-0000-0000-000000000001", unit_of_measure: "bag",    purchase_cost: 28.00, billable_price: 45.00,  reorder_point: 10, reorder_quantity: 20,  current_quantity: 4,  active: true },
  { id: "00000500-0000-0000-0000-000000000002", name: "Rock Salt (50 lb)",                  category: "de-icer",     supplier_id: "00000400-0000-0000-0000-000000000001", unit_of_measure: "bag",    purchase_cost: 8.50,  billable_price: 14.00,  reorder_point: 50, reorder_quantity: 100, current_quantity: 18, active: true },
  { id: "00000500-0000-0000-0000-000000000006", name: "Bar & Chain Oil (1 gal)",            category: "equipment",   supplier_id: "00000400-0000-0000-0000-000000000002", unit_of_measure: "gallon", purchase_cost: 9.00,  billable_price: 18.00,  reorder_point: 4,  reorder_quantity: 8,   current_quantity: 2,  active: true },
  // In stock
  { id: "00000500-0000-0000-0000-000000000003", name: "Landscaping Mulch (2 cu ft)",        category: "mulch",       supplier_id: "00000400-0000-0000-0000-000000000001", unit_of_measure: "bag",    purchase_cost: 3.75,  billable_price: 7.00,   reorder_point: 40, reorder_quantity: 80,  current_quantity: 52, active: true },
  { id: "00000500-0000-0000-0000-000000000004", name: "Tall Fescue Grass Seed (10 lb)",     category: "seed",        supplier_id: "00000400-0000-0000-0000-000000000001", unit_of_measure: "bag",    purchase_cost: 22.00, billable_price: 38.00,  reorder_point: 5,  reorder_quantity: 15,  current_quantity: 9,  active: true },
  { id: "00000500-0000-0000-0000-000000000005", name: "Roundup Pro Concentrate (1 gal)",    category: "herbicide",   supplier_id: "00000400-0000-0000-0000-000000000002", unit_of_measure: "gallon", purchase_cost: 65.00, billable_price: 110.00, reorder_point: 3,  reorder_quantity: 6,   current_quantity: 5,  active: true },
  { id: "00000500-0000-0000-0000-000000000007", name: "Edger Blades (20-pack)",             category: "blades",      supplier_id: "00000400-0000-0000-0000-000000000002", unit_of_measure: "pack",   purchase_cost: 12.00, billable_price: 22.00,  reorder_point: 2,  reorder_quantity: 5,   current_quantity: 3,  active: true },
  { id: "00000500-0000-0000-0000-000000000008", name: "Trimmer Line .095 (1 lb spool)",     category: "trimmer",     supplier_id: "00000400-0000-0000-0000-000000000002", unit_of_measure: "spool",  purchase_cost: 8.00,  billable_price: 14.00,  reorder_point: 3,  reorder_quantity: 6,   current_quantity: 7,  active: true },
  { id: "00000500-0000-0000-0000-000000000009", name: "Calcium Chloride Pellets (50 lb)",   category: "de-icer",     supplier_id: "00000400-0000-0000-0000-000000000001", unit_of_measure: "bag",    purchase_cost: 16.00, billable_price: 28.00,  reorder_point: 20, reorder_quantity: 40,  current_quantity: 34, active: true },
  { id: "00000500-0000-0000-0000-000000000010", name: "Landscape Fabric (100 sq ft roll)",  category: "materials",   supplier_id: "00000400-0000-0000-0000-000000000001", unit_of_measure: "roll",   purchase_cost: 18.00, billable_price: 32.00,  reorder_point: 3,  reorder_quantity: 6,   current_quantity: 4,  active: true },
];

const assets = [
  { id: "00000600-0000-0000-0000-000000000001", asset_number: "VEH-001", asset_type: "truck",          make: "Chevrolet", model: "Silverado 2500HD",  year: 2024, status: "available",       purchase_date: "2024-01-15", purchase_price: 52000, current_mileage: 31200, last_maintenance_date: "2026-07-10", next_maintenance_date: "2027-01-10", storage_location: "Main Lot" },
  { id: "00000600-0000-0000-0000-000000000002", asset_number: "EQP-001", asset_type: "zero_turn_mower",make: "Gravely",   model: "Pro-Turn 272",       year: 2023, status: "available",       purchase_date: "2023-03-20", purchase_price: 14800, current_mileage: null,  last_maintenance_date: "2026-08-22", next_maintenance_date: "2027-01-01", storage_location: "Equipment Bay" },
  { id: "00000600-0000-0000-0000-000000000003", asset_number: "EQP-002", asset_type: "zero_turn_mower",make: "Exmark",    model: "Lazer Z X-Series",   year: 2022, status: "maintenance_due", purchase_date: "2022-04-05", purchase_price: 13200, current_mileage: null,  last_maintenance_date: "2026-04-01", next_maintenance_date: "2026-09-30", storage_location: "Equipment Bay" },
  { id: "00000600-0000-0000-0000-000000000004", asset_number: "VEH-002", asset_type: "truck",          make: "Ford",      model: "F-250 Super Duty",   year: 2023, status: "available",       purchase_date: "2023-06-01", purchase_price: 49500, current_mileage: 48700, last_maintenance_date: "2026-09-15", next_maintenance_date: "2027-03-15", storage_location: "Main Lot" },
  { id: "00000600-0000-0000-0000-000000000005", asset_number: "EQP-003", asset_type: "salt_spreader",  make: "SnowEx",    model: "V-Maxx 8500",        year: 2021, status: "maintenance_due", purchase_date: "2021-10-12", purchase_price: 4200,  current_mileage: null,  last_maintenance_date: "2025-11-30", next_maintenance_date: "2026-09-01", storage_location: "Equipment Bay" },
];

const estimates = [
  { id: "00000700-0000-0000-0000-000000000001", estimate_number: "EST-2026-00001", customer_id: "00000100-0000-0000-0000-000000000002", property_id: "00000200-0000-0000-0000-000000000002", status: "sent",      title: "Fall Landscape Refresh – Ashwood Lane",              issue_date: "2026-09-25", expiration_date: "2026-10-25", subtotal: 2850, total: 2850 },
  { id: "00000700-0000-0000-0000-000000000002", estimate_number: "EST-2026-00002", customer_id: "00000100-0000-0000-0000-000000000004", property_id: "00000200-0000-0000-0000-000000000005", status: "approved",  title: "Backyard Hardscape & Planting Bed – Chen",           issue_date: "2026-09-10", expiration_date: "2026-10-10", subtotal: 6400, total: 6400 },
  { id: "00000700-0000-0000-0000-000000000003", estimate_number: "EST-2026-00003", customer_id: "00000100-0000-0000-0000-000000000003", property_id: "00000200-0000-0000-0000-000000000003", status: "draft",     title: "Lakeside HOA – 2027 Annual Maintenance Proposal",    issue_date: "2026-10-01", expiration_date: "2026-11-01", subtotal: 24000, total: 24000 },
  { id: "00000700-0000-0000-0000-000000000004", estimate_number: "EST-2026-00004", customer_id: "00000100-0000-0000-0000-000000000006", property_id: "00000200-0000-0000-0000-000000000007", status: "converted", title: "Oak Creek – Fall Cleanup & Pre-Emergent",            issue_date: "2026-09-05", expiration_date: "2026-10-05", subtotal: 1850, total: 1850 },
];

const today = new Date().toISOString().split("T")[0];

const jobs = [
  // Today — active
  { id: "00000800-0000-0000-0000-000000000001", job_number: "JOB-2026-00001", customer_id: "00000100-0000-0000-0000-000000000001", property_id: "00000200-0000-0000-0000-000000000001", estimate_id: null,                                          service_type: "mowing",      priority: "normal", status: "in_progress", title: "Weekly Mow & Edge – Thompson",              scheduled_date: today,        estimated_hours: 1.5 },
  { id: "00000800-0000-0000-0000-000000000002", job_number: "JOB-2026-00002", customer_id: "00000100-0000-0000-0000-000000000005", property_id: "00000200-0000-0000-0000-000000000006", estimate_id: null,                                          service_type: "mowing",      priority: "normal", status: "scheduled",   title: "Weekly Mow – Moore",                        scheduled_date: today,        estimated_hours: 1.0 },
  { id: "00000800-0000-0000-0000-000000000003", job_number: "JOB-2026-00003", customer_id: "00000100-0000-0000-0000-000000000006", property_id: "00000200-0000-0000-0000-000000000007", estimate_id: "00000700-0000-0000-0000-000000000004",         service_type: "landscaping", priority: "high",   status: "en_route",    title: "Oak Creek – Fall Cleanup & Pre-Emergent",   scheduled_date: today,        estimated_hours: 4.0 },
  // Historical — completed
  { id: "00000800-0000-0000-0000-000000000004", job_number: "JOB-2026-00004", customer_id: "00000100-0000-0000-0000-000000000002", property_id: "00000200-0000-0000-0000-000000000002", estimate_id: "00000700-0000-0000-0000-000000000001",         service_type: "landscaping", priority: "normal", status: "completed",   title: "Fall Landscape Refresh – Williams",         scheduled_date: "2026-10-01", estimated_hours: 3.0 },
  { id: "00000800-0000-0000-0000-000000000005", job_number: "JOB-2026-00005", customer_id: "00000100-0000-0000-0000-000000000004", property_id: "00000200-0000-0000-0000-000000000005", estimate_id: "00000700-0000-0000-0000-000000000002",         service_type: "landscaping", priority: "normal", status: "completed",   title: "Backyard Hardscape & Planting Bed – Chen",  scheduled_date: "2026-09-22", estimated_hours: 6.0 },
  { id: "00000800-0000-0000-0000-000000000006", job_number: "JOB-2026-00006", customer_id: "00000100-0000-0000-0000-000000000007", property_id: "00000200-0000-0000-0000-000000000008", estimate_id: null,                                          service_type: "mowing",      priority: "normal", status: "completed",   title: "Weekly Mow – Davis",                        scheduled_date: "2026-09-30", estimated_hours: 1.0 },
  { id: "00000800-0000-0000-0000-000000000007", job_number: "JOB-2026-00007", customer_id: "00000100-0000-0000-0000-000000000003", property_id: "00000200-0000-0000-0000-000000000003", estimate_id: null,                                          service_type: "mowing",      priority: "normal", status: "completed",   title: "Lakeside HOA – Mow & Trim",                 scheduled_date: "2026-09-28", estimated_hours: 5.0 },
  { id: "00000800-0000-0000-0000-000000000008", job_number: "JOB-2026-00008", customer_id: "00000100-0000-0000-0000-000000000001", property_id: "00000200-0000-0000-0000-000000000001", estimate_id: null,                                          service_type: "mowing",      priority: "normal", status: "completed",   title: "Weekly Mow & Edge – Thompson",              scheduled_date: "2026-09-30", estimated_hours: 1.5 },
];

const invoices = [
  // Overdue
  { id: "00000900-0000-0000-0000-000000000001", invoice_number: "INV-2026-00001", customer_id: "00000100-0000-0000-0000-000000000002", property_id: "00000200-0000-0000-0000-000000000002", job_id: "00000800-0000-0000-0000-000000000004", status: "overdue", issue_date: "2026-09-01", due_date: "2026-09-15", payment_terms: 14, subtotal: 2850, total: 2850, amount_paid: 0,    balance_due: 2850 },
  { id: "00000900-0000-0000-0000-000000000002", invoice_number: "INV-2026-00002", customer_id: "00000100-0000-0000-0000-000000000003", property_id: "00000200-0000-0000-0000-000000000003", job_id: "00000800-0000-0000-0000-000000000007", status: "overdue", issue_date: "2026-09-05", due_date: "2026-09-19", payment_terms: 14, subtotal: 1200, total: 1200, amount_paid: 0,    balance_due: 1200 },
  { id: "00000900-0000-0000-0000-000000000003", invoice_number: "INV-2026-00003", customer_id: "00000100-0000-0000-0000-000000000006", property_id: "00000200-0000-0000-0000-000000000007", job_id: null,                                          status: "overdue", issue_date: "2026-08-15", due_date: "2026-09-14", payment_terms: 30, subtotal: 4800, total: 4800, amount_paid: 0,    balance_due: 4800 },
  // Paid
  { id: "00000900-0000-0000-0000-000000000004", invoice_number: "INV-2026-00004", customer_id: "00000100-0000-0000-0000-000000000004", property_id: "00000200-0000-0000-0000-000000000005", job_id: "00000800-0000-0000-0000-000000000005", status: "paid",    issue_date: "2026-09-22", due_date: "2026-10-22", payment_terms: 30, subtotal: 6400, total: 6400, amount_paid: 6400, balance_due: 0 },
  { id: "00000900-0000-0000-0000-000000000005", invoice_number: "INV-2026-00005", customer_id: "00000100-0000-0000-0000-000000000001", property_id: "00000200-0000-0000-0000-000000000001", job_id: "00000800-0000-0000-0000-000000000008", status: "paid",    issue_date: "2026-10-01", due_date: "2026-10-31", payment_terms: 30, subtotal: 95,   total: 95,   amount_paid: 95,   balance_due: 0 },
  // Sent
  { id: "00000900-0000-0000-0000-000000000006", invoice_number: "INV-2026-00006", customer_id: "00000100-0000-0000-0000-000000000007", property_id: "00000200-0000-0000-0000-000000000008", job_id: "00000800-0000-0000-0000-000000000006", status: "sent",    issue_date: "2026-10-01", due_date: "2026-10-31", payment_terms: 30, subtotal: 85,   total: 85,   amount_paid: 0,    balance_due: 85 },
];

const invoiceItems = [
  { id: "00000901-0000-0000-0000-000000000001", invoice_id: "00000900-0000-0000-0000-000000000001", sort_order: 1, name: "Fall Landscape Refresh – Labor",       quantity: 1,  unit_price: 2200, total: 2200 },
  { id: "00000901-0000-0000-0000-000000000002", invoice_id: "00000900-0000-0000-0000-000000000001", sort_order: 2, name: "Mulch (32 bags)",                      quantity: 32, unit_price: 20,   total: 640 },
  { id: "00000901-0000-0000-0000-000000000003", invoice_id: "00000900-0000-0000-0000-000000000002", sort_order: 1, name: "Commercial Mow & Trim – Lakeside",     quantity: 1,  unit_price: 1200, total: 1200 },
  { id: "00000901-0000-0000-0000-000000000004", invoice_id: "00000900-0000-0000-0000-000000000003", sort_order: 1, name: "Seasonal Commercial Maintenance",      quantity: 1,  unit_price: 4800, total: 4800 },
  { id: "00000901-0000-0000-0000-000000000005", invoice_id: "00000900-0000-0000-0000-000000000004", sort_order: 1, name: "Backyard Hardscape – Labor",           quantity: 1,  unit_price: 5000, total: 5000 },
  { id: "00000901-0000-0000-0000-000000000006", invoice_id: "00000900-0000-0000-0000-000000000004", sort_order: 2, name: "Landscape Block & Gravel Materials",   quantity: 1,  unit_price: 1400, total: 1400 },
  { id: "00000901-0000-0000-0000-000000000007", invoice_id: "00000900-0000-0000-0000-000000000005", sort_order: 1, name: "Weekly Mow & Edge",                    quantity: 1,  unit_price: 95,   total: 95 },
  { id: "00000901-0000-0000-0000-000000000008", invoice_id: "00000900-0000-0000-0000-000000000006", sort_order: 1, name: "Weekly Mow",                           quantity: 1,  unit_price: 85,   total: 85 },
];

const payments = [
  { id: "00001000-0000-0000-0000-000000000001", invoice_id: "00000900-0000-0000-0000-000000000004", customer_id: "00000100-0000-0000-0000-000000000004", amount: 6400, payment_method: "check",       payment_date: "2026-09-30" },
  { id: "00001000-0000-0000-0000-000000000002", invoice_id: "00000900-0000-0000-0000-000000000005", customer_id: "00000100-0000-0000-0000-000000000001", amount: 95,   payment_method: "credit_card",  payment_date: "2026-10-03" },
];

const auditLogs = [
  { id: "00001100-0000-0000-0000-000000000001", actor_email: "ryan@redlinelandscapingky.com", action: "created",  entity_type: "job",      entity_id: "00000800-0000-0000-0000-000000000003" },
  { id: "00001100-0000-0000-0000-000000000002", actor_email: "ryan@redlinelandscapingky.com", action: "updated",  entity_type: "job",      entity_id: "00000800-0000-0000-0000-000000000001" },
  { id: "00001100-0000-0000-0000-000000000003", actor_email: "ryan@redlinelandscapingky.com", action: "created",  entity_type: "invoice",  entity_id: "00000900-0000-0000-0000-000000000006" },
  { id: "00001100-0000-0000-0000-000000000004", actor_email: "ryan@redlinelandscapingky.com", action: "updated",  entity_type: "invoice",  entity_id: "00000900-0000-0000-0000-000000000001" },
  { id: "00001100-0000-0000-0000-000000000005", actor_email: "ryan@redlinelandscapingky.com", action: "created",  entity_type: "lead",     entity_id: "00000300-0000-0000-0000-000000000003" },
  { id: "00001100-0000-0000-0000-000000000006", actor_email: "ryan@redlinelandscapingky.com", action: "updated",  entity_type: "customer", entity_id: "00000100-0000-0000-0000-000000000006" },
  { id: "00001100-0000-0000-0000-000000000007", actor_email: "ryan@redlinelandscapingky.com", action: "created",  entity_type: "estimate", entity_id: "00000700-0000-0000-0000-000000000003" },
  { id: "00001100-0000-0000-0000-000000000008", actor_email: "ryan@redlinelandscapingky.com", action: "recorded", entity_type: "payment",  entity_id: "00001000-0000-0000-0000-000000000001" },
];

// ---------------------------------------------------------------
// RUN
// ---------------------------------------------------------------

async function main() {
  console.log("Redline – Seed Data\n");

  // Check if migration 007 is applied (work_orders table)
  const { error: migCheck } = await supabase.from("work_orders").select("id").limit(1);
  if (migCheck && migCheck.message.includes("does not exist")) {
    console.warn("⚠  Migration 007 has NOT been applied yet.");
    console.warn("   Paste supabase/migrations/007_field_service_foundation.sql into the");
    console.warn("   Supabase SQL Editor, then re-run this script.\n");
  } else {
    console.log("  ✓ Migration 007 already applied\n");
  }

  await upsert("customers",      customers);
  await upsert("properties",     properties);
  await upsert("leads",          leads);
  await upsert("suppliers",      suppliers);
  await upsert("products",       products);
  await upsert("assets",         assets);
  await upsert("estimates",      estimates);
  await upsert("jobs",           jobs);
  await upsert("invoices",       invoices);
  await upsert("invoice_items",  invoiceItems);
  await upsert("payments",       payments);
  await upsert("audit_logs",     auditLogs);

  // Keep document sequences ahead of seeded numbers
  const seqRows = [
    { prefix: "EST", year: 2026, last_seq: 4 },
    { prefix: "JOB", year: 2026, last_seq: 8 },
    { prefix: "INV", year: 2026, last_seq: 6 },
  ];
  for (const row of seqRows) {
    const { data: existing } = await supabase
      .from("document_sequences")
      .select("last_seq")
      .eq("prefix", row.prefix)
      .eq("year", row.year)
      .single();
    if (!existing || existing.last_seq < row.last_seq) {
      await supabase.from("document_sequences").upsert(row, { onConflict: "prefix,year" });
    }
  }
  console.log("  ✓ document_sequences updated");

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
