# VeloRent — Full-Stack React/Vite + PHP REST API + MySQL Setup Guide

## 1. Architecture Overview

```
React / Vite Frontend (TypeScript + Tailwind CSS)
        │
        ▼  JSON REST API + Bearer Token / PHP Session
PHP 8+ PDO REST API Backend (/backend/api/*)
        │
        ▼  Prepared Statements + InnoDB Transactions
MySQL 8 / MariaDB Database (velorent_db)
```

---

## 2. Database Schema Summary (`database/schema.sql`)

Database Name: **`velorent_db`**

| Table | Primary Key | Foreign Keys & Purpose |
| :--- | :--- | :--- |
| `users` | `id` (`VARCHAR(36)`) | Stores registered users (`USER`, `ADMIN`), `email` (`UNIQUE`), `password_hash` (`VARCHAR(255)` via `password_hash()`), `phone`, `city`, `avatar_initials`, `rating`. |
| `auth_tokens` | `id` (`INT UNSIGNED AUTO_INCREMENT`) | `user_id` → `users(id)` (`ON DELETE CASCADE`). Stores SHA-256 hashed Bearer tokens for stateless/cross-origin REST authentication alongside PHP sessions. |
| `vehicles` | `id` (`VARCHAR(36)`) | `owner_id` → `users(id)` (`ON DELETE CASCADE`). Stores `brand`, `model`, `type` (`Car`, `SUV`, `Bike`, `Van`), `registration_number` (`UNIQUE`), `transmission`, `fuel_type`, `seats`, `location`, `hourly_rate`, `daily_rate`, `security_deposit`, `available_from`, `available_until`, `status`, `description`, `cancellation_policy`. |
| `vehicle_images` | `id` (`INT UNSIGNED AUTO_INCREMENT`) | `vehicle_id` → `vehicles(id)` (`ON DELETE CASCADE`). Ordered image URLs per vehicle. |
| `vehicle_features` | `id` (`INT UNSIGNED AUTO_INCREMENT`) | `vehicle_id` → `vehicles(id)` (`ON DELETE CASCADE`). Ordered feature list per vehicle. |
| `vehicle_rules` | `id` (`INT UNSIGNED AUTO_INCREMENT`) | `vehicle_id` → `vehicles(id)` (`ON DELETE CASCADE`). Ordered rental policy rules per vehicle. |
| `bookings` | `id` (`VARCHAR(36)`) | `vehicle_id` → `vehicles(id)`, `renter_id` → `users(id)`, `owner_id` → `users(id)`. Tracks `pickup_datetime`, `return_datetime`, `actual_return_datetime`, `duration_hours`, `hourly_rate`, `rental_amount`, `security_deposit`, `late_hours`, `late_penalty`, `condition_on_return`, `damage_description`, `estimated_repair_cost`, `damage_amount`, `damage_review_status`, `damage_admin_notes`, `status`, `reminders_sent`. |
| `booking_damage_evidence` | `id` (`INT UNSIGNED AUTO_INCREMENT`) | `booking_id` → `bookings(id)` (`ON DELETE CASCADE`). Stores return inspection evidence files. |
| `incidents` | `id` (`VARCHAR(36)`) | `booking_id` → `bookings(id)`, `vehicle_id` → `vehicles(id)`, `reported_by` → `users(id)`. Tracks damage, non-return, suspected theft, and accident claims (`OPEN`, `UNDER_REVIEW`, `RESOLVED`, `CLOSED`). |
| `incident_evidence` | `id` (`INT UNSIGNED AUTO_INCREMENT`) | `incident_id` → `incidents(id)` (`ON DELETE CASCADE`). Stores evidence URLs per incident. |
| `notifications` | `id` (`VARCHAR(36)`) | `user_id` → `users(id)` (`ON DELETE CASCADE`). Stores user and admin notifications. |

---

## 3. Step-by-Step Local Setup Instructions (XAMPP + phpMyAdmin + React/Vite)

### Step 1: Start XAMPP Services
1. Open **XAMPP Control Panel**.
2. Start **Apache** and **MySQL**.

### Step 2: Import `database/schema.sql` in phpMyAdmin
1. Open `http://localhost/phpmyadmin` in your browser.
2. Click the **Import** tab at the top.
3. Choose `database/schema.sql` from this project.
4. Click **Import / Go**.
   - This automatically creates the `velorent_db` database, all 11 normalized tables with foreign keys, and initial fleet/booking records.

### Step 3: Place the PHP Backend in XAMPP `htdocs`
1. Copy the `backend` folder into your XAMPP `htdocs` directory:
   - Windows path: `C:\xampp\htdocs\velorent\backend`
   - macOS path: `/Applications/XAMPP/htdocs/velorent/backend`
2. Default MySQL credentials in `backend/config/database.php` already match standard XAMPP:
   - Host: `127.0.0.1`
   - Port: `3306`
   - Database: `velorent_db`
   - User: `root`
   - Password: `""` (empty string)
3. Verify the PHP API in your browser:
   - Open `http://localhost/velorent/backend/api/state/bootstrap.php`
   - You will see a JSON response with `"success": true` and all vehicles from `velorent_db`.

### Step 4: Run the React/Vite Frontend
1. (Optional) Create a `.env` file in the project root:
   ```env
   VITE_API_BASE_URL="http://localhost/velorent/backend/api"
   ```
   *(Note: Even if you do not create `.env`, the dev server automatically detects XAMPP at `http://127.0.0.1/velorent/backend/api` and proxies `/api/*` requests to your PHP + MySQL backend.)*
2. Start the frontend:
   ```bash
   npm install
   npm run dev
   ```
3. Open `http://localhost:3000`.

---

## 4. Pre-Seeded Database Accounts in `database/schema.sql`

You can register any new account on `/signup` (passwords are hashed with `password_hash($password, PASSWORD_BCRYPT)`), or sign in with the pre-seeded accounts from `database/schema.sql`:

| Role | Name | Email | Password |
| :--- | :--- | :--- | :--- |
| **Customer (Renter & Host)** | Arjun Mehta | `arjun.mehta@example.in` | `password` |
| **Customer (Host & Renter)** | Priya Nair | `priya.nair@example.in` | `password` |
| **Customer (Host & Renter)** | Rohan Deshmukh | `rohan.deshmukh@example.in` | `password` |
| **Platform Admin** | Vikramaditya Rao | `admin@velorent.in` | `password` |
