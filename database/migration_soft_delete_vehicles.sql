-- Run this once against an EXISTING VeloRent database (created before this update).
-- Skip this file entirely if you are creating a brand new database from schema.sql,
-- since schema.sql already includes the `is_deleted` column.
--
-- Why: `bookings.vehicle_id` has ON DELETE RESTRICT, so removing a vehicle that has
-- any booking history (even a completed/cancelled one) used to fail with a foreign
-- key error. This adds a soft-delete flag so "Remove vehicle" always succeeds and is
-- reflected immediately (the vehicle disappears from the marketplace and from My fleet).

ALTER TABLE `vehicles`
  ADD COLUMN `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 AFTER `seats`;

ALTER TABLE `vehicles`
  ADD KEY `idx_vehicles_is_deleted` (`is_deleted`);
