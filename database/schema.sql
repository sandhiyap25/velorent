-- ============================================================================
-- VeloRent — Online Vehicle Rental Platform
-- Complete Normalized MySQL Database Schema (XAMPP / phpMyAdmin Ready)
-- ============================================================================
-- How to import in phpMyAdmin:
-- 1. Open http://localhost/phpmyadmin
-- 2. Click "Import" in the top navigation bar
-- 3. Choose this file (database/schema.sql) and click "Import" / "Go"
-- ============================================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

CREATE DATABASE IF NOT EXISTS `velorent_db`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `velorent_db`;

-- Drop tables in reverse dependency order for clean re-imports
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `incident_evidence`;
DROP TABLE IF EXISTS `incidents`;
DROP TABLE IF EXISTS `booking_damage_evidence`;
DROP TABLE IF EXISTS `bookings`;
DROP TABLE IF EXISTS `vehicle_rules`;
DROP TABLE IF EXISTS `vehicle_features`;
DROP TABLE IF EXISTS `vehicle_images`;
DROP TABLE IF EXISTS `vehicles`;
DROP TABLE IF EXISTS `auth_tokens`;
DROP TABLE IF EXISTS `users`;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- 1. USERS TABLE
-- Stores registered renters, vehicle owners (hosts), and platform admins.
-- Passwords are stored exclusively as PHP password_hash() bcrypt hashes.
-- ============================================================================
CREATE TABLE `users` (
  `id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(30) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
  `avatar_initials` VARCHAR(5) DEFAULT NULL,
  `city` VARCHAR(100) NOT NULL DEFAULT 'Bengaluru',
  `rating` DECIMAL(3,2) NOT NULL DEFAULT 5.00,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. AUTH_TOKENS TABLE
-- Stores active session bearer tokens hashed with SHA-256 for stateless/CORS
-- API authentication alongside native PHP sessions.
-- ============================================================================
CREATE TABLE `auth_tokens` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` VARCHAR(36) NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_auth_tokens_hash` (`token_hash`),
  KEY `idx_auth_tokens_user` (`user_id`),
  KEY `idx_auth_tokens_expires` (`expires_at`),
  CONSTRAINT `fk_auth_tokens_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. VEHICLES TABLE
-- Stores vehicles listed for rent by registered users.
-- ============================================================================
CREATE TABLE `vehicles` (
  `id` VARCHAR(36) NOT NULL,
  `owner_id` VARCHAR(36) NOT NULL,
  `type` ENUM('Car', 'SUV', 'Bike', 'Van') NOT NULL DEFAULT 'Car',
  `brand` VARCHAR(80) NOT NULL,
  `model` VARCHAR(120) NOT NULL,
  `registration_number` VARCHAR(30) NOT NULL,
  `location` VARCHAR(191) NOT NULL,
  `hourly_rate` DECIMAL(10,2) NOT NULL,
  `daily_rate` DECIMAL(10,2) NOT NULL,
  `available_from` DATETIME NOT NULL,
  `available_until` DATETIME NOT NULL,
  `status` ENUM('AVAILABLE', 'DISABLED', 'MAINTENANCE') NOT NULL DEFAULT 'AVAILABLE',
  `security_deposit` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `description` TEXT NOT NULL,
  `cancellation_policy` VARCHAR(255) NOT NULL DEFAULT '100% full refund if cancelled before scheduled pickup time.',
  `transmission` ENUM('Automatic', 'Manual') NOT NULL DEFAULT 'Automatic',
  `fuel_type` ENUM('Petrol', 'Diesel', 'Electric', 'Hybrid') NOT NULL DEFAULT 'Petrol',
  `seats` TINYINT UNSIGNED NOT NULL DEFAULT 5,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vehicles_registration` (`registration_number`),
  KEY `idx_vehicles_owner` (`owner_id`),
  KEY `idx_vehicles_type_status` (`type`, `status`),
  KEY `idx_vehicles_location` (`location`),
  KEY `idx_vehicles_is_deleted` (`is_deleted`),
  CONSTRAINT `fk_vehicles_owner`
    FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. VEHICLE_IMAGES TABLE (Normalized 1:N relationship)
-- ============================================================================
CREATE TABLE `vehicle_images` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `vehicle_id` VARCHAR(36) NOT NULL,
  `image_url` TEXT NOT NULL,
  `sort_order` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_vehicle_images_vehicle` (`vehicle_id`, `sort_order`),
  CONSTRAINT `fk_vehicle_images_vehicle`
    FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. VEHICLE_FEATURES TABLE (Normalized 1:N relationship)
-- ============================================================================
CREATE TABLE `vehicle_features` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `vehicle_id` VARCHAR(36) NOT NULL,
  `feature_name` VARCHAR(120) NOT NULL,
  `sort_order` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_vehicle_features_vehicle` (`vehicle_id`, `sort_order`),
  CONSTRAINT `fk_vehicle_features_vehicle`
    FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. VEHICLE_RULES TABLE (Normalized 1:N relationship)
-- ============================================================================
CREATE TABLE `vehicle_rules` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `vehicle_id` VARCHAR(36) NOT NULL,
  `rule_text` VARCHAR(255) NOT NULL,
  `sort_order` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_vehicle_rules_vehicle` (`vehicle_id`, `sort_order`),
  CONSTRAINT `fk_vehicle_rules_vehicle`
    FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. BOOKINGS TABLE
-- Stores reservations, pickup/return schedules, actual return check-in,
-- late return penalties, return condition, and security deposit settlement.
-- ============================================================================
CREATE TABLE `bookings` (
  `id` VARCHAR(36) NOT NULL,
  `vehicle_id` VARCHAR(36) NOT NULL,
  `renter_id` VARCHAR(36) NOT NULL,
  `owner_id` VARCHAR(36) NOT NULL,
  `pickup_datetime` DATETIME NOT NULL,
  `return_datetime` DATETIME NOT NULL,
  `actual_return_datetime` DATETIME DEFAULT NULL,
  `duration_hours` DECIMAL(8,2) NOT NULL,
  `hourly_rate` DECIMAL(10,2) NOT NULL,
  `rental_amount` DECIMAL(10,2) NOT NULL,
  `security_deposit` DECIMAL(10,2) NOT NULL,
  `late_hours` DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  `late_penalty` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `condition_on_return` ENUM('No Damage', 'Minor Damage', 'Major Damage') DEFAULT NULL,
  `damage_description` TEXT DEFAULT NULL,
  `estimated_repair_cost` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `damage_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `damage_review_status` ENUM('NONE', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'RESOLVED') NOT NULL DEFAULT 'NONE',
  `damage_admin_notes` TEXT DEFAULT NULL,
  `status` ENUM('UPCOMING', 'ACTIVE', 'OVERDUE', 'RETURNED', 'RETURNED_LATE', 'CANCELLED') NOT NULL DEFAULT 'UPCOMING',
  `reminders_sent` INT UNSIGNED NOT NULL DEFAULT 0,
  `last_reminder_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bookings_vehicle_dates` (`vehicle_id`, `pickup_datetime`, `return_datetime`),
  KEY `idx_bookings_renter` (`renter_id`),
  KEY `idx_bookings_owner` (`owner_id`),
  KEY `idx_bookings_status` (`status`),
  CONSTRAINT `fk_bookings_vehicle`
    FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_bookings_renter`
    FOREIGN KEY (`renter_id`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_bookings_owner`
    FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 8. BOOKING_DAMAGE_EVIDENCE TABLE (Normalized 1:N relationship)
-- ============================================================================
CREATE TABLE `booking_damage_evidence` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `booking_id` VARCHAR(36) NOT NULL,
  `file_url` VARCHAR(255) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_booking_damage_evidence_booking` (`booking_id`),
  CONSTRAINT `fk_booking_damage_evidence_booking`
    FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 9. INCIDENTS TABLE
-- Stores damage claims, non-return reports, suspected theft escalations,
-- accident logs, and admin settlement decisions.
-- ============================================================================
CREATE TABLE `incidents` (
  `id` VARCHAR(36) NOT NULL,
  `booking_id` VARCHAR(36) NOT NULL,
  `vehicle_id` VARCHAR(36) NOT NULL,
  `reported_by` VARCHAR(36) NOT NULL,
  `reporter_role` ENUM('OWNER', 'RENTER', 'ADMIN') NOT NULL,
  `type` ENUM('Vehicle Not Returned', 'Suspected Theft', 'Vehicle Damage', 'Accident', 'Other') NOT NULL,
  `priority` ENUM('STANDARD', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'STANDARD',
  `description` TEXT NOT NULL,
  `status` ENUM('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  `admin_remarks` TEXT DEFAULT NULL,
  `estimated_damage_cost` DECIMAL(10,2) DEFAULT NULL,
  `approved_damage_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `damage_status` ENUM('NONE', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'RESOLVED') DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_incidents_booking` (`booking_id`),
  KEY `idx_incidents_vehicle` (`vehicle_id`),
  KEY `idx_incidents_reported_by` (`reported_by`),
  KEY `idx_incidents_status_priority` (`status`, `priority`),
  CONSTRAINT `fk_incidents_booking`
    FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_incidents_vehicle`
    FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_incidents_reporter`
    FOREIGN KEY (`reported_by`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 10. INCIDENT_EVIDENCE TABLE (Normalized 1:N relationship)
-- ============================================================================
CREATE TABLE `incident_evidence` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `incident_id` VARCHAR(36) NOT NULL,
  `file_url` VARCHAR(255) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_incident_evidence_incident` (`incident_id`),
  CONSTRAINT `fk_incident_evidence_incident`
    FOREIGN KEY (`incident_id`) REFERENCES `incidents` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 11. NOTIFICATIONS TABLE
-- Stores user and admin notifications for bookings, returns, and incidents.
-- ============================================================================
CREATE TABLE `notifications` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) DEFAULT NULL,
  `target_scope` ENUM('USER', 'ADMIN', 'ALL') NOT NULL DEFAULT 'USER',
  `title` VARCHAR(191) NOT NULL,
  `message` TEXT NOT NULL,
  `type` ENUM('INFO', 'SUCCESS', 'WARNING', 'ERROR') NOT NULL DEFAULT 'INFO',
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `link` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user_read` (`user_id`, `is_read`),
  KEY `idx_notifications_scope` (`target_scope`),
  CONSTRAINT `fk_notifications_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- INITIAL PLATFORM ACCOUNTS & MARKETPLACE INVENTORY
-- Passwords use standard PHP password_hash() bcrypt ($2y$10$...)
-- ============================================================================
INSERT INTO `users` (`id`, `name`, `email`, `phone`, `password_hash`, `role`, `avatar_initials`, `city`, `rating`, `created_at`) VALUES
('usr-1', 'Arjun Mehta', 'arjun.mehta@example.in', '+91 98201 54321', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'USER', 'AM', 'Bengaluru', 4.90, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 140 DAY)),
('usr-2', 'Priya Nair', 'priya.nair@example.in', '+91 98450 11223', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'USER', 'PN', 'Bengaluru', 4.80, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 210 DAY)),
('usr-3', 'Rohan Deshmukh', 'rohan.deshmukh@example.in', '+91 97654 32109', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'USER', 'RD', 'Mumbai', 4.60, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 95 DAY)),
('usr-admin', 'Vikramaditya Rao', 'admin@velorent.in', '+91 80412 90000', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ADMIN', 'VR', 'Bengaluru', 5.00, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 365 DAY));

INSERT INTO `vehicles` (`id`, `owner_id`, `type`, `brand`, `model`, `registration_number`, `location`, `hourly_rate`, `daily_rate`, `available_from`, `available_until`, `status`, `security_deposit`, `description`, `cancellation_policy`, `transmission`, `fuel_type`, `seats`, `created_at`) VALUES
('veh-1', 'usr-2', 'SUV', 'Mahindra', 'XUV700 AX7 Luxury', 'KA-01-MJ-4821', 'Bengaluru — Indiranagar', 320.00, 6800.00, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 DAY), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 90 DAY), 'AVAILABLE', 6000.00, 'Top-spec Mahindra XUV700 AX7 Luxury Pack with panoramic Skyroof, ADAS Level 2, Sony 12-speaker 3D audio, and wireless Apple CarPlay. Meticulously maintained for highway and city comfort.', '100% full refund of rental & deposit if cancelled before scheduled pickup time.', 'Automatic', 'Diesel', 7, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 60 DAY)),
('veh-2', 'usr-1', 'SUV', 'Hyundai', 'Creta SX(O) Turbo', 'KA-03-NB-9104', 'Bengaluru — Koramangala', 260.00, 5400.00, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 DAY), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 90 DAY), 'AVAILABLE', 5000.00, 'Refined 7-speed DCT Turbo Petrol Hyundai Creta with ventilated front seats, Bose 8-speaker sound system, and dual-zone automatic climate control.', 'Free cancellation anytime prior to rental pickup window.', 'Automatic', 'Petrol', 5, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 45 DAY)),
('veh-3', 'usr-2', 'Van', 'Toyota', 'Innova Hycross ZX(O)', 'KA-05-HT-2290', 'Bengaluru — HSR Layout', 350.00, 7500.00, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 DAY), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 90 DAY), 'AVAILABLE', 7000.00, 'Strong Hybrid self-charging Toyota Innova Hycross with powered Ottoman second-row captain seats, exceptional 21 km/l fuel efficiency, and whisper-quiet cabin.', 'Free cancellation before scheduled pickup time.', 'Automatic', 'Hybrid', 7, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 50 DAY)),
('veh-4', 'usr-3', 'SUV', 'Tata', 'Nexon EV Empowered+', 'MH-02-FE-7732', 'Mumbai — Bandra West', 220.00, 4600.00, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 DAY), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 90 DAY), 'AVAILABLE', 4500.00, 'Long-range 40.5 kWh Tata Nexon EV with 315 km real-world city range, Arcade.ev 12.3-inch cinematic screen, and zero tailpipe emissions.', 'Full refund if cancelled before rental start time.', 'Automatic', 'Electric', 5, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 40 DAY)),
('veh-5', 'usr-2', 'Car', 'Honda', 'City ZX i-VTEC CVT', 'KA-01-AB-6120', 'Bengaluru — Whitefield', 200.00, 4200.00, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 DAY), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 90 DAY), 'AVAILABLE', 4000.00, 'Executive pearl white Honda City ZX sedan with plush leather upholstery, Honda Sensing lane-watch camera, and effortless CVT city drivability.', 'Full refund prior to scheduled pickup.', 'Automatic', 'Petrol', 5, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 35 DAY)),
('veh-6', 'usr-1', 'Car', 'Maruti', 'Baleno Alpha AGS', 'KA-04-MP-3319', 'Bengaluru — Indiranagar', 150.00, 3200.00, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 DAY), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 90 DAY), 'AVAILABLE', 3000.00, 'Agile, fuel-efficient premium hatchback with Head-Up Display (HUD), 360-view camera, and SmartPlay Pro+ 9-inch infotainment.', 'Free cancellation before pickup.', 'Automatic', 'Petrol', 5, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)),
('veh-7', 'usr-3', 'Bike', 'Royal Enfield', 'Classic 350 Stealth Black', 'MH-12-QW-8840', 'Pune — Koregaon Park', 90.00, 1800.00, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 DAY), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 90 DAY), 'AVAILABLE', 2000.00, 'J-series Royal Enfield Classic 350 in Matte Stealth Black with dual-channel ABS, Tripper navigation pod, and alloy tubeless wheels. Two BIS-certified helmets included.', 'Free cancellation before pickup.', 'Manual', 'Petrol', 2, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 28 DAY)),
('veh-8', 'usr-1', 'Bike', 'Honda', 'CB350RS Hue Edition', 'KA-01-EK-5502', 'Bengaluru — Jayanagar', 85.00, 1700.00, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 DAY), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 90 DAY), 'AVAILABLE', 2000.00, 'Smooth neo-retro Honda CB350RS with assist & slipper clutch, Honda Selectable Torque Control (traction control), and crisp exhaust note.', 'Free cancellation prior to scheduled start.', 'Manual', 'Petrol', 2, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 25 DAY)),
('veh-9', 'usr-3', 'SUV', 'Toyota', 'Fortuner Legender 4x4 AT', 'DL-01-CA-9901', 'Delhi — Connaught Place', 450.00, 9500.00, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 DAY), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 90 DAY), 'AVAILABLE', 10000.00, 'Flagship Toyota Fortuner Legender 2.8L 4x4 Automatic with dual-tone Pearl White & Matte Black roof, quad-LED headlamps, and commanding road presence.', 'Full refund if cancelled before pickup.', 'Automatic', 'Diesel', 7, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 22 DAY)),
('veh-10', 'usr-2', 'Car', 'Toyota', 'Glanza V AMT', 'KA-02-MN-1184', 'Bengaluru — Malleshwaram', 160.00, 3400.00, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 DAY), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 90 DAY), 'AVAILABLE', 3000.00, 'Easy-to-park Toyota Glanza V top variant with 6 airbags, 360-degree camera, and Toyota reliability for effortless city errands.', 'Free cancellation prior to pickup.', 'Automatic', 'Petrol', 5, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 20 DAY)),
('veh-11', 'usr-3', 'Van', 'Maruti', 'Ertiga ZXI+ Smart Hybrid', 'MH-01-DE-4410', 'Mumbai — Powai', 230.00, 4800.00, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 DAY), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 90 DAY), 'AVAILABLE', 4500.00, 'Practical 7-seater MPV with roof-mounted rear AC vents, reclining third-row seats, and smooth 6-speed torque converter automatic transmission.', 'Free cancellation before pickup time.', 'Automatic', 'Petrol', 7, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 18 DAY)),
('veh-12', 'usr-2', 'Car', 'Hyundai', 'Verna SX(O) 1.5 Turbo', 'TS-09-UB-6021', 'Hyderabad — Jubilee Hills', 240.00, 5100.00, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 DAY), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 90 DAY), 'AVAILABLE', 4500.00, 'Horizon LED positioning lamp sedan with 160 PS 1.5L Turbo GDi engine, heated and ventilated seats, and 5-star Global NCAP safety rating.', 'Free cancellation prior to pickup.', 'Automatic', 'Petrol', 5, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 14 DAY));

INSERT INTO `vehicle_images` (`vehicle_id`, `image_url`, `sort_order`) VALUES
('veh-1', '/assets/suv', 0),
('veh-1', '/assets/hero', 1),
('veh-2', '/assets/suv', 0),
('veh-2', '/assets/car', 1),
('veh-3', '/assets/van', 0),
('veh-3', '/assets/hero', 1),
('veh-4', '/assets/suv', 0),
('veh-4', '/assets/car', 1),
('veh-5', '/assets/car', 0),
('veh-5', '/assets/hero', 1),
('veh-6', '/assets/car', 0),
('veh-7', '/assets/bike', 0),
('veh-8', '/assets/bike', 0),
('veh-9', '/assets/suv', 0),
('veh-9', '/assets/hero', 1),
('veh-10', '/assets/car', 0),
('veh-11', '/assets/van', 0),
('veh-12', '/assets/car', 0),
('veh-12', '/assets/hero', 1);

INSERT INTO `vehicle_features` (`vehicle_id`, `feature_name`, `sort_order`) VALUES
('veh-1', 'Panoramic Sunroof', 0), ('veh-1', 'ADAS Level 2', 1), ('veh-1', '360° Surround Camera', 2), ('veh-1', 'Wireless CarPlay', 3), ('veh-1', '7 Seater Captain Config', 4), ('veh-1', 'FASTag Enabled', 5),
('veh-2', 'Ventilated Front Seats', 0), ('veh-2', 'Bose Premium Audio', 1), ('veh-2', 'Panoramic Sunroof', 2), ('veh-2', 'Paddle Shifters', 3), ('veh-2', 'Air Purifier', 4),
('veh-3', 'Powered Ottoman Seats', 0), ('veh-3', 'Strong Hybrid (21 km/l)', 1), ('veh-3', 'Toyota Safety Sense', 2), ('veh-3', 'Dual Zone AC', 3), ('veh-3', 'Rear Sunshades', 4),
('veh-4', '315 km Real Range', 0), ('veh-4', 'Fast CCS2 Charging', 1), ('veh-4', '360° Camera', 2), ('veh-4', 'Regenerative Braking', 3), ('veh-4', 'JBL Sound Modes', 4),
('veh-5', 'LaneWatch Camera', 0), ('veh-5', 'Leather Upholstery', 1), ('veh-5', 'Electric Sunroof', 2), ('veh-5', '8-Speaker Surround', 3), ('veh-5', '506L Boot Space', 4),
('veh-6', 'Head-Up Display', 0), ('veh-6', '360° View Camera', 1), ('veh-6', '22 km/l Mileage', 2), ('veh-6', 'Auto Climate Control', 3), ('veh-6', 'UV Cut Glass', 4),
('veh-7', 'Dual-Channel ABS', 0), ('veh-7', '2 Helmets Included', 1), ('veh-7', 'Tripper Navigation', 2), ('veh-7', 'USB Charging Port', 3), ('veh-7', 'Tubeless Alloys', 4),
('veh-8', 'Slipper Clutch', 0), ('veh-8', 'Traction Control', 1), ('veh-8', 'All-LED Lighting', 2), ('veh-8', 'Helmet Provided', 3), ('veh-8', 'Phone Mount', 4),
('veh-9', '4x4 Drivetrain', 0), ('veh-9', 'JBL 11-Speaker Audio', 1), ('veh-9', 'Ventilated Seats', 2), ('veh-9', 'Kick-Sensor Tailgate', 3), ('veh-9', 'Wireless Charger', 4),
('veh-10', '6 Airbags', 0), ('veh-10', '360° Camera', 1), ('veh-10', 'Apple CarPlay & Android Auto', 2), ('veh-10', 'Cruise Control', 3), ('veh-10', 'FASTag Active', 4),
('veh-11', '7-Seater Family MPV', 0), ('veh-11', 'Roof Rear AC Vents', 1), ('veh-11', 'Cooled Cup Holders', 2), ('veh-11', 'Cruise Control', 3), ('veh-11', 'Luggage Carrier Ready', 4),
('veh-12', '160 PS Turbo Engine', 0), ('veh-12', '5-Star Safety Rating', 1), ('veh-12', 'Heated & Ventilated Seats', 2), ('veh-12', 'Bose 8-Speaker Audio', 3), ('veh-12', 'Smart Trunk', 4);

INSERT INTO `vehicle_rules` (`vehicle_id`, `rule_text`, `sort_order`) VALUES
('veh-1', 'Valid Indian Driving Licence (LMV) mandatory at pickup.', 0),
('veh-1', 'Fuel policy: Return at same fuel level as pickup.', 1),
('veh-1', 'Strictly no smoking or off-road trail abuse.', 2),
('veh-2', 'Return with same fuel level.', 0),
('veh-2', 'Late returns incur ₹300/hour penalty beyond scheduled drop time.', 1),
('veh-3', 'No commercial goods transport.', 0),
('veh-3', 'Standard ₹300/hr late return fee applies.', 1),
('veh-4', 'Return with at least 25% battery charge.', 0),
('veh-5', 'Unleaded petrol only.', 0),
('veh-6', 'Return on time to avoid ₹300/hr late penalty.', 0),
('veh-7', 'Valid MCWG two-wheeler licence mandatory.', 0),
('veh-8', 'Valid two-wheeler licence required.', 0),
('veh-9', 'Minimum renter age 24 years with 3+ years driving experience.', 0),
('veh-10', 'No smoking inside cabin.', 0),
('veh-11', 'Max 7 occupants including driver.', 0),
('veh-12', 'Valid LMV licence required.', 0);

INSERT INTO `bookings` (`id`, `vehicle_id`, `renter_id`, `owner_id`, `pickup_datetime`, `return_datetime`, `actual_return_datetime`, `duration_hours`, `hourly_rate`, `rental_amount`, `security_deposit`, `late_hours`, `late_penalty`, `condition_on_return`, `damage_description`, `estimated_repair_cost`, `damage_amount`, `damage_review_status`, `damage_admin_notes`, `status`, `reminders_sent`, `last_reminder_at`, `created_at`) VALUES
('BK-849201', 'veh-3', 'usr-1', 'usr-2', DATE_SUB(UTC_TIMESTAMP(), INTERVAL 4 HOUR), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR), NULL, 12.00, 350.00, 4200.00, 7000.00, 0.00, 0.00, NULL, NULL, 0.00, 0.00, 'NONE', NULL, 'ACTIVE', 0, NULL, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY)),
('BK-849202', 'veh-1', 'usr-1', 'usr-2', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 32 HOUR), NULL, 8.00, 320.00, 2560.00, 6000.00, 0.00, 0.00, NULL, NULL, 0.00, 0.00, 'NONE', NULL, 'UPCOMING', 0, NULL, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 6 HOUR)),
('BK-849203', 'veh-2', 'usr-3', 'usr-1', DATE_SUB(UTC_TIMESTAMP(), INTERVAL 16 HOUR), DATE_SUB(UTC_TIMESTAMP(), INTERVAL 6 HOUR), NULL, 10.00, 260.00, 2600.00, 5000.00, 6.00, 1800.00, NULL, NULL, 0.00, 0.00, 'NONE', NULL, 'OVERDUE', 1, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 HOUR), DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 DAY)),
('BK-849204', 'veh-7', 'usr-1', 'usr-3', DATE_SUB(UTC_TIMESTAMP(), INTERVAL 12 HOUR), DATE_SUB(UTC_TIMESTAMP(), INTERVAL 4 HOUR), NULL, 8.00, 90.00, 720.00, 2000.00, 4.00, 1200.00, NULL, NULL, 0.00, 0.00, 'NONE', NULL, 'OVERDUE', 1, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 HOUR), DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY)),
('BK-849205', 'veh-5', 'usr-1', 'usr-2', DATE_SUB(UTC_TIMESTAMP(), INTERVAL 8 DAY), DATE_ADD(DATE_SUB(UTC_TIMESTAMP(), INTERVAL 8 DAY), INTERVAL 10 HOUR), DATE_ADD(DATE_SUB(UTC_TIMESTAMP(), INTERVAL 8 DAY), INTERVAL 9 HOUR), 10.00, 200.00, 2000.00, 4000.00, 0.00, 0.00, 'No Damage', NULL, 0.00, 0.00, 'NONE', NULL, 'RETURNED', 0, NULL, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 10 DAY)),
('BK-849206', 'veh-4', 'usr-1', 'usr-3', DATE_SUB(UTC_TIMESTAMP(), INTERVAL 4 DAY), DATE_ADD(DATE_SUB(UTC_TIMESTAMP(), INTERVAL 4 DAY), INTERVAL 8 HOUR), DATE_ADD(DATE_SUB(UTC_TIMESTAMP(), INTERVAL 4 DAY), INTERVAL 11 HOUR), 8.00, 220.00, 1760.00, 4500.00, 3.00, 900.00, 'Minor Damage', 'Rear left bumper paint scuff and reflector crack incurred during tight basement parking.', 2200.00, 0.00, 'PENDING_REVIEW', 'Awaiting admin inspection of workshop estimate.', 'RETURNED_LATE', 0, NULL, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 DAY));

INSERT INTO `booking_damage_evidence` (`booking_id`, `file_url`) VALUES
('BK-849206', 'rear_bumper_scuff_01.jpg'),
('BK-849206', 'reflector_closeup_02.jpg');

INSERT INTO `incidents` (`id`, `booking_id`, `vehicle_id`, `reported_by`, `reporter_role`, `type`, `priority`, `description`, `status`, `admin_remarks`, `estimated_damage_cost`, `approved_damage_amount`, `damage_status`, `created_at`, `updated_at`) VALUES
('INC-5011', 'BK-849206', 'veh-4', 'usr-3', 'OWNER', 'Vehicle Damage', 'STANDARD', 'Minor damage reported upon check-in of Tata Nexon EV (BK-849206): Rear left bumper scuff and cracked reflector. Workshop estimate ₹2,200 submitted for admin deposit review.', 'UNDER_REVIEW', 'Evidence photos verified. Reviewing body shop paint & reflector invoice before authorizing deposit adjustment.', 2200.00, 0.00, 'PENDING_REVIEW', DATE_SUB(UTC_TIMESTAMP(), INTERVAL 3 DAY), DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 DAY)),
('INC-5012', 'BK-849203', 'veh-2', 'usr-1', 'OWNER', 'Vehicle Not Returned', 'HIGH', 'Hyundai Creta SX(O) (BK-849203) is 6 hours past expected return time. One reminder sent to renter Rohan Deshmukh.', 'OPEN', 'Monitoring overdue status. Renter contacted by operations desk.', NULL, 0.00, 'NONE', DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 HOUR), DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 HOUR));

INSERT INTO `incident_evidence` (`incident_id`, `file_url`) VALUES
('INC-5011', 'rear_bumper_scuff_01.jpg'),
('INC-5011', 'reflector_closeup_02.jpg'),
('INC-5012', 'booking_timeline_log.pdf');

INSERT INTO `notifications` (`id`, `user_id`, `target_scope`, `title`, `message`, `type`, `is_read`, `link`, `created_at`) VALUES
('notif-1', 'usr-1', 'USER', 'Overdue Rental Alert', 'Your booking BK-849204 (Royal Enfield Classic 350) is past its return time. Late penalty of ₹300/hr applies until returned.', 'ERROR', 0, '/bookings/BK-849204', DATE_SUB(UTC_TIMESTAMP(), INTERVAL 3 HOUR)),
('notif-2', 'usr-1', 'USER', 'Owner Alert: Vehicle Overdue', 'Your listed Hyundai Creta SX(O) (Booking BK-849203) has not been returned on schedule by Rohan Deshmukh.', 'WARNING', 0, '/bookings/BK-849203', DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 HOUR)),
('notif-3', 'usr-1', 'USER', 'Security Deposit Pending Admin Review', 'Booking BK-849206 (Tata Nexon EV) has a damage report (est. ₹2,200) under admin review. No deposit deduction occurs until approved.', 'INFO', 0, '/bookings/BK-849206', DATE_SUB(UTC_TIMESTAMP(), INTERVAL 3 DAY)),
('notif-4', 'usr-1', 'USER', 'Booking Confirmed', 'Upcoming reservation BK-849202 for Mahindra XUV700 AX7 Luxury is confirmed.', 'SUCCESS', 1, '/bookings/BK-849202', DATE_SUB(UTC_TIMESTAMP(), INTERVAL 6 HOUR));

COMMIT;
