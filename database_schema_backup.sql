-- ============================================
-- G&G CoreFlow ERP 数据库结构备份
-- 生成时间: 2025-11-13T08:45:19.425Z
-- 用途: 用于重建数据库结构
-- ============================================

-- 设置时区
SET timezone = 'UTC';

-- ============================================
-- 表: oms.delivery_appointments
-- ============================================
CREATE TABLE IF NOT EXISTS oms.delivery_appointments (
  appointment_id BIGINT NOT NULL,
  order_id BIGINT,
  location_id BIGINT,
  appointment_type_code VARCHAR(50),
  requested_start TIMESTAMPTZ,
  requested_end TIMESTAMPTZ,
  confirmed_start TIMESTAMPTZ,
  confirmed_end TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'requested',
  reference_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT,
  updated_by BIGINT
);

ALTER TABLE oms.delivery_appointments ADD PRIMARY KEY (appointment_id);

-- ============================================
-- 表: oms.order_allocations
-- ============================================
CREATE TABLE IF NOT EXISTS oms.order_allocations (
  allocation_id BIGINT NOT NULL,
  order_id BIGINT NOT NULL,
  allocation_entity_type VARCHAR(50) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by BIGINT,
  updated_by BIGINT
);

ALTER TABLE oms.order_allocations ADD PRIMARY KEY (allocation_id);

-- ============================================
-- 表: oms.order_requirements
-- ============================================
CREATE TABLE IF NOT EXISTS oms.order_requirements (
  requirement_id BIGINT NOT NULL,
  order_id BIGINT NOT NULL,
  requirement_type VARCHAR(50) NOT NULL,
  requirement_value TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by BIGINT,
  updated_by BIGINT
);

ALTER TABLE oms.order_requirements ADD PRIMARY KEY (requirement_id);

-- ============================================
-- 表: public.appointment_types
-- ============================================
CREATE TABLE IF NOT EXISTS public.appointment_types (
  appointment_type_code VARCHAR(50) NOT NULL,
  description VARCHAR(200),
  default_duration_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by BIGINT,
  updated_by BIGINT
);

ALTER TABLE public.appointment_types ADD PRIMARY KEY (appointment_type_code);

-- ============================================
-- 表: public.calendar_dim
-- ============================================
CREATE TABLE IF NOT EXISTS public.calendar_dim (
  calendar_date DATE NOT NULL,
  year INTEGER NOT NULL,
  quarter INTEGER NOT NULL,
  month INTEGER NOT NULL,
  month_name VARCHAR(20),
  week_of_year INTEGER,
  day_of_week INTEGER,
  day_name VARCHAR(20),
  is_weekend BOOLEAN,
  is_holiday BOOLEAN DEFAULT false
);

ALTER TABLE public.calendar_dim ADD PRIMARY KEY (calendar_date);

-- ============================================
-- 表: public.carrier_service_levels
-- ============================================
CREATE TABLE IF NOT EXISTS public.carrier_service_levels (
  service_level_id BIGINT NOT NULL,
  carrier_id BIGINT,
  service_level_code VARCHAR(50) NOT NULL,
  description VARCHAR(200),
  transit_time_days INTEGER,
  on_time_target NUMERIC(5, 2),
  effective_from DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by BIGINT,
  updated_by BIGINT
);

ALTER TABLE public.carrier_service_levels ADD PRIMARY KEY (service_level_id);

-- ============================================
-- 表: public.carriers
-- ============================================
CREATE TABLE IF NOT EXISTS public.carriers (
  carrier_id BIGINT NOT NULL,
  carrier_code VARCHAR(50),
  name VARCHAR(200) NOT NULL,
  carrier_type VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  contact_id BIGINT,
  created_by BIGINT,
  updated_by BIGINT
);

ALTER TABLE public.carriers ADD PRIMARY KEY (carrier_id);

-- ============================================
-- 表: public.contact_roles
-- ============================================
CREATE TABLE IF NOT EXISTS public.contact_roles (
  contact_id BIGINT NOT NULL,
  related_entity_type VARCHAR(50) NOT NULL,
  related_entity_id BIGINT NOT NULL,
  role VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(200),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  address_line1 VARCHAR(200),
  address_line2 VARCHAR(200),
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  is_primary BOOLEAN DEFAULT false,
  created_by BIGINT,
  updated_by BIGINT
);

ALTER TABLE public.contact_roles ADD PRIMARY KEY (contact_id);

