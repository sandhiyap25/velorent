# 🚗 VeloRent — Peer-to-Peer Vehicle Rental Platform

**VeloRent** is a full-stack peer-to-peer vehicle rental platform that allows users to **list their own vehicles for rent** and **book vehicles listed by other users**.

The platform manages the complete rental workflow, including vehicle listings, availability, bookings, security deposits, returns, late fees, and incident reporting.

---

## ✨ Key Features

### 👤 User Management

* User registration and login
* Token-based authentication
* Customer and Admin roles
* Users can act as both **vehicle owners and renters**

### 🚘 Vehicle Management

* Add and manage vehicle listings
* Upload multiple vehicle photos
* View, edit, and delete listings
* **My Fleet** section for vehicle owners
* Real-time vehicle availability based on active bookings

### 📅 Booking & Availability

* View available vehicles
* Automatic pickup and return time suggestions
* Prevents booking conflicts with existing reservations
* Live rental price calculation
* Security deposit calculation

**Rental Cost = Hourly Rate × Rental Duration + Security Deposit**

### 🔄 Vehicle Return

* Record vehicle return
* Add vehicle condition notes
* Calculate late-return charges
* Track completed rentals

### ⚠️ Incident Management

* Report vehicle damage
* Report theft or non-return
* Upload supporting evidence
* Track reported incidents

### 🔔 Notifications

Notifications are generated for:

* New bookings
* Vehicle returns
* Incidents and reports

### 🛡️ Admin Management

* Admin dashboard
* Platform oversight
* Manage users, vehicles, bookings, and incidents

---

## 🛠️ Tech Stack

| Layer           | Technology                 |
| --------------- | -------------------------- |
| Frontend        | React 19, TypeScript, Vite |
| Styling         | Tailwind CSS               |
| Backend         | PHP 8                      |
| API             | REST API                   |
| Database        | MySQL / MariaDB            |
| Database Access | PDO                        |
| Local Server    | XAMPP                      |

---

## 📂 Project Structure

```text
OnlineVR/
│
├── backend/
│   ├── api/
│   │   ├── auth/
│   │   ├── vehicles/
│   │   ├── bookings/
│   │   ├── incidents/
│   │   └── uploads/
│   │
│   ├── config/
│   │   ├── Database connection
│   │   └── CORS / JSON helpers
│   │
│   ├── middleware/
│   │   └── Authentication middleware
│   │
│   └── utils/
│       └── Shared helper functions
│
├── database/
│   ├── schema.sql
│   └── migration_soft_delete_vehicles.sql
│
├── src/
│   └── React frontend source
│
├── package.json
└── .env.example
```

---

# 🚀 Local Setup

## 1. Start XAMPP

Open **XAMPP Control Panel** and start:

* Apache
* MySQL

---

## 2. Create the Database

Open:

```text
http://localhost/phpmyadmin
```

Go to **Import → Choose File** and select:

```text
database/schema.sql
```

Click **Go**.

This will create the:

```text
velorent_db
```

database along with the required tables and seed data.

---

## 3. Configure the Backend

Copy the `backend` folder into the XAMPP `htdocs` directory.

### Windows

```text
C:\xampp\htdocs\OnlineVR\backend
```

### macOS

```text
/Applications/XAMPP/htdocs/OnlineVR/backend
```

---

## 4. Test the Backend

Open the following URL in your browser:

```text
http://localhost/OnlineVR/backend/api/state/bootstrap.php
```

A successful setup should return JSON similar to:

```json
{
  "success": true
}
```

---

## 5. Configure the Frontend

Create a `.env` file from `.env.example`.

Set the API URL:

```env
VITE_API_BASE_URL=http://localhost/OnlineVR/backend/api
```

---

## 6. Install Dependencies

Open the project folder in the terminal:

```bash
npm install
```

---

## 7. Start the Frontend

```bash
npm run dev
```

Open the URL shown by Vite, usually:

```text
http://localhost:3000
```

---


---

# 🗄️ Database Migration

If you are upgrading an older VeloRent database where **vehicle soft-delete** was not previously implemented, run:

```text
database/migration_soft_delete_vehicles.sql
```

You only need to run this migration once.

---

# 📸 Vehicle Photos

Uploaded vehicle photos are stored at runtime in:

```text
backend/uploads/
```

Make sure this directory has appropriate write permissions when running the application locally.

---

# 🔄 Application Workflow

```text
User Registration / Login
          ↓
    Browse Vehicles
          ↓
    Check Availability
          ↓
       Book Vehicle
          ↓
    Vehicle Pickup
          ↓
      Rental Period
          ↓
     Return Vehicle
          ↓
 Condition Verification
          ↓
 Late Fee / Incident Check
          ↓
    Booking Completed
```

---

## 🎯 Project Objective

The main objective of VeloRent is to provide a **secure and convenient peer-to-peer vehicle rental system** where vehicle owners can generate income from their vehicles while renters can easily discover and book available vehicles.

The system focuses on **real-time availability, automated rental calculations, secure booking management, and incident tracking**.

---

## 📌 Future Enhancements

* Online payment gateway integration
* GPS-based vehicle tracking
* Advanced identity verification
* AI-based vehicle damage detection
* Mobile application
* Rating and review system
* Automated fraud detection

---

## 👩‍💻 Developed As

**VeloRent — Full-Stack Web Application**

Built using **React, TypeScript, PHP, MySQL, and XAMPP**.
