export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
          phone: string | null;
          avatar_url: string | null;
          role: AppRole;
          status: "active" | "inactive" | "invited" | "suspended";
          customer_id: string | null;
          mfa_enabled: boolean;
          last_sign_in_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      business_settings: {
        Row: {
          id: string;
          business_name: string;
          legal_name: string | null;
          logo_url: string | null;
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          state: string | null;
          zip: string | null;
          phone: string | null;
          email: string | null;
          website: string | null;
          tax_id: string | null;
          default_tax_rate: number;
          estimate_prefix: string;
          contract_prefix: string;
          job_prefix: string;
          invoice_prefix: string;
          po_prefix: string;
          snow_event_prefix: string;
          default_payment_terms: number;
          estimate_expiration_days: number;
          default_deposit_percent: number;
          currency: string;
          timezone: string;
          pdf_footer: string | null;
          terms_and_conditions: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["business_settings"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["business_settings"]["Insert"]>;
      };
      customers: {
        Row: {
          id: string;
          account_type: "individual" | "business";
          first_name: string;
          last_name: string;
          business_name: string | null;
          primary_contact: string | null;
          email: string;
          mobile_phone: string | null;
          alternate_phone: string | null;
          billing_address_line1: string | null;
          billing_address_line2: string | null;
          billing_city: string | null;
          billing_state: string | null;
          billing_zip: string | null;
          preferred_contact: "email" | "phone" | "text" | null;
          customer_source: string | null;
          tax_exempt: boolean;
          tax_exemption_id: string | null;
          communication_prefs: Json;
          internal_notes: string | null;
          tags: string[];
          status: "active" | "inactive" | "archived";
          portal_access: boolean;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["customers"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
      };
      properties: {
        Row: {
          id: string;
          customer_id: string;
          property_name: string | null;
          address_line1: string;
          address_line2: string | null;
          city: string;
          state: string;
          zip: string;
          property_type: "residential" | "commercial";
          residential_type: string | null;
          lot_size_sqft: number | null;
          turf_area_sqft: number | null;
          bed_area_sqft: number | null;
          sidewalk_area_sqft: number | null;
          parking_area_sqft: number | null;
          driveway_area_sqft: number | null;
          snow_service_area_sqft: number | null;
          salt_treatment_area_sqft: number | null;
          access_instructions: string | null;
          gate_code_encrypted: string | null;
          water_access_notes: string | null;
          irrigation_notes: string | null;
          hazards: string | null;
          pets_on_property: boolean;
          utility_notes: string | null;
          preferred_service_days: string[];
          service_restrictions: string | null;
          property_notes: string | null;
          active: boolean;
          latitude: number | null;
          longitude: number | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["properties"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["properties"]["Insert"]>;
      };
      leads: {
        Row: {
          id: string;
          source: string;
          first_name: string;
          last_name: string;
          email: string | null;
          phone: string | null;
          company_name: string | null;
          service_address: string | null;
          requested_services: string[];
          status: LeadStatus;
          assigned_to: string | null;
          follow_up_date: string | null;
          notes: string | null;
          loss_reason: string | null;
          converted_customer_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["leads"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
      };
      estimates: {
        Row: {
          id: string;
          estimate_number: string;
          version: number;
          customer_id: string;
          property_id: string | null;
          estimator_id: string | null;
          status: EstimateStatus;
          title: string;
          description: string | null;
          issue_date: string;
          expiration_date: string | null;
          subtotal: number;
          discount_type: "percent" | "fixed" | null;
          discount_value: number;
          discount_amount: number;
          tax_rate: number;
          tax_amount: number;
          total: number;
          deposit_percent: number;
          deposit_amount: number;
          deposit_paid: number;
          payment_terms: string | null;
          customer_notes: string | null;
          internal_notes: string | null;
          approval_name: string | null;
          approval_ip: string | null;
          approved_at: string | null;
          declined_at: string | null;
          decline_reason: string | null;
          sent_at: string | null;
          viewed_at: string | null;
          converted_to: "contract" | "job" | null;
          converted_id: string | null;
          snapshot_data: Json | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["estimates"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["estimates"]["Insert"]>;
      };
      estimate_items: {
        Row: {
          id: string;
          estimate_id: string;
          sort_order: number;
          item_type: "service" | "material" | "labor" | "equipment" | "subcontractor" | "fee" | "discount";
          name: string;
          description: string | null;
          quantity: number;
          unit: string | null;
          unit_price: number;
          total: number;
          taxable: boolean;
          product_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["estimate_items"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["estimate_items"]["Insert"]>;
      };
      contracts: {
        Row: {
          id: string;
          contract_number: string;
          version: number;
          customer_id: string;
          property_id: string | null;
          estimate_id: string | null;
          contract_type: string;
          status: ContractStatus;
          title: string;
          description: string | null;
          start_date: string;
          end_date: string | null;
          renewal_date: string | null;
          auto_renewal: boolean;
          frequency: string | null;
          pricing_model: "fixed" | "per_visit" | "monthly" | "seasonal" | "per_push" | "per_event" | "time_material";
          included_visits: number | null;
          snow_depth_trigger: number | null;
          service_window: string | null;
          subtotal: number;
          tax_rate: number;
          tax_amount: number;
          total: number;
          cancellation_terms: string | null;
          customer_notes: string | null;
          internal_notes: string | null;
          signature_name: string | null;
          signature_ip: string | null;
          signed_at: string | null;
          snapshot_data: Json | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["contracts"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["contracts"]["Insert"]>;
      };
      jobs: {
        Row: {
          id: string;
          job_number: string;
          customer_id: string;
          property_id: string | null;
          estimate_id: string | null;
          contract_id: string | null;
          invoice_id: string | null;
          service_type: string;
          priority: "low" | "normal" | "high" | "urgent";
          status: JobStatus;
          title: string;
          description: string | null;
          crew_id: string | null;
          scheduled_date: string | null;
          scheduled_start: string | null;
          scheduled_end: string | null;
          actual_start: string | null;
          actual_end: string | null;
          estimated_hours: number | null;
          actual_hours: number | null;
          work_instructions: string | null;
          access_notes: string | null;
          crew_notes: string | null;
          weather_conditions: string | null;
          is_recurring: boolean;
          recurrence_rule: string | null;
          parent_job_id: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["jobs"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["jobs"]["Insert"]>;
      };
      job_assignments: {
        Row: {
          id: string;
          job_id: string;
          employee_id: string;
          role: "leader" | "member";
          assigned_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["job_assignments"]["Row"], "id" | "assigned_at">;
        Update: Partial<Database["public"]["Tables"]["job_assignments"]["Insert"]>;
      };
      snow_events: {
        Row: {
          id: string;
          event_number: string;
          event_name: string;
          status: SnowEventStatus;
          manager_id: string | null;
          forecast_start: string | null;
          forecast_end: string | null;
          actual_start: string | null;
          actual_end: string | null;
          expected_snowfall_inches: number | null;
          actual_snowfall_inches: number | null;
          ice_risk: boolean;
          temperature_low: number | null;
          weather_notes: string | null;
          operational_priority: "low" | "normal" | "high" | "emergency";
          event_notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["snow_events"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["snow_events"]["Insert"]>;
      };
      routes: {
        Row: {
          id: string;
          route_name: string;
          route_type: RouteType;
          crew_id: string | null;
          vehicle_id: string | null;
          job_date: string | null;
          snow_event_id: string | null;
          status: "draft" | "assigned" | "in_progress" | "completed" | "cancelled";
          estimated_start: string | null;
          estimated_end: string | null;
          actual_start: string | null;
          actual_end: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["routes"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["routes"]["Insert"]>;
      };
      route_stops: {
        Row: {
          id: string;
          route_id: string;
          property_id: string;
          contract_id: string | null;
          stop_order: number;
          priority: number;
          status: "pending" | "in_progress" | "completed" | "skipped" | "blocked";
          estimated_duration_minutes: number | null;
          actual_arrival: string | null;
          actual_completion: string | null;
          service_notes: string | null;
          skip_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["route_stops"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["route_stops"]["Insert"]>;
      };
      invoices: {
        Row: {
          id: string;
          invoice_number: string;
          customer_id: string;
          property_id: string | null;
          estimate_id: string | null;
          contract_id: string | null;
          job_id: string | null;
          snow_event_id: string | null;
          status: InvoiceStatus;
          issue_date: string;
          due_date: string;
          payment_terms: number;
          subtotal: number;
          discount_amount: number;
          tax_rate: number;
          tax_amount: number;
          total: number;
          amount_paid: number;
          balance_due: number;
          customer_notes: string | null;
          internal_notes: string | null;
          sent_at: string | null;
          viewed_at: string | null;
          paid_at: string | null;
          voided_at: string | null;
          void_reason: string | null;
          snapshot_data: Json | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["invoices"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["invoices"]["Insert"]>;
      };
      invoice_items: {
        Row: {
          id: string;
          invoice_id: string;
          sort_order: number;
          name: string;
          description: string | null;
          quantity: number;
          unit_price: number;
          total: number;
          taxable: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["invoice_items"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["invoice_items"]["Insert"]>;
      };
      payments: {
        Row: {
          id: string;
          invoice_id: string;
          customer_id: string;
          amount: number;
          payment_method: string;
          reference_number: string | null;
          payment_date: string;
          notes: string | null;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["payments"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
      };
      products: {
        Row: {
          id: string;
          name: string;
          category: string;
          brand: string | null;
          supplier_id: string | null;
          location: string | null;
          bin: string | null;
          unit_of_measure: string;
          purchase_cost: number;
          billable_price: number;
          taxable: boolean;
          reorder_point: number;
          reorder_quantity: number;
          current_quantity: number;
          reserved_quantity: number;
          min_stock: number;
          max_stock: number;
          barcode: string | null;
          sku: string | null;
          manufacturer_part: string | null;
          active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["products"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
      };
      inventory_transactions: {
        Row: {
          id: string;
          product_id: string;
          transaction_type: InventoryTransactionType;
          quantity_change: number;
          quantity_before: number;
          quantity_after: number;
          unit_cost: number | null;
          job_id: string | null;
          snow_event_id: string | null;
          purchase_order_id: string | null;
          reference_number: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["inventory_transactions"]["Row"], "id" | "created_at">;
        Update: never;
      };
      assets: {
        Row: {
          id: string;
          asset_number: string;
          asset_type: string;
          make: string | null;
          model: string | null;
          year: number | null;
          serial_number: string | null;
          vin: string | null;
          license_plate: string | null;
          purchase_date: string | null;
          purchase_price: number | null;
          current_hours: number | null;
          current_mileage: number | null;
          assigned_crew_id: string | null;
          assigned_employee_id: string | null;
          status: AssetStatus;
          storage_location: string | null;
          maintenance_interval_hours: number | null;
          last_maintenance_date: string | null;
          next_maintenance_date: string | null;
          insurance_expiration: string | null;
          registration_expiration: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["assets"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["assets"]["Insert"]>;
      };
      suppliers: {
        Row: {
          id: string;
          company_name: string;
          contact_name: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          website: string | null;
          account_number: string | null;
          payment_terms: string | null;
          notes: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["suppliers"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["suppliers"]["Insert"]>;
      };
      purchase_orders: {
        Row: {
          id: string;
          po_number: string;
          supplier_id: string;
          status: PurchaseOrderStatus;
          order_date: string;
          expected_delivery: string | null;
          subtotal: number;
          tax_amount: number;
          total: number;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["purchase_orders"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["purchase_orders"]["Insert"]>;
      };
      crews: {
        Row: {
          id: string;
          name: string;
          leader_id: string | null;
          description: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["crews"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["crews"]["Insert"]>;
      };
      crew_members: {
        Row: {
          id: string;
          crew_id: string;
          employee_id: string;
          role: "leader" | "member";
          joined_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["crew_members"]["Row"], "id" | "joined_at">;
        Update: Partial<Database["public"]["Tables"]["crew_members"]["Insert"]>;
      };
      time_entries: {
        Row: {
          id: string;
          employee_id: string;
          job_id: string | null;
          snow_event_id: string | null;
          route_id: string | null;
          clock_in: string;
          clock_out: string | null;
          break_minutes: number;
          total_minutes: number | null;
          notes: string | null;
          is_manual: boolean;
          correction_reason: string | null;
          corrected_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["time_entries"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["time_entries"]["Insert"]>;
      };
      gallery_projects: {
        Row: {
          id: string;
          title: string;
          slug: string;
          summary: string | null;
          description: string | null;
          property_type: string | null;
          city: string | null;
          category: string;
          services_performed: string[];
          completion_date: string | null;
          cover_image_id: string | null;
          display_order: number;
          featured: boolean;
          status: "draft" | "published" | "archived";
          seo_title: string | null;
          seo_description: string | null;
          publication_date: string | null;
          job_id: string | null;
          customer_consent_id: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["gallery_projects"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["gallery_projects"]["Insert"]>;
      };
      gallery_images: {
        Row: {
          id: string;
          project_id: string;
          storage_path: string;
          url: string;
          thumbnail_url: string | null;
          caption: string | null;
          alt_text: string;
          image_type: "before" | "after" | "during" | "general";
          sort_order: number;
          width: number | null;
          height: number | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["gallery_images"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["gallery_images"]["Insert"]>;
      };
      gallery_consents: {
        Row: {
          id: string;
          customer_id: string;
          project_id: string | null;
          status: "not_requested" | "pending" | "approved" | "approved_with_restrictions" | "declined" | "revoked";
          consent_date: string | null;
          consent_method: string | null;
          recorded_by: string | null;
          allow_name_display: boolean;
          allow_address_display: boolean;
          allow_marketing_use: boolean;
          restrictions: string | null;
          notes: string | null;
          revoked_at: string | null;
          revoked_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["gallery_consents"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["gallery_consents"]["Insert"]>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          body: string;
          action_url: string | null;
          read: boolean;
          read_at: string | null;
          entity_type: string | null;
          entity_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["notifications"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          actor_email: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          before_data: Json | null;
          after_data: Json | null;
          metadata: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          correlation_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["audit_logs"]["Row"], "id" | "created_at">;
        Update: never;
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_next_number: {
        Args: { prefix: string; year: number };
        Returns: string;
      };
      has_permission: {
        Args: { user_id: string; permission: string };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: AppRole;
      lead_status: LeadStatus;
      estimate_status: EstimateStatus;
      contract_status: ContractStatus;
      job_status: JobStatus;
      snow_event_status: SnowEventStatus;
      route_type: RouteType;
      invoice_status: InvoiceStatus;
      asset_status: AssetStatus;
      inventory_transaction_type: InventoryTransactionType;
      purchase_order_status: PurchaseOrderStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type AppRole =
  | "owner"
  | "administrator"
  | "operations_manager"
  | "office_manager"
  | "estimator"
  | "crew_leader"
  | "crew_member"
  | "snow_operations_manager"
  | "inventory_manager"
  | "bookkeeper"
  | "read_only"
  | "customer";

export type LeadStatus =
  | "new"
  | "contacted"
  | "site_visit_scheduled"
  | "site_visit_completed"
  | "estimate_in_progress"
  | "estimate_sent"
  | "awaiting_customer"
  | "won"
  | "lost"
  | "archived";

export type EstimateStatus =
  | "draft"
  | "ready_for_review"
  | "sent"
  | "viewed"
  | "changes_requested"
  | "approved"
  | "declined"
  | "expired"
  | "converted"
  | "voided";

export type ContractStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "approved"
  | "active"
  | "suspended"
  | "expired"
  | "renewed"
  | "cancelled"
  | "completed";

export type JobStatus =
  | "pending_approval"
  | "approved"
  | "awaiting_deposit"
  | "awaiting_materials"
  | "ready_to_schedule"
  | "scheduled"
  | "en_route"
  | "arrived"
  | "in_progress"
  | "paused"
  | "quality_review"
  | "completed"
  | "follow_up_required"
  | "cancelled"
  | "weather_delayed"
  | "archived";

export type SnowEventStatus =
  | "monitoring"
  | "preparing"
  | "activated"
  | "in_progress"
  | "paused"
  | "cleanup"
  | "completed"
  | "cancelled";

export type RouteType =
  | "mowing"
  | "general_maintenance"
  | "snow_plowing"
  | "salting"
  | "sidewalk_clearing"
  | "inspection"
  | "estimate_visits";

export type InvoiceStatus =
  | "draft"
  | "issued"
  | "sent"
  | "viewed"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "voided"
  | "refunded"
  | "written_off";

export type AssetStatus =
  | "available"
  | "assigned"
  | "in_use"
  | "maintenance_due"
  | "out_of_service"
  | "retired"
  | "sold";

export type InventoryTransactionType =
  | "initial_stock"
  | "purchase_receipt"
  | "job_usage"
  | "snow_event_usage"
  | "return_from_job"
  | "supplier_return"
  | "adjustment"
  | "damage"
  | "loss"
  | "transfer"
  | "cycle_count"
  | "disposal"
  | "expiration";

export type PurchaseOrderStatus =
  | "draft"
  | "submitted"
  | "confirmed"
  | "partially_received"
  | "received"
  | "cancelled"
  | "closed";

// Row helpers
export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type Property = Database["public"]["Tables"]["properties"]["Row"];
export type Lead = Database["public"]["Tables"]["leads"]["Row"];
export type Estimate = Database["public"]["Tables"]["estimates"]["Row"];
export type EstimateItem = Database["public"]["Tables"]["estimate_items"]["Row"];
export type Contract = Database["public"]["Tables"]["contracts"]["Row"];
export type Job = Database["public"]["Tables"]["jobs"]["Row"];
export type SnowEvent = Database["public"]["Tables"]["snow_events"]["Row"];
export type Route = Database["public"]["Tables"]["routes"]["Row"];
export type RouteStop = Database["public"]["Tables"]["route_stops"]["Row"];
export type Invoice = Database["public"]["Tables"]["invoices"]["Row"];
export type InvoiceItem = Database["public"]["Tables"]["invoice_items"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Asset = Database["public"]["Tables"]["assets"]["Row"];
export type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];
export type PurchaseOrder = Database["public"]["Tables"]["purchase_orders"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Crew = Database["public"]["Tables"]["crews"]["Row"];
export type TimeEntry = Database["public"]["Tables"]["time_entries"]["Row"];
export type GalleryProject = Database["public"]["Tables"]["gallery_projects"]["Row"];
export type GalleryImage = Database["public"]["Tables"]["gallery_images"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];
export type BusinessSettings = Database["public"]["Tables"]["business_settings"]["Row"];
