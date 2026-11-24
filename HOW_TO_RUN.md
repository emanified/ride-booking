# Ride Booking App — Quick Start

## Prerequisites
- Node.js 18+ and npm
- Python 3.9+
- MongoDB running locally on port 27017

---

## 1. Backend Setup

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# (Optional) Edit .env to set a custom SECRET_KEY or MONGO_URI
# Defaults: MongoDB at localhost:27017, DB name: ride_booking

# Start the backend
python app.py
```
Backend runs on http://localhost:5000

---

## 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```
Frontend runs on http://localhost:5173

Maps run on OpenFreeMap (tiles) + MapLibre GL JS, with Nominatim for search/reverse
geocoding and OSRM for routing. All three are public, unauthenticated endpoints — no
API key, no .env entry, and nothing to configure in Google Cloud. Your machine just
needs outbound internet access to:
  - tiles.openfreemap.org
  - nominatim.openstreetmap.org
  - router.project-osrm.org

If those domains are blocked (e.g. a restrictive VPN/firewall), the map tiles, search,
and routing will fail gracefully (error state / haversine distance fallback) rather
than crash the page.

---

## 3. Test the App

1. OpenCCC
2. Register as a Passenger, Driver, or use the seed admin
3. Log in as a Passenger → Book a Ride
4. The map should load immediately — no "Map service unavailable" error
5. Search for a pickup/dropoff using the search inputs (type 3+ characters)
6. Or click "Select Pickup on Map" / "Select Dropoff on Map" and click the map
   - The address field auto-fills via reverse geocoding
7. Route line, distance, duration, and fare appear automatically
8. Click "Request ride" to book

---

## Seed Admin Account

```bash
cd scripts
python seed_admin.py
```

---

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@ridebook.com | admin123 |
| Driver | driver1@ridebook.com | cab |
| Passenger | passenger1@ridebook.com | cab |

`driver1`/`passenger1` are regular accounts created via Register, not seeded
automatically — if your database has been wiped (e.g. `scripts/reset_db.py`),
re-register them through the app before these credentials will work.
