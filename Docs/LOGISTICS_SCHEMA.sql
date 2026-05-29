-- ============================================================
-- LOGISTICS MODULE — Database Schema
-- Run in Supabase SQL Editor
-- ============================================================

-- ─── Spare Parts Inventory ───
CREATE TABLE IF NOT EXISTS spare_parts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_number   VARCHAR(100) UNIQUE NOT NULL,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  category      VARCHAR(100) DEFAULT 'GENERAL',
  unit          VARCHAR(20)  DEFAULT 'pcs',       -- pcs, liter, kg, meter, etc.
  stock_qty     NUMERIC(12,2) DEFAULT 0,
  min_qty       NUMERIC(12,2) DEFAULT 0,          -- reorder threshold
  reorder_qty   NUMERIC(12,2) DEFAULT 0,          -- how much to reorder
  location      VARCHAR(255),                      -- warehouse / shelf / bin
  supplier      VARCHAR(255),
  supplier_ref  VARCHAR(255),                      -- supplier article number
  unit_price    NUMERIC(12,2) DEFAULT 0,           -- CHF per unit (last purchase)
  machine_id    UUID REFERENCES machines(id),      -- optional: linked machine
  qr_code       VARCHAR(500),                      -- QR / barcode value
  image_url     VARCHAR(500),
  auto_reorder  BOOLEAN DEFAULT FALSE,
  is_active     BOOLEAN DEFAULT TRUE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_spare_parts_category   ON spare_parts(category);
CREATE INDEX idx_spare_parts_machine    ON spare_parts(machine_id);
CREATE INDEX idx_spare_parts_qr        ON spare_parts(qr_code);
CREATE INDEX idx_spare_parts_active    ON spare_parts(is_active);

-- ─── Stock Transactions (consumption, purchase, adjustment, return) ───
CREATE TABLE IF NOT EXISTS spare_part_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id       UUID NOT NULL REFERENCES spare_parts(id) ON DELETE CASCADE,
  type          VARCHAR(20) NOT NULL CHECK (type IN ('CONSUME','PURCHASE','ADJUST','RETURN')),
  qty           NUMERIC(12,2) NOT NULL,            -- positive = in, negative = out
  unit_price    NUMERIC(12,2),                     -- price at time of transaction
  reference     VARCHAR(255),                      -- PO number, task name, etc.
  machine_id    UUID REFERENCES machines(id),      -- which machine consumed it
  task_id       UUID REFERENCES tasks(id),         -- which job consumed it
  user_id       UUID NOT NULL REFERENCES users(id),-- who did it
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_spt_part     ON spare_part_transactions(part_id);
CREATE INDEX idx_spt_type     ON spare_part_transactions(type);
CREATE INDEX idx_spt_machine  ON spare_part_transactions(machine_id);
CREATE INDEX idx_spt_user     ON spare_part_transactions(user_id);
CREATE INDEX idx_spt_date     ON spare_part_transactions(created_at);

-- ─── Reorder Alerts ───
CREATE TABLE IF NOT EXISTS spare_part_alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id       UUID NOT NULL REFERENCES spare_parts(id) ON DELETE CASCADE,
  alert_type    VARCHAR(30) NOT NULL CHECK (alert_type IN ('LOW_STOCK','OUT_OF_STOCK','AUTO_REORDER')),
  message       TEXT,
  status        VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN ('OPEN','ACKNOWLEDGED','RESOLVED')),
  resolved_by   UUID REFERENCES users(id),
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_spa_part   ON spare_part_alerts(part_id);
CREATE INDEX idx_spa_status ON spare_part_alerts(status);

-- ─── Trigger: update stock_qty on transaction insert ───
CREATE OR REPLACE FUNCTION fn_update_stock_qty()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE spare_parts
  SET stock_qty  = stock_qty + NEW.qty,
      updated_at = NOW()
  WHERE id = NEW.part_id;

  -- Check low-stock / out-of-stock after update
  PERFORM pg_notify('stock_change', NEW.part_id::text);
  RETURN NEW;
END;

$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_stock ON spare_part_transactions;
CREATE TRIGGER trg_update_stock
  AFTER INSERT ON spare_part_transactions
  FOR EACH ROW EXECUTE FUNCTION fn_update_stock_qty();

-- ─── Trigger: auto-generate alert on low stock ───
CREATE OR REPLACE FUNCTION fn_check_stock_alert()
RETURNS TRIGGER AS $$
DECLARE
  v_min   NUMERIC;
  v_stock NUMERIC;
  v_name  TEXT;
  v_auto  BOOLEAN;
BEGIN
  SELECT min_qty, stock_qty, name, auto_reorder
  INTO   v_min, v_stock, v_name, v_auto
  FROM   spare_parts WHERE id = NEW.part_id;

  IF v_stock <= 0 AND NOT EXISTS (
    SELECT 1 FROM spare_part_alerts
    WHERE part_id = NEW.part_id AND alert_type = 'OUT_OF_STOCK' AND status = 'OPEN'
  ) THEN
    INSERT INTO spare_part_alerts (part_id, alert_type, message)
    VALUES (NEW.part_id, 'OUT_OF_STOCK', v_name || ' is out of stock');
  ELSIF v_stock > 0 AND v_stock <= v_min AND NOT EXISTS (
    SELECT 1 FROM spare_part_alerts
    WHERE part_id = NEW.part_id AND alert_type = 'LOW_STOCK' AND status = 'OPEN'
  ) THEN
    INSERT INTO spare_part_alerts (part_id, alert_type, message)
    VALUES (NEW.part_id,
      CASE WHEN v_auto THEN 'AUTO_REORDER' ELSE 'LOW_STOCK' END,
      v_name || CASE WHEN v_auto THEN ' — auto-reorder triggered' ELSE ' — stock low' END
    );
  END IF;

  RETURN NEW;
END;

$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_alert ON spare_part_transactions;
CREATE TRIGGER trg_stock_alert
  AFTER INSERT ON spare_part_transactions
  FOR EACH ROW EXECUTE FUNCTION fn_check_stock_alert();
