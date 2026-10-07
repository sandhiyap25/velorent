# VeloRent — Peer-to-Peer Vehicle Rental Platform

VeloRent is a full-stack vehicle rental marketplace where users can list
their own vehicles for rent and book vehicles listed by others. It handles
listings, bookings, availability scheduling, security deposits, and
damage/incident reporting.

## Tech Stack

Frontend: React 19 + TypeScript + Vite + Tailwind CSS
Backend:  PHP 8 (PDO) REST API
Database: MySQL / MariaDB (via XAMPP)

## Features

- User signup/login with token-based auth
- List a vehicle with multiple uploaded photos
- Create, view, update, and delete vehicle listings (My Fleet)
- Real-time availability — shows "Booked now" vs "Available" based on
  actual bookings, not just a static status
- Auto-suggested pickup/return time based on current time and existing
  bookings
- Book a vehicle with live price calculation (hourly rate x duration +
  security deposit)
- Return flow with condition notes and late-fee calculation
- Incident reporting (damage, theft, non-return) with evidence upload
- Notifications for bookings, returns, and incidents
- Admin role for platform oversight

## Project Structure

OnlineVR/
├── backend/              PHP REST API (place inside XAMPP htdocs)
│   ├── api/               Endpoints: auth, vehicles, bookings, incidents, uploads
│   ├── config/            Database connection + CORS/JSON helpers
│   ├── middleware/        Auth middleware
│   └── utils/             Shared helper functions
├── database/
│   ├── schema.sql                        Full DB schema + seed data
│   └── migration_soft_delete_vehicles.sql  Run once if upgrading an older DB
├── src/                   React frontend source
└── package.json

## Local Setup (XAMPP)

1. Start XAMPP
   Open XAMPP Control Panel, start Apache and MySQL.

2. Import the database
   Open http://localhost/phpmyadmin
   Import tab -> choose database/schema.sql -> Go
   This creates the velorent_db database with all tables and seed data.

3. Place the backend in htdocs
   Copy the "backend" folder into:
     Windows: C:\xampp\htdocs\OnlineVR\backend
     macOS:   /Applications/XAMPP/htdocs/OnlineVR/backend

   Check it works by opening in a browser:
     http://localhost/OnlineVR/backend/api/state/bootstrap.php
   You should see JSON with "success": true

4. Configure the frontend
   Copy .env.example to .env and set:
     VITE_API_BASE_URL="http://localhost/OnlineVR/backend/api"

5. Run the frontend
     npm install
     npm run dev
   Open http://localhost:3000

## Test Accounts (password: "password" for all)

Customer (Host & Renter): arjun.mehta@example.in
Customer (Host & Renter): priya.nair@example.in
Platform Admin:           admin@velorent.in


## Notes

- backend/uploads/ stores real photos uploaded through the app at runtime.
 
- If you're upgrading a database created before vehicle soft-delete was
  added, run database/migration_soft_delete_vehicles.sql once in
  phpMyAdmin.