-- ============================================
-- 表: public.customers
-- ============================================
CREATE TABLE IF NOT EXISTS public.customers (
  id BIGINT NOT NULL DEFAULT nextval('customers_id_seq',
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  company_name VARCHAR(200),
  credit_limit NUMERIC(12, 2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  contact_id BIGINT,
  created_by BIGINT,
  updated_by BIGINT
);

ALTER TABLE public.customers ADD PRIMARY KEY (id);

-- ============================================
-- 表: public.delivery_status_codes
-- ============================================
CREATE TABLE IF NOT EXISTS public.delivery_status_codes (
  status_code VARCHAR(50) NOT NULL,
  description VARCHAR(200),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by BIGINT,
  updated_by BIGINT
);

ALTER TABLE public.delivery_status_codes ADD PRIMARY KEY (status_code);

-- ============================================
-- 表: public.departments
-- ============================================
CREATE TABLE IF NOT EXISTS public.departments (
  id BIGINT NOT NULL DEFAULT nextval('departments_id_seq',
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL,
  parent_id BIGINT,
  manager_id BIGINT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT,
  updated_by BIGINT
);

ALTER TABLE public.departments ADD PRIMARY KEY (id);

-- ============================================
-- 表: public.document_links
-- ============================================
CREATE TABLE IF NOT EXISTS public.document_links (
  document_id BIGINT NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id BIGINT NOT NULL,
  document_type VARCHAR(50) NOT NULL,
  document_name VARCHAR(200),
  document_url TEXT NOT NULL,
  metadata JSONB,
  uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  uploaded_by BIGINT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by BIGINT,
  updated_by BIGINT
);

ALTER TABLE public.document_links ADD PRIMARY KEY (document_id);

-- ============================================
-- 表: public.drivers
-- ============================================
CREATE TABLE IF NOT EXISTS public.drivers (
  driver_id BIGINT NOT NULL,
  carrier_id BIGINT,
  driver_code VARCHAR(50),
  license_number VARCHAR(100),
  license_expiration DATE,
  notes TEXT,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  contact_id BIGINT,
  created_by BIGINT,
  updated_by BIGINT
);

ALTER TABLE public.drivers ADD PRIMARY KEY (driver_id);

-- ============================================
-- 表: public.events_log
-- ============================================
CREATE TABLE IF NOT EXISTS public.events_log (
  event_id BIGINT NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id BIGINT NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_time TIMESTAMPTZ NOT NULL,
  location_id BIGINT,
  status_code VARCHAR(50),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by BIGINT
);

ALTER TABLE public.events_log ADD PRIMARY KEY (event_id);

-- ============================================
-- 表: public.locations
-- ============================================
CREATE TABLE IF NOT EXISTS public.locations (
  location_id BIGINT NOT NULL,
  location_code VARCHAR(50),
  name VARCHAR(200) NOT NULL,
  location_type VARCHAR(50) NOT NULL,
  address_line1 VARCHAR(200),
  address_line2 VARCHAR(200),
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  timezone VARCHAR(100),
  latitude NUMERIC(10, 6),
  longitude NUMERIC(10, 6),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT,
  updated_by BIGINT
);

ALTER TABLE public.locations ADD PRIMARY KEY (location_id);

-- ============================================
-- 表: public.order_detail
-- ============================================
CREATE TABLE IF NOT EXISTS public.order_detail (
  id BIGINT NOT NULL DEFAULT nextval('order_detail_id_seq',
  order_id BIGINT,
  detail_id BIGINT,
  quantity INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  volume NUMERIC(null, null),
  container_volume NUMERIC(null, null),
  estimated_pallets INTEGER,
  created_by BIGINT,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_by BIGINT
);

ALTER TABLE public.order_detail ADD PRIMARY KEY (id);

-- ============================================
-- 表: public.order_detail_item
-- ============================================
CREATE TABLE IF NOT EXISTS public.order_detail_item (
  id BIGINT NOT NULL DEFAULT nextval('order_detail_item_id_seq',
  detail_name VARCHAR(50) NOT NULL,
  sku VARCHAR(200) NOT NULL,
  description TEXT,
  stock_quantity INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  fba VARCHAR(100),
  created_by BIGINT,
  updated_by BIGINT,
  detail_id BIGINT,
  volume NUMERIC(null, null)
);

ALTER TABLE public.order_detail_item ADD PRIMARY KEY (id);

-- ============================================
-- 表: public.orders
-- ============================================
CREATE TABLE IF NOT EXISTS public.orders (
  order_id BIGINT NOT NULL DEFAULT nextval('orders_order_id_seq',
  order_number VARCHAR(50) NOT NULL,
  customer_id BIGINT,
  user_id BIGINT,
  order_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  total_amount NUMERIC(12, 2) NOT NULL,
  discount_amount NUMERIC(12, 2) DEFAULT 0,
  tax_amount NUMERIC(12, 2) DEFAULT 0,
  final_amount NUMERIC(12, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  eta_date DATE,
  lfd_date DATE,
  pickup_date DATE,
  created_by BIGINT,
  updated_by BIGINT
);

ALTER TABLE public.orders ADD PRIMARY KEY (order_id);

-- ============================================
-- 表: public.shift_dim
-- ============================================
CREATE TABLE IF NOT EXISTS public.shift_dim (
  shift_id BIGINT NOT NULL,
  warehouse_id BIGINT,
  shift_code VARCHAR(50) NOT NULL,
  description VARCHAR(200),
  start_time TIME,
  end_time TIME,
  is_active BOOLEAN DEFAULT true
);

ALTER TABLE public.shift_dim ADD PRIMARY KEY (shift_id);

-- ============================================
-- 表: public.trailers
-- ============================================
CREATE TABLE IF NOT EXISTS public.trailers (
  trailer_id BIGINT NOT NULL,
  department_id BIGINT,
  trailer_code VARCHAR(50),
  trailer_type VARCHAR(50),
  length_feet NUMERIC(5, 2),
  capacity_weight NUMERIC(12, 2),
  capacity_volume NUMERIC(12, 2),
  status VARCHAR(50) DEFAULT 'available',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT,
  updated_by BIGINT
);

ALTER TABLE public.trailers ADD PRIMARY KEY (trailer_id);

-- ============================================
-- 表: public.unload_methods
-- ============================================
CREATE TABLE IF NOT EXISTS public.unload_methods (
  method_code VARCHAR(50) NOT NULL,
  description VARCHAR(200),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by BIGINT,
  updated_by BIGINT
);

ALTER TABLE public.unload_methods ADD PRIMARY KEY (method_code);

-- ============================================
-- 表: public.users
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
  id BIGINT NOT NULL DEFAULT nextval('users_id_seq',
  username VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100),
  department_id BIGINT,
  role VARCHAR(50) DEFAULT 'employee',
  status VARCHAR(20) DEFAULT 'active',
  phone VARCHAR(20),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT,
  updated_by BIGINT
);

ALTER TABLE public.users ADD PRIMARY KEY (id);

-- ============================================
-- 表: public.vehicles
-- ============================================
CREATE TABLE IF NOT EXISTS public.vehicles (
  vehicle_id BIGINT NOT NULL,
  carrier_id BIGINT,
  vehicle_code VARCHAR(50),
  plate_number VARCHAR(50),
  vehicle_type VARCHAR(50),
  vin VARCHAR(100),
  capacity_weight NUMERIC(12, 2),
  capacity_volume NUMERIC(12, 2),
  status VARCHAR(50) DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT,
  updated_by BIGINT
);

ALTER TABLE public.vehicles ADD PRIMARY KEY (vehicle_id);

-- ============================================
-- 表: public.warehouses
-- ============================================
CREATE TABLE IF NOT EXISTS public.warehouses (
  warehouse_id BIGINT NOT NULL,
  location_id BIGINT,
  warehouse_code VARCHAR(50),
  name VARCHAR(200) NOT NULL,
  capacity_cbm NUMERIC(12, 2),
  operating_hours JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  contact_user_id BIGINT,
  created_by BIGINT,
  updated_by BIGINT
);

ALTER TABLE public.warehouses ADD PRIMARY KEY (warehouse_id);

-- ============================================
-- 表: tms.container_legs
-- ============================================
CREATE TABLE IF NOT EXISTS tms.container_legs (
  container_leg_id BIGINT NOT NULL,
  container_id BIGINT NOT NULL,
  sequence_number INTEGER NOT NULL,
  origin_location_id BIGINT,
  destination_location_id BIGINT,
  planned_departure TIMESTAMPTZ,
  planned_arrival TIMESTAMPTZ,
  actual_departure TIMESTAMPTZ,
  actual_arrival TIMESTAMPTZ,
  mode VARCHAR(50),
  carrier_id BIGINT,
  vehicle_id BIGINT,
  status VARCHAR(50) DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by BIGINT,
  updated_by BIGINT
);

ALTER TABLE tms.container_legs ADD PRIMARY KEY (container_leg_id);

-- ============================================
-- 表: tms.containers
-- ============================================
CREATE TABLE IF NOT EXISTS tms.containers (
  container_id BIGINT NOT NULL,
  status VARCHAR(50) DEFAULT 'planned',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  source_type VARCHAR(50) NOT NULL DEFAULT 'sea_container',
  created_by BIGINT,
  updated_by BIGINT,
  order_id BIGINT,
  trailer_id BIGINT
);

ALTER TABLE tms.containers ADD PRIMARY KEY (container_id);

-- ============================================
-- 表: tms.freight_bills
-- ============================================
CREATE TABLE IF NOT EXISTS tms.freight_bills (
  freight_bill_id BIGINT NOT NULL,
  reference_type VARCHAR(50) NOT NULL,
  reference_id BIGINT NOT NULL,
  carrier_id BIGINT,
  bill_number VARCHAR(100),
  amount NUMERIC(12, 2),
  currency VARCHAR(10) DEFAULT 'USD',
  billing_date DATE,
  due_date DATE,
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_by BIGINT
);

ALTER TABLE tms.freight_bills ADD PRIMARY KEY (freight_bill_id);

-- ============================================
-- 表: wms.inbound_receipt
-- ============================================
CREATE TABLE IF NOT EXISTS wms.inbound_receipt (
  inbound_receipt_id BIGINT NOT NULL,
  notes TEXT,
  order_id BIGINT NOT NULL,
  unloaded_by VARCHAR(null),
  received_by BIGINT,
  warehouse_id BIGINT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT,
  updated_by BIGINT,
  planned_unload_at DATE,
  unload_method_code VARCHAR(50)
);

ALTER TABLE wms.inbound_receipt ADD PRIMARY KEY (inbound_receipt_id);

-- ============================================
-- 表: wms.inventory_lots
-- ============================================
CREATE TABLE IF NOT EXISTS wms.inventory_lots (
  inventory_lot_id BIGINT NOT NULL,
  warehouse_id BIGINT NOT NULL,
  storage_location_code VARCHAR(100),
  status VARCHAR(50) DEFAULT 'available',
  notes TEXT,
  order_id BIGINT NOT NULL,
  order_detail_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT,
  updated_by BIGINT,
  inbound_receipt_id BIGINT,
  lot_number VARCHAR(50),
  received_date DATE,
  pallet_count INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE wms.inventory_lots ADD PRIMARY KEY (inventory_lot_id);

-- ============================================
-- 表: wms.outbound_shipment_lines
-- ============================================
CREATE TABLE IF NOT EXISTS wms.outbound_shipment_lines (
  outbound_shipment_line_id BIGINT NOT NULL,
  outbound_shipment_id BIGINT,
  notes TEXT,
  order_id BIGINT NOT NULL,
  order_detail_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT,
  updated_by BIGINT,
  quantity INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE wms.outbound_shipment_lines ADD PRIMARY KEY (outbound_shipment_line_id);

-- ============================================
-- 表: wms.outbound_shipments
-- ============================================
CREATE TABLE IF NOT EXISTS wms.outbound_shipments (
  outbound_shipment_id BIGINT NOT NULL,
  warehouse_id BIGINT NOT NULL,
  shipment_number VARCHAR(100),
  scheduled_load_time TIMESTAMPTZ,
  actual_load_time TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'planned',
  total_pallets INTEGER,
  total_volume NUMERIC(14, 4),
  total_weight NUMERIC(14, 4),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  destination_location_id BIGINT NOT NULL,
  trailer_id BIGINT,
  loaded_by BIGINT,
  created_by BIGINT,
  updated_by BIGINT,
  bol_document_id BIGINT,
  load_sheet_document_id BIGINT
);

ALTER TABLE wms.outbound_shipments ADD PRIMARY KEY (outbound_shipment_id);

-- ============================================
-- 表: wms.putaway_tasks
-- ============================================
CREATE TABLE IF NOT EXISTS wms.putaway_tasks (
  putaway_task_id BIGINT NOT NULL,
  inbound_receipt_detail_id BIGINT,
  warehouse_id BIGINT,
  storage_location_code VARCHAR(100),
  assigned_to VARCHAR(100),
  assigned_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT
);

ALTER TABLE wms.putaway_tasks ADD PRIMARY KEY (putaway_task_id);

-- ============================================
-- 表: wms.wms_labor_logs
-- ============================================
CREATE TABLE IF NOT EXISTS wms.wms_labor_logs (
  labor_log_id BIGINT NOT NULL,
  warehouse_id BIGINT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  hours_worked NUMERIC(10, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT,
  updated_by BIGINT
);

ALTER TABLE wms.wms_labor_logs ADD PRIMARY KEY (labor_log_id);

-- ============================================
-- 外键约束
-- ============================================

ALTER TABLE oms.delivery_appointments
  ADD CONSTRAINT delivery_appointments_appointment_type_code_fkey
  FOREIGN KEY (appointment_type_code)
  REFERENCES public.appointment_types (appointment_type_code)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE oms.delivery_appointments
  ADD CONSTRAINT delivery_appointments_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE oms.delivery_appointments
  ADD CONSTRAINT delivery_appointments_location_id_fkey
  FOREIGN KEY (location_id)
  REFERENCES public.locations (location_id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE oms.delivery_appointments
  ADD CONSTRAINT delivery_appointments_order_id_fkey
  FOREIGN KEY (order_id)
  REFERENCES public.orders (order_id)
  ON UPDATE NO ACTION
  ON DELETE CASCADE;

ALTER TABLE oms.delivery_appointments
  ADD CONSTRAINT delivery_appointments_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE oms.order_allocations
  ADD CONSTRAINT order_allocations_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE oms.order_allocations
  ADD CONSTRAINT order_allocations_order_id_fkey
  FOREIGN KEY (order_id)
  REFERENCES public.orders (order_id)
  ON UPDATE NO ACTION
  ON DELETE CASCADE;

ALTER TABLE oms.order_allocations
  ADD CONSTRAINT order_allocations_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE oms.order_requirements
  ADD CONSTRAINT order_requirements_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE oms.order_requirements
  ADD CONSTRAINT order_requirements_order_id_fkey
  FOREIGN KEY (order_id)
  REFERENCES public.orders (order_id)
  ON UPDATE NO ACTION
  ON DELETE CASCADE;

ALTER TABLE oms.order_requirements
  ADD CONSTRAINT order_requirements_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.appointment_types
  ADD CONSTRAINT appointment_types_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.appointment_types
  ADD CONSTRAINT appointment_types_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.carrier_service_levels
  ADD CONSTRAINT carrier_service_levels_carrier_id_fkey
  FOREIGN KEY (carrier_id)
  REFERENCES public.carriers (carrier_id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.carrier_service_levels
  ADD CONSTRAINT carrier_service_levels_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.carrier_service_levels
  ADD CONSTRAINT carrier_service_levels_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.carriers
  ADD CONSTRAINT carriers_contact_id_fkey
  FOREIGN KEY (contact_id)
  REFERENCES public.contact_roles (contact_id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.carriers
  ADD CONSTRAINT carriers_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.carriers
  ADD CONSTRAINT carriers_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.contact_roles
  ADD CONSTRAINT contact_roles_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.contact_roles
  ADD CONSTRAINT contact_roles_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_contact_id_fkey
  FOREIGN KEY (contact_id)
  REFERENCES public.contact_roles (contact_id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.delivery_status_codes
  ADD CONSTRAINT delivery_status_codes_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.delivery_status_codes
  ADD CONSTRAINT delivery_status_codes_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.departments
  ADD CONSTRAINT departments_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.departments
  ADD CONSTRAINT departments_parent_id_fkey
  FOREIGN KEY (parent_id)
  REFERENCES public.departments (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.departments
  ADD CONSTRAINT departments_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.document_links
  ADD CONSTRAINT document_links_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.document_links
  ADD CONSTRAINT document_links_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.document_links
  ADD CONSTRAINT document_links_uploaded_by_fkey
  FOREIGN KEY (uploaded_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_carrier_id_fkey
  FOREIGN KEY (carrier_id)
  REFERENCES public.carriers (carrier_id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_contact_id_fkey
  FOREIGN KEY (contact_id)
  REFERENCES public.contact_roles (contact_id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.events_log
  ADD CONSTRAINT events_log_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.events_log
  ADD CONSTRAINT events_log_location_id_fkey
  FOREIGN KEY (location_id)
  REFERENCES public.locations (location_id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.events_log
  ADD CONSTRAINT events_log_status_code_fkey
  FOREIGN KEY (status_code)
  REFERENCES public.delivery_status_codes (status_code)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.events_log
  ADD CONSTRAINT events_log_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.locations
  ADD CONSTRAINT locations_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.locations
  ADD CONSTRAINT locations_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.order_detail
  ADD CONSTRAINT order_detail_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.order_detail
  ADD CONSTRAINT order_detail_detail_id_fkey
  FOREIGN KEY (detail_id)
  REFERENCES public.order_detail_item (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.order_detail
  ADD CONSTRAINT order_detail_order_id_fkey
  FOREIGN KEY (order_id)
  REFERENCES public.orders (order_id)
  ON UPDATE NO ACTION
  ON DELETE CASCADE;

ALTER TABLE public.order_detail
  ADD CONSTRAINT order_detail_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.order_detail_item
  ADD CONSTRAINT order_detail_item_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.order_detail_item
  ADD CONSTRAINT order_detail_item_detail_id_fkey
  FOREIGN KEY (detail_id)
  REFERENCES public.order_detail (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.order_detail_item
  ADD CONSTRAINT order_detail_item_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.shift_dim
  ADD CONSTRAINT shift_dim_warehouse_id_fkey
  FOREIGN KEY (warehouse_id)
  REFERENCES public.warehouses (warehouse_id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.trailers
  ADD CONSTRAINT trailers_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.trailers
  ADD CONSTRAINT trailers_department_id_fkey
  FOREIGN KEY (department_id)
  REFERENCES public.departments (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.trailers
  ADD CONSTRAINT trailers_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.unload_methods
  ADD CONSTRAINT unload_methods_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.unload_methods
  ADD CONSTRAINT unload_methods_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.users
  ADD CONSTRAINT users_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.users
  ADD CONSTRAINT users_department_id_fkey
  FOREIGN KEY (department_id)
  REFERENCES public.departments (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.users
  ADD CONSTRAINT users_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_carrier_id_fkey
  FOREIGN KEY (carrier_id)
  REFERENCES public.carriers (carrier_id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.warehouses
  ADD CONSTRAINT warehouses_contact_user_id_fkey
  FOREIGN KEY (contact_user_id)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.warehouses
  ADD CONSTRAINT warehouses_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.warehouses
  ADD CONSTRAINT warehouses_location_id_fkey
  FOREIGN KEY (location_id)
  REFERENCES public.locations (location_id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE public.warehouses
  ADD CONSTRAINT warehouses_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE tms.container_legs
  ADD CONSTRAINT container_legs_carrier_id_fkey
  FOREIGN KEY (carrier_id)
  REFERENCES public.carriers (carrier_id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE tms.container_legs
  ADD CONSTRAINT container_legs_container_id_fkey
  FOREIGN KEY (container_id)
  REFERENCES tms.containers (container_id)
  ON UPDATE NO ACTION
  ON DELETE CASCADE;

ALTER TABLE tms.container_legs
  ADD CONSTRAINT container_legs_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE tms.container_legs
  ADD CONSTRAINT container_legs_destination_location_id_fkey
  FOREIGN KEY (destination_location_id)
  REFERENCES public.locations (location_id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE tms.container_legs
  ADD CONSTRAINT container_legs_origin_location_id_fkey
  FOREIGN KEY (origin_location_id)
  REFERENCES public.locations (location_id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE tms.container_legs
  ADD CONSTRAINT container_legs_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE tms.container_legs
  ADD CONSTRAINT container_legs_vehicle_id_fkey
  FOREIGN KEY (vehicle_id)
  REFERENCES public.vehicles (vehicle_id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE tms.containers
  ADD CONSTRAINT containers_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE SET NULL;

ALTER TABLE tms.containers
  ADD CONSTRAINT containers_order_id_fkey
  FOREIGN KEY (order_id)
  REFERENCES public.orders (order_id)
  ON UPDATE NO ACTION
  ON DELETE SET NULL;

ALTER TABLE tms.containers
  ADD CONSTRAINT containers_trailer_id_fkey
  FOREIGN KEY (trailer_id)
  REFERENCES public.trailers (trailer_id)
  ON UPDATE NO ACTION
  ON DELETE SET NULL;

ALTER TABLE tms.containers
  ADD CONSTRAINT containers_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE SET NULL;

ALTER TABLE tms.freight_bills
  ADD CONSTRAINT freight_bills_carrier_id_fkey
  FOREIGN KEY (carrier_id)
  REFERENCES public.carriers (carrier_id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE tms.freight_bills
  ADD CONSTRAINT freight_bills_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE tms.freight_bills
  ADD CONSTRAINT freight_bills_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE wms.inbound_receipt
  ADD CONSTRAINT inbound_receipt_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE wms.inbound_receipt
  ADD CONSTRAINT inbound_receipt_order_id_fkey
  FOREIGN KEY (order_id)
  REFERENCES public.orders (order_id)
  ON UPDATE NO ACTION
  ON DELETE CASCADE;

ALTER TABLE wms.inbound_receipt
  ADD CONSTRAINT inbound_receipt_received_by_fkey
  FOREIGN KEY (received_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE wms.inbound_receipt
  ADD CONSTRAINT inbound_receipt_unload_method_code_fkey
  FOREIGN KEY (unload_method_code)
  REFERENCES public.unload_methods (method_code)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE wms.inbound_receipt
  ADD CONSTRAINT inbound_receipt_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE wms.inbound_receipt
  ADD CONSTRAINT inbound_receipt_warehouse_id_fkey
  FOREIGN KEY (warehouse_id)
  REFERENCES public.warehouses (warehouse_id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE wms.inventory_lots
  ADD CONSTRAINT inventory_lots_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE wms.inventory_lots
  ADD CONSTRAINT inventory_lots_inbound_receipt_id_fkey
  FOREIGN KEY (inbound_receipt_id)
  REFERENCES wms.inbound_receipt (inbound_receipt_id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE wms.inventory_lots
  ADD CONSTRAINT inventory_lots_order_detail_id_fkey
  FOREIGN KEY (order_detail_id)
  REFERENCES public.order_detail (id)
  ON UPDATE NO ACTION
  ON DELETE CASCADE;

ALTER TABLE wms.inventory_lots
  ADD CONSTRAINT inventory_lots_order_id_fkey
  FOREIGN KEY (order_id)
  REFERENCES public.orders (order_id)
  ON UPDATE NO ACTION
  ON DELETE CASCADE;

ALTER TABLE wms.inventory_lots
  ADD CONSTRAINT inventory_lots_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE wms.inventory_lots
  ADD CONSTRAINT inventory_lots_warehouse_id_fkey
  FOREIGN KEY (warehouse_id)
  REFERENCES public.warehouses (warehouse_id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE wms.outbound_shipment_lines
  ADD CONSTRAINT outbound_shipment_lines_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE wms.outbound_shipment_lines
  ADD CONSTRAINT outbound_shipment_lines_order_detail_id_fkey
  FOREIGN KEY (order_detail_id)
  REFERENCES public.order_detail (id)
  ON UPDATE NO ACTION
  ON DELETE CASCADE;

ALTER TABLE wms.outbound_shipment_lines
  ADD CONSTRAINT outbound_shipment_lines_order_id_fkey
  FOREIGN KEY (order_id)
  REFERENCES public.orders (order_id)
  ON UPDATE NO ACTION
  ON DELETE CASCADE;

ALTER TABLE wms.outbound_shipment_lines
  ADD CONSTRAINT outbound_shipment_lines_outbound_shipment_id_fkey
  FOREIGN KEY (outbound_shipment_id)
  REFERENCES wms.outbound_shipments (outbound_shipment_id)
  ON UPDATE NO ACTION
  ON DELETE CASCADE;

ALTER TABLE wms.outbound_shipment_lines
  ADD CONSTRAINT outbound_shipment_lines_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE wms.outbound_shipments
  ADD CONSTRAINT outbound_shipments_bol_document_id_fkey
  FOREIGN KEY (bol_document_id)
  REFERENCES public.document_links (document_id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE wms.outbound_shipments
  ADD CONSTRAINT outbound_shipments_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE wms.outbound_shipments
  ADD CONSTRAINT outbound_shipments_destination_location_id_fkey
  FOREIGN KEY (destination_location_id)
  REFERENCES public.locations (location_id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE wms.outbound_shipments
  ADD CONSTRAINT outbound_shipments_load_sheet_document_id_fkey
  FOREIGN KEY (load_sheet_document_id)
  REFERENCES public.document_links (document_id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE wms.outbound_shipments
  ADD CONSTRAINT outbound_shipments_loaded_by_fkey
  FOREIGN KEY (loaded_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE wms.outbound_shipments
  ADD CONSTRAINT outbound_shipments_trailer_id_fkey
  FOREIGN KEY (trailer_id)
  REFERENCES public.trailers (trailer_id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE wms.outbound_shipments
  ADD CONSTRAINT outbound_shipments_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE wms.outbound_shipments
  ADD CONSTRAINT outbound_shipments_warehouse_id_fkey
  FOREIGN KEY (warehouse_id)
  REFERENCES public.warehouses (warehouse_id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE wms.putaway_tasks
  ADD CONSTRAINT putaway_tasks_inbound_receipt_detail_id_fkey
  FOREIGN KEY (inbound_receipt_detail_id)
  REFERENCES wms.inbound_receipt (inbound_receipt_id)
  ON UPDATE NO ACTION
  ON DELETE CASCADE;

ALTER TABLE wms.putaway_tasks
  ADD CONSTRAINT putaway_tasks_warehouse_id_fkey
  FOREIGN KEY (warehouse_id)
  REFERENCES public.warehouses (warehouse_id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE wms.wms_labor_logs
  ADD CONSTRAINT wms_labor_logs_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE wms.wms_labor_logs
  ADD CONSTRAINT wms_labor_logs_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE wms.wms_labor_logs
  ADD CONSTRAINT wms_labor_logs_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

ALTER TABLE wms.wms_labor_logs
  ADD CONSTRAINT wms_labor_logs_warehouse_id_fkey
  FOREIGN KEY (warehouse_id)
  REFERENCES public.warehouses (warehouse_id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

-- ============================================
-- 唯一约束
-- ============================================

ALTER TABLE public.carrier_service_levels
  ADD CONSTRAINT carrier_service_levels_carrier_code_uniq
  UNIQUE (carrier_id, service_level_code);

ALTER TABLE public.carriers
  ADD CONSTRAINT carriers_carrier_code_key
  UNIQUE (carrier_code);

ALTER TABLE public.customers
  ADD CONSTRAINT customers_code_key
  UNIQUE (code);

ALTER TABLE public.departments
  ADD CONSTRAINT departments_code_key
  UNIQUE (code);

ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_driver_code_key
  UNIQUE (driver_code);

ALTER TABLE public.locations
  ADD CONSTRAINT locations_location_code_key
  UNIQUE (location_code);

ALTER TABLE public.order_detail_item
  ADD CONSTRAINT order_detail_item_detail_code_key
  UNIQUE (detail_name);

ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_number_key
  UNIQUE (order_number);

ALTER TABLE public.trailers
  ADD CONSTRAINT trailers_trailer_code_key
  UNIQUE (trailer_code);

ALTER TABLE public.users
  ADD CONSTRAINT users_email_key
  UNIQUE (email);

ALTER TABLE public.users
  ADD CONSTRAINT users_username_key
  UNIQUE (username);

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_plate_number_key
  UNIQUE (plate_number);

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_vehicle_code_key
  UNIQUE (vehicle_code);

ALTER TABLE public.warehouses
  ADD CONSTRAINT warehouses_warehouse_code_key
  UNIQUE (warehouse_code);

ALTER TABLE tms.container_legs
  ADD CONSTRAINT container_legs_container_id_sequence_number_key
  UNIQUE (container_id, sequence_number);

ALTER TABLE tms.freight_bills
  ADD CONSTRAINT freight_bills_bill_number_key
  UNIQUE (bill_number);

ALTER TABLE wms.inbound_receipt
  ADD CONSTRAINT inbound_receipt_order_id_key
  UNIQUE (order_id);

ALTER TABLE wms.outbound_shipment_lines
  ADD CONSTRAINT outbound_shipment_lines_unique
  UNIQUE (outbound_shipment_id, order_detail_id);

ALTER TABLE wms.outbound_shipments
  ADD CONSTRAINT outbound_shipments_shipment_number_key
  UNIQUE (shipment_number);

-- ============================================
-- CHECK 约束
-- ============================================

ALTER TABLE oms.delivery_appointments
  ADD CONSTRAINT 32768_33085_1_not_null
  CHECK (appointment_id IS NOT NULL);

ALTER TABLE oms.order_allocations
  ADD CONSTRAINT 32768_33071_1_not_null
  CHECK (allocation_id IS NOT NULL);

ALTER TABLE oms.order_allocations
  ADD CONSTRAINT 32768_33071_2_not_null
  CHECK (order_id IS NOT NULL);

ALTER TABLE oms.order_allocations
  ADD CONSTRAINT 32768_33071_3_not_null
  CHECK (allocation_entity_type IS NOT NULL);

ALTER TABLE oms.order_requirements
  ADD CONSTRAINT 32768_33057_1_not_null
  CHECK (requirement_id IS NOT NULL);

ALTER TABLE oms.order_requirements
  ADD CONSTRAINT 32768_33057_2_not_null
  CHECK (order_id IS NOT NULL);

ALTER TABLE oms.order_requirements
  ADD CONSTRAINT 32768_33057_3_not_null
  CHECK (requirement_type IS NOT NULL);

ALTER TABLE public.appointment_types
  ADD CONSTRAINT 2200_32885_1_not_null
  CHECK (appointment_type_code IS NOT NULL);

ALTER TABLE public.calendar_dim
  ADD CONSTRAINT 2200_32962_1_not_null
  CHECK (calendar_date IS NOT NULL);

ALTER TABLE public.calendar_dim
  ADD CONSTRAINT 2200_32962_2_not_null
  CHECK (year IS NOT NULL);

ALTER TABLE public.calendar_dim
  ADD CONSTRAINT 2200_32962_3_not_null
  CHECK (quarter IS NOT NULL);

ALTER TABLE public.calendar_dim
  ADD CONSTRAINT 2200_32962_4_not_null
  CHECK (month IS NOT NULL);

ALTER TABLE public.carrier_service_levels
  ADD CONSTRAINT 2200_32951_1_not_null
  CHECK (service_level_id IS NOT NULL);

ALTER TABLE public.carrier_service_levels
  ADD CONSTRAINT 2200_32951_3_not_null
  CHECK (service_level_code IS NOT NULL);

ALTER TABLE public.carriers
  ADD CONSTRAINT 2200_32801_1_not_null
  CHECK (carrier_id IS NOT NULL);

ALTER TABLE public.carriers
  ADD CONSTRAINT 2200_32801_3_not_null
  CHECK (name IS NOT NULL);

ALTER TABLE public.contact_roles
  ADD CONSTRAINT 2200_32941_1_not_null
  CHECK (contact_id IS NOT NULL);

ALTER TABLE public.contact_roles
  ADD CONSTRAINT 2200_32941_2_not_null
  CHECK (related_entity_type IS NOT NULL);

ALTER TABLE public.contact_roles
  ADD CONSTRAINT 2200_32941_3_not_null
  CHECK (related_entity_id IS NOT NULL);

ALTER TABLE public.contact_roles
  ADD CONSTRAINT 2200_32941_4_not_null
  CHECK (role IS NOT NULL);

ALTER TABLE public.contact_roles
  ADD CONSTRAINT 2200_32941_5_not_null
  CHECK (name IS NOT NULL);

ALTER TABLE public.customers
  ADD CONSTRAINT 2200_24633_1_not_null
  CHECK (id IS NOT NULL);

ALTER TABLE public.customers
  ADD CONSTRAINT 2200_24633_2_not_null
  CHECK (code IS NOT NULL);

ALTER TABLE public.customers
  ADD CONSTRAINT 2200_24633_3_not_null
  CHECK (name IS NOT NULL);

ALTER TABLE public.delivery_status_codes
  ADD CONSTRAINT 2200_32878_1_not_null
  CHECK (status_code IS NOT NULL);

ALTER TABLE public.departments
  ADD CONSTRAINT 2200_24577_1_not_null
  CHECK (id IS NOT NULL);

ALTER TABLE public.departments
  ADD CONSTRAINT 2200_24577_2_not_null
  CHECK (name IS NOT NULL);

ALTER TABLE public.departments
  ADD CONSTRAINT 2200_24577_3_not_null
  CHECK (code IS NOT NULL);

ALTER TABLE public.document_links
  ADD CONSTRAINT 2200_32932_1_not_null
  CHECK (document_id IS NOT NULL);

ALTER TABLE public.document_links
  ADD CONSTRAINT 2200_32932_2_not_null
  CHECK (entity_type IS NOT NULL);

ALTER TABLE public.document_links
  ADD CONSTRAINT 2200_32932_3_not_null
  CHECK (entity_id IS NOT NULL);

ALTER TABLE public.document_links
  ADD CONSTRAINT 2200_32932_4_not_null
  CHECK (document_type IS NOT NULL);

ALTER TABLE public.document_links
  ADD CONSTRAINT 2200_32932_6_not_null
  CHECK (document_url IS NOT NULL);

ALTER TABLE public.drivers
  ADD CONSTRAINT 2200_32813_1_not_null
  CHECK (driver_id IS NOT NULL);

ALTER TABLE public.events_log
  ADD CONSTRAINT 2200_32892_1_not_null
  CHECK (event_id IS NOT NULL);

ALTER TABLE public.events_log
  ADD CONSTRAINT 2200_32892_2_not_null
  CHECK (entity_type IS NOT NULL);

ALTER TABLE public.events_log
  ADD CONSTRAINT 2200_32892_3_not_null
  CHECK (entity_id IS NOT NULL);

ALTER TABLE public.events_log
  ADD CONSTRAINT 2200_32892_4_not_null
  CHECK (event_type IS NOT NULL);

ALTER TABLE public.events_log
  ADD CONSTRAINT 2200_32892_5_not_null
  CHECK (event_time IS NOT NULL);

ALTER TABLE public.locations
  ADD CONSTRAINT 2200_32772_1_not_null
  CHECK (location_id IS NOT NULL);

ALTER TABLE public.locations
  ADD CONSTRAINT 2200_32772_3_not_null
  CHECK (name IS NOT NULL);

ALTER TABLE public.locations
  ADD CONSTRAINT 2200_32772_4_not_null
  CHECK (location_type IS NOT NULL);

ALTER TABLE public.order_detail
  ADD CONSTRAINT 2200_24674_1_not_null
  CHECK (id IS NOT NULL);

ALTER TABLE public.order_detail
  ADD CONSTRAINT 2200_24674_4_not_null
  CHECK (quantity IS NOT NULL);

ALTER TABLE public.order_detail_item
  ADD CONSTRAINT 2200_24617_1_not_null
  CHECK (id IS NOT NULL);

ALTER TABLE public.order_detail_item
  ADD CONSTRAINT 2200_24617_2_not_null
  CHECK (detail_name IS NOT NULL);

ALTER TABLE public.order_detail_item
  ADD CONSTRAINT 2200_24617_3_not_null
  CHECK (sku IS NOT NULL);

ALTER TABLE public.orders
  ADD CONSTRAINT 2200_24648_10_not_null
  CHECK (final_amount IS NOT NULL);

ALTER TABLE public.orders
  ADD CONSTRAINT 2200_24648_1_not_null
  CHECK (order_id IS NOT NULL);

ALTER TABLE public.orders
  ADD CONSTRAINT 2200_24648_2_not_null
  CHECK (order_number IS NOT NULL);

ALTER TABLE public.orders
  ADD CONSTRAINT 2200_24648_5_not_null
  CHECK (order_date IS NOT NULL);

ALTER TABLE public.orders
  ADD CONSTRAINT 2200_24648_7_not_null
  CHECK (total_amount IS NOT NULL);

ALTER TABLE public.shift_dim
  ADD CONSTRAINT 2200_32969_1_not_null
  CHECK (shift_id IS NOT NULL);

ALTER TABLE public.shift_dim
  ADD CONSTRAINT 2200_32969_3_not_null
  CHECK (shift_code IS NOT NULL);

ALTER TABLE public.trailers
  ADD CONSTRAINT 2200_32852_1_not_null
  CHECK (trailer_id IS NOT NULL);

ALTER TABLE public.unload_methods
  ADD CONSTRAINT 2200_32871_1_not_null
  CHECK (method_code IS NOT NULL);

ALTER TABLE public.users
  ADD CONSTRAINT 2200_24595_1_not_null
  CHECK (id IS NOT NULL);

ALTER TABLE public.users
  ADD CONSTRAINT 2200_24595_2_not_null
  CHECK (username IS NOT NULL);

ALTER TABLE public.users
  ADD CONSTRAINT 2200_24595_3_not_null
  CHECK (email IS NOT NULL);

ALTER TABLE public.users
  ADD CONSTRAINT 2200_24595_4_not_null
  CHECK (password_hash IS NOT NULL);

ALTER TABLE public.vehicles
  ADD CONSTRAINT 2200_32831_1_not_null
  CHECK (vehicle_id IS NOT NULL);

ALTER TABLE public.warehouses
  ADD CONSTRAINT 2200_32784_1_not_null
  CHECK (warehouse_id IS NOT NULL);

ALTER TABLE public.warehouses
  ADD CONSTRAINT 2200_32784_4_not_null
  CHECK (name IS NOT NULL);

ALTER TABLE tms.container_legs
  ADD CONSTRAINT 32769_33130_1_not_null
  CHECK (container_leg_id IS NOT NULL);

ALTER TABLE tms.container_legs
  ADD CONSTRAINT 32769_33130_2_not_null
  CHECK (container_id IS NOT NULL);

ALTER TABLE tms.container_legs
  ADD CONSTRAINT 32769_33130_3_not_null
  CHECK (sequence_number IS NOT NULL);

ALTER TABLE tms.containers
  ADD CONSTRAINT 32769_33112_16_not_null
  CHECK (source_type IS NOT NULL);

ALTER TABLE tms.containers
  ADD CONSTRAINT 32769_33112_1_not_null
  CHECK (container_id IS NOT NULL);

ALTER TABLE tms.containers
  ADD CONSTRAINT containers_assignment_chk
  CHECK (((((source_type)::text = 'sea_container'::text) AND (order_id IS NOT NULL) AND (trailer_id IS NULL)) OR (((source_type)::text = 'company_trailer'::text) AND (trailer_id IS NOT NULL) AND (order_id IS NULL))));

ALTER TABLE tms.containers
  ADD CONSTRAINT containers_source_type_chk
  CHECK (((source_type)::text = ANY ((ARRAY['sea_container'::character varying, 'company_trailer'::character varying])::text[])));

ALTER TABLE tms.freight_bills
  ADD CONSTRAINT 32769_33310_1_not_null
  CHECK (freight_bill_id IS NOT NULL);

ALTER TABLE tms.freight_bills
  ADD CONSTRAINT 32769_33310_2_not_null
  CHECK (reference_type IS NOT NULL);

ALTER TABLE tms.freight_bills
  ADD CONSTRAINT 32769_33310_3_not_null
  CHECK (reference_id IS NOT NULL);

ALTER TABLE wms.inbound_receipt
  ADD CONSTRAINT 32770_33351_12_not_null
  CHECK (order_id IS NOT NULL);

ALTER TABLE wms.inbound_receipt
  ADD CONSTRAINT 32770_33351_16_not_null
  CHECK (warehouse_id IS NOT NULL);

ALTER TABLE wms.inbound_receipt
  ADD CONSTRAINT 32770_33351_17_not_null
  CHECK (status IS NOT NULL);

ALTER TABLE wms.inbound_receipt
  ADD CONSTRAINT 32770_33351_18_not_null
  CHECK (created_at IS NOT NULL);

ALTER TABLE wms.inbound_receipt
  ADD CONSTRAINT 32770_33351_19_not_null
  CHECK (updated_at IS NOT NULL);

ALTER TABLE wms.inbound_receipt
  ADD CONSTRAINT 32770_33351_1_not_null
  CHECK (inbound_receipt_id IS NOT NULL);

ALTER TABLE wms.inventory_lots
  ADD CONSTRAINT 32770_33391_16_not_null
  CHECK (order_id IS NOT NULL);

ALTER TABLE wms.inventory_lots
  ADD CONSTRAINT 32770_33391_17_not_null
  CHECK (order_detail_id IS NOT NULL);

ALTER TABLE wms.inventory_lots
  ADD CONSTRAINT 32770_33391_18_not_null
  CHECK (created_at IS NOT NULL);

ALTER TABLE wms.inventory_lots
  ADD CONSTRAINT 32770_33391_19_not_null
  CHECK (updated_at IS NOT NULL);

ALTER TABLE wms.inventory_lots
  ADD CONSTRAINT 32770_33391_1_not_null
  CHECK (inventory_lot_id IS NOT NULL);

ALTER TABLE wms.inventory_lots
  ADD CONSTRAINT 32770_33391_25_not_null
  CHECK (pallet_count IS NOT NULL);

ALTER TABLE wms.inventory_lots
  ADD CONSTRAINT 32770_33391_2_not_null
  CHECK (warehouse_id IS NOT NULL);

ALTER TABLE wms.outbound_shipment_lines
  ADD CONSTRAINT 32770_33475_12_not_null
  CHECK (order_id IS NOT NULL);

ALTER TABLE wms.outbound_shipment_lines
  ADD CONSTRAINT 32770_33475_13_not_null
  CHECK (order_detail_id IS NOT NULL);

ALTER TABLE wms.outbound_shipment_lines
  ADD CONSTRAINT 32770_33475_18_not_null
  CHECK (quantity IS NOT NULL);

ALTER TABLE wms.outbound_shipment_lines
  ADD CONSTRAINT 32770_33475_1_not_null
  CHECK (outbound_shipment_line_id IS NOT NULL);

ALTER TABLE wms.outbound_shipments
  ADD CONSTRAINT 32770_33446_15_not_null
  CHECK (destination_location_id IS NOT NULL);

ALTER TABLE wms.outbound_shipments
  ADD CONSTRAINT 32770_33446_1_not_null
  CHECK (outbound_shipment_id IS NOT NULL);

ALTER TABLE wms.outbound_shipments
  ADD CONSTRAINT 32770_33446_4_not_null
  CHECK (warehouse_id IS NOT NULL);

ALTER TABLE wms.putaway_tasks
  ADD CONSTRAINT 32770_33372_1_not_null
  CHECK (putaway_task_id IS NOT NULL);

ALTER TABLE wms.wms_labor_logs
  ADD CONSTRAINT 32770_33500_12_not_null
  CHECK (created_at IS NOT NULL);

ALTER TABLE wms.wms_labor_logs
  ADD CONSTRAINT 32770_33500_13_not_null
  CHECK (user_id IS NOT NULL);

ALTER TABLE wms.wms_labor_logs
  ADD CONSTRAINT 32770_33500_14_not_null
  CHECK (updated_at IS NOT NULL);

ALTER TABLE wms.wms_labor_logs
  ADD CONSTRAINT 32770_33500_1_not_null
  CHECK (labor_log_id IS NOT NULL);

ALTER TABLE wms.wms_labor_logs
  ADD CONSTRAINT 32770_33500_2_not_null
  CHECK (warehouse_id IS NOT NULL);

ALTER TABLE wms.wms_labor_logs
  ADD CONSTRAINT 32770_33500_7_not_null
  CHECK (start_time IS NOT NULL);

ALTER TABLE wms.wms_labor_logs
  ADD CONSTRAINT 32770_33500_8_not_null
  CHECK (end_time IS NOT NULL);

ALTER TABLE wms.wms_labor_logs
  ADD CONSTRAINT 32770_33500_9_not_null
  CHECK (hours_worked IS NOT NULL);

-- ============================================
-- 索引
-- ============================================

-- 索引: carrier_service_levels_carrier_code_uniq on public.carrier_service_levels
CREATE UNIQUE INDEX carrier_service_levels_carrier_code_uniq ON public.carrier_service_levels USING btree (carrier_id, service_level_code);

-- 索引: carriers_carrier_code_key on public.carriers
CREATE UNIQUE INDEX carriers_carrier_code_key ON public.carriers USING btree (carrier_code);

-- 索引: customers_code_key on public.customers
CREATE UNIQUE INDEX customers_code_key ON public.customers USING btree (code);

-- 索引: departments_code_key on public.departments
CREATE UNIQUE INDEX departments_code_key ON public.departments USING btree (code);

-- 索引: drivers_driver_code_key on public.drivers
CREATE UNIQUE INDEX drivers_driver_code_key ON public.drivers USING btree (driver_code);

-- 索引: idx_events_log_entity on public.events_log
CREATE INDEX idx_events_log_entity ON public.events_log USING btree (entity_type, entity_id);

-- 索引: idx_shipment_events_entity on public.events_log
CREATE INDEX idx_shipment_events_entity ON public.events_log USING btree (entity_type, entity_id);

-- 索引: idx_shipment_events_time on public.events_log
CREATE INDEX idx_shipment_events_time ON public.events_log USING btree (event_time);

-- 索引: locations_location_code_key on public.locations
CREATE UNIQUE INDEX locations_location_code_key ON public.locations USING btree (location_code);

-- 索引: idx_order_detail_detail on public.order_detail
CREATE INDEX idx_order_detail_detail ON public.order_detail USING btree (detail_id);

-- 索引: idx_order_detail_order on public.order_detail
CREATE INDEX idx_order_detail_order ON public.order_detail USING btree (order_id);

-- 索引: idx_order_detail_item_detail_code on public.order_detail_item
CREATE INDEX idx_order_detail_item_detail_code ON public.order_detail_item USING btree (detail_name);

-- 索引: order_detail_item_detail_code_key on public.order_detail_item
CREATE UNIQUE INDEX order_detail_item_detail_code_key ON public.order_detail_item USING btree (detail_name);

-- 索引: idx_order_customer on public.orders
CREATE INDEX idx_order_customer ON public.orders USING btree (customer_id);

-- 索引: idx_order_date on public.orders
CREATE INDEX idx_order_date ON public.orders USING btree (order_date);

-- 索引: idx_order_user on public.orders
CREATE INDEX idx_order_user ON public.orders USING btree (user_id);

-- 索引: orders_order_number_key on public.orders
CREATE UNIQUE INDEX orders_order_number_key ON public.orders USING btree (order_number);

-- 索引: trailers_trailer_code_key on public.trailers
CREATE UNIQUE INDEX trailers_trailer_code_key ON public.trailers USING btree (trailer_code);

-- 索引: idx_users_department on public.users
CREATE INDEX idx_users_department ON public.users USING btree (department_id);

-- 索引: idx_users_email on public.users
CREATE INDEX idx_users_email ON public.users USING btree (email);

-- 索引: users_email_key on public.users
CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);

-- 索引: users_username_key on public.users
CREATE UNIQUE INDEX users_username_key ON public.users USING btree (username);

-- 索引: vehicles_plate_number_key on public.vehicles
CREATE UNIQUE INDEX vehicles_plate_number_key ON public.vehicles USING btree (plate_number);

-- 索引: vehicles_vehicle_code_key on public.vehicles
CREATE UNIQUE INDEX vehicles_vehicle_code_key ON public.vehicles USING btree (vehicle_code);

-- 索引: warehouses_warehouse_code_key on public.warehouses
CREATE UNIQUE INDEX warehouses_warehouse_code_key ON public.warehouses USING btree (warehouse_code);

-- 索引: container_legs_container_id_sequence_number_key on tms.container_legs
CREATE UNIQUE INDEX container_legs_container_id_sequence_number_key ON tms.container_legs USING btree (container_id, sequence_number);

-- 索引: freight_bills_bill_number_key on tms.freight_bills
CREATE UNIQUE INDEX freight_bills_bill_number_key ON tms.freight_bills USING btree (bill_number);

-- 索引: inbound_receipt_order_id_key on wms.inbound_receipt
CREATE UNIQUE INDEX inbound_receipt_order_id_key ON wms.inbound_receipt USING btree (order_id);

-- 索引: idx_inventory_lots_inbound_receipt_id on wms.inventory_lots
CREATE INDEX idx_inventory_lots_inbound_receipt_id ON wms.inventory_lots USING btree (inbound_receipt_id);

-- 索引: idx_inventory_lots_order_detail_status on wms.inventory_lots
CREATE INDEX idx_inventory_lots_order_detail_status ON wms.inventory_lots USING btree (order_detail_id, status);

-- 索引: idx_inventory_lots_status on wms.inventory_lots
CREATE INDEX idx_inventory_lots_status ON wms.inventory_lots USING btree (status);

-- 索引: outbound_shipment_lines_unique on wms.outbound_shipment_lines
CREATE UNIQUE INDEX outbound_shipment_lines_unique ON wms.outbound_shipment_lines USING btree (outbound_shipment_id, order_detail_id);

-- 索引: outbound_shipments_shipment_number_key on wms.outbound_shipments
CREATE UNIQUE INDEX outbound_shipments_shipment_number_key ON wms.outbound_shipments USING btree (shipment_number);

-- ============================================
-- 触发器函数
-- ============================================

-- 函数: public.update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$

      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      
$$ LANGUAGE plpgsql;

-- 函数: wms.calculate_hours_worked
CREATE OR REPLACE FUNCTION wms.calculate_hours_worked()
RETURNS TRIGGER AS $$

BEGIN
  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    NEW.hours_worked := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600.0;
  ELSE
    NEW.hours_worked := NULL;
  END IF;
  RETURN NEW;
END;

$$ LANGUAGE plpgsql;

-- ============================================
-- 触发器
-- ============================================

-- 触发器: update_oms_delivery_appointments_updated_at on oms.delivery_appointments
CREATE TRIGGER update_oms_delivery_appointments_updated_at
  BEFORE UPDATE
  ON oms.delivery_appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_oms_order_allocations_updated_at on oms.order_allocations
CREATE TRIGGER update_oms_order_allocations_updated_at
  BEFORE UPDATE
  ON oms.order_allocations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_oms_order_requirements_updated_at on oms.order_requirements
CREATE TRIGGER update_oms_order_requirements_updated_at
  BEFORE UPDATE
  ON oms.order_requirements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_public_appointment_types_updated_at on public.appointment_types
CREATE TRIGGER update_public_appointment_types_updated_at
  BEFORE UPDATE
  ON public.appointment_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_public_carrier_service_levels_updated_at on public.carrier_service_levels
CREATE TRIGGER update_public_carrier_service_levels_updated_at
  BEFORE UPDATE
  ON public.carrier_service_levels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_public_carriers_updated_at on public.carriers
CREATE TRIGGER update_public_carriers_updated_at
  BEFORE UPDATE
  ON public.carriers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_public_contact_roles_updated_at on public.contact_roles
CREATE TRIGGER update_public_contact_roles_updated_at
  BEFORE UPDATE
  ON public.contact_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_customers_updated_at on public.customers
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE
  ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_public_customers_updated_at on public.customers
CREATE TRIGGER update_public_customers_updated_at
  BEFORE UPDATE
  ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_public_delivery_status_codes_updated_at on public.delivery_status_codes
CREATE TRIGGER update_public_delivery_status_codes_updated_at
  BEFORE UPDATE
  ON public.delivery_status_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_departments_updated_at on public.departments
CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE
  ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_public_departments_updated_at on public.departments
CREATE TRIGGER update_public_departments_updated_at
  BEFORE UPDATE
  ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_public_document_links_updated_at on public.document_links
CREATE TRIGGER update_public_document_links_updated_at
  BEFORE UPDATE
  ON public.document_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_public_drivers_updated_at on public.drivers
CREATE TRIGGER update_public_drivers_updated_at
  BEFORE UPDATE
  ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_public_events_log_updated_at on public.events_log
CREATE TRIGGER update_public_events_log_updated_at
  BEFORE UPDATE
  ON public.events_log
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_public_locations_updated_at on public.locations
CREATE TRIGGER update_public_locations_updated_at
  BEFORE UPDATE
  ON public.locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_order_items_updated_at on public.order_detail
CREATE TRIGGER update_order_items_updated_at
  BEFORE UPDATE
  ON public.order_detail
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_public_order_detail_updated_at on public.order_detail
CREATE TRIGGER update_public_order_detail_updated_at
  BEFORE UPDATE
  ON public.order_detail
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_products_updated_at on public.order_detail_item
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE
  ON public.order_detail_item
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_public_order_detail_item_updated_at on public.order_detail_item
CREATE TRIGGER update_public_order_detail_item_updated_at
  BEFORE UPDATE
  ON public.order_detail_item
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_orders_updated_at on public.orders
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE
  ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_public_orders_updated_at on public.orders
CREATE TRIGGER update_public_orders_updated_at
  BEFORE UPDATE
  ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_public_trailers_updated_at on public.trailers
CREATE TRIGGER update_public_trailers_updated_at
  BEFORE UPDATE
  ON public.trailers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_public_unload_methods_updated_at on public.unload_methods
CREATE TRIGGER update_public_unload_methods_updated_at
  BEFORE UPDATE
  ON public.unload_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_public_users_updated_at on public.users
CREATE TRIGGER update_public_users_updated_at
  BEFORE UPDATE
  ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_users_updated_at on public.users
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE
  ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_public_vehicles_updated_at on public.vehicles
CREATE TRIGGER update_public_vehicles_updated_at
  BEFORE UPDATE
  ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_public_warehouses_updated_at on public.warehouses
CREATE TRIGGER update_public_warehouses_updated_at
  BEFORE UPDATE
  ON public.warehouses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_tms_container_legs_updated_at on tms.container_legs
CREATE TRIGGER update_tms_container_legs_updated_at
  BEFORE UPDATE
  ON tms.container_legs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_tms_containers_updated_at on tms.containers
CREATE TRIGGER update_tms_containers_updated_at
  BEFORE UPDATE
  ON tms.containers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_tms_freight_bills_updated_at on tms.freight_bills
CREATE TRIGGER update_tms_freight_bills_updated_at
  BEFORE UPDATE
  ON tms.freight_bills
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_wms_inbound_receipt_updated_at on wms.inbound_receipt
CREATE TRIGGER update_wms_inbound_receipt_updated_at
  BEFORE UPDATE
  ON wms.inbound_receipt
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_wms_inventory_lots_updated_at on wms.inventory_lots
CREATE TRIGGER update_wms_inventory_lots_updated_at
  BEFORE UPDATE
  ON wms.inventory_lots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_wms_outbound_shipment_lines_updated_at on wms.outbound_shipment_lines
CREATE TRIGGER update_wms_outbound_shipment_lines_updated_at
  BEFORE UPDATE
  ON wms.outbound_shipment_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_wms_outbound_shipments_updated_at on wms.outbound_shipments
CREATE TRIGGER update_wms_outbound_shipments_updated_at
  BEFORE UPDATE
  ON wms.outbound_shipments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: update_wms_wms_labor_logs_updated_at on wms.wms_labor_logs
CREATE TRIGGER update_wms_wms_labor_logs_updated_at
  BEFORE UPDATE
  ON wms.wms_labor_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 触发器: wms_labor_logs_hours_worked_trg on wms.wms_labor_logs
CREATE TRIGGER wms_labor_logs_hours_worked_trg
  BEFORE INSERT
  ON wms.wms_labor_logs
  FOR EACH ROW
  EXECUTE FUNCTION wms.calculate_hours_worked();

-- 触发器: wms_labor_logs_hours_worked_trg on wms.wms_labor_logs
CREATE TRIGGER wms_labor_logs_hours_worked_trg
  BEFORE UPDATE
  ON wms.wms_labor_logs
  FOR EACH ROW
  EXECUTE FUNCTION wms.calculate_hours_worked();

-- ============================================
-- 序列（Sequence）
-- ============================================

-- 序列: public.customers_id_seq
CREATE SEQUENCE IF NOT EXISTS public.customers_id_seq
  AS integer
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647;

-- 序列: public.departments_id_seq
CREATE SEQUENCE IF NOT EXISTS public.departments_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807;

-- 序列: public.order_detail_id_seq
CREATE SEQUENCE IF NOT EXISTS public.order_detail_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807;

-- 序列: public.order_detail_item_id_seq
CREATE SEQUENCE IF NOT EXISTS public.order_detail_item_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807;

-- 序列: public.orders_order_id_seq
CREATE SEQUENCE IF NOT EXISTS public.orders_order_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807;

-- 序列: public.users_id_seq
CREATE SEQUENCE IF NOT EXISTS public.users_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807;
