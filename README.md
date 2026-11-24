# Ride Booking App

Full-stack ride booking app using **MongoDB only**.

**Full documentation:** see [PROJECT_GUIDE.md](PROJECT_GUIDE.md) for architecture, API reference, user flows, and troubleshooting.

## Tech Stack

- **Frontend:** React, Vite, React Router, Tailwind
- **Backend:** Flask, JWT auth
- **Database:** MongoDB (users, trips, payments, reviews)

## Quick start

See **[DATABASE_SETUP.md](DATABASE_SETUP.md)** for MongoDB Compass steps.

### 1. Start MongoDB

**Option A: Using mongod directly (Windows)**
```powershell
mkdir C:\data\db
mongod --dbpath C:\data\db
```

**Option B: Using MongoDB as a Windows Service (if installed as service)**
```powershell
net start MongoDB
```

Keep this terminal open. MongoDB will listen on `mongodb://127.0.0.1:27017/`

### 2. Set up and run Backend

Open a **new PowerShell terminal** in the project root:

```powershell
# Copy environment template
copy backend\.env.example backend\.env

# Navigate to backend
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Seed the admin user into MongoDB
python ..\scripts\seed_admin.py

# Start the Flask backend server
python app.py
```

Backend will start on `http://localhost:5000`

Check health: `http://localhost:5000/health` (should show `{"api": "ok", "mongodb": "connected"}`)

### 3. Set up and run Frontend

Open a **third PowerShell terminal** in the project root:

```powershell
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```

Frontend will start on `http://localhost:5173`

### Access the app

| Component | URL | Notes |
|-----------|-----|-------|
| App | `http://localhost:5173` | Frontend UI |
| API Health | `http://localhost:5000/health` | Backend status check |
| Admin Login | `admin@ridebook.com` / `admin123` | Created by `seed_admin.py` |

### Verify everything is running

Once all three services are running (MongoDB, Backend, Frontend):
1. Open `http://localhost:5173` in your browser
2. You should see the Ride Booking App login page
3. Try logging in with admin credentials above
4. Passenger and driver registrations should work

## Project structure

```
ride-booking-app/
├── DATABASE_SETUP.md
├── scripts/seed_admin.py
├── backend/
│   ├── app.py
│   ├── store.py          # MongoDB data layer
│   ├── config/mongo.py
│   └── routes/
└── frontend/
    └── src/
```
