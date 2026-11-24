# MongoDB setup (Compass only)

This app uses **MongoDB only** — no MySQL.

## 1. Start MongoDB

- **Windows**: Services → **MongoDB Server (MongoDB)** → Start
- Or start from **MongoDB Compass** if it offers to start the local service

## 2. Connect in Compass

| Field    | Value                        |
|----------|------------------------------|
| URI      | `mongodb://127.0.0.1:27017`  |
| Database | `ride_booking` (auto-created)|

Collections created automatically when the app runs:

- `users` — accounts (passenger, driver, admin)
- `trips` — all rides
- `payments` — payment records
- `counters` — auto-increment IDs
- `trip_events` — status history
- `driver_reviews` — ratings

## 3. Backend config

```powershell
cd ride-booking-app
copy backend\.env.example backend\.env
```

## 4. Seed admin user

```powershell
python scripts\seed_admin.py
```

| Email              | Password |
|--------------------|----------|
| admin@ridebook.com | admin123 |

## 5. Run the app

```powershell
cd backend
pip install -r requirements.txt
python app.py
```

Check: http://localhost:5000/health → `"mongodb": "connected"`

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Phase 4 — Geospatial Index (Nearby Driver Matching)

The following indexes are created automatically on backend startup via `store.ensure_geospatial_indexes()`:

```js
// Required for $near queries (nearest driver matching)
db.users.createIndex({ currentLocation: "2dsphere" })

// Supporting indexes for the availability filter
db.users.createIndex({ role: 1 })
db.users.createIndex({ isOnline: 1 })
db.users.createIndex({ isAvailable: 1 })
db.users.createIndex({ vehicleType: 1 })

// Trip indexes
db.trips.createIndex({ status: 1 })
db.trips.createIndex({ passenger_id: 1 })
db.trips.createIndex({ driver_id: 1 })
db.trips.createIndex({ assignedDriverId: 1 })

## Phase 8 — Payments, Earnings, Notifications, Messages

Recommended indexes created by backend on startup:

```js
db.trip_events.createIndex({ tripId: 1, createdAt: 1 })
db.payments.createIndex({ trip_id: 1 }, { unique: true })
db.payments.createIndex({ passenger_id: 1 })
db.payments.createIndex({ driver_id: 1 })
db.payments.createIndex({ status: 1 })

db.driver_earnings.createIndex({ trip_id: 1 }, { unique: true })
db.driver_earnings.createIndex({ driverId: 1 })
db.driver_earnings.createIndex({ earnedAt: -1 })

db.notifications.createIndex({ userId: 1, isRead: 1 })
db.notifications.createIndex({ createdAt: -1 })

db.messages.createIndex({ tripId: 1, createdAt: 1 })
```

The `driver_earnings` collection is the canonical source of driver earnings. Payments are marked `paid` by the demo auto-pay flow and then an earnings record is created once per trip.
```

New fields added to user documents (drivers only):
- `isOnline` (bool) — driver has called go-online
- `isAvailable` (bool) — driver is online and not on an active trip
- `vehicleType` (str) — synced from approved vehicle on go-online
- `currentLocation` (GeoJSON Point) — { type: "Point", coordinates: [lng, lat] }
- `currentLocationUpdatedAt` (datetime)
- `activeTripId` (int | null) — set when driver is reserved for a trip

New fields added to trip documents:
- `assignedDriverId` (int | null)
- `matching` (object) — method, requestedVehicleType, searchRadiusMeters, matchedAt, pickupPoint
- Status values now include: `assigned`, `pending_driver` (in addition to existing statuses)
