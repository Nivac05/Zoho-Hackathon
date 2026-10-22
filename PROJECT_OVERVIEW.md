# C-HIVE — Smart EV Charging & Decentralized Grid Platform
## Comprehensive Technical Documentation & Architectural Specification

---

## 1. Executive Summary: What is C-HIVE?

**C-HIVE** is an intelligent, decentralized Electric Vehicle (EV) charging marketplace and smart grid orchestration platform. It bridges the gap between **EV Drivers** searching for guaranteed charging slots and **Station Lenders** (commercial operators, small businesses, or residential charger owners) looking to monetize their charging infrastructure.

Unlike conventional charging apps that only provide static map pins with stale status indicators, C-HIVE implements:
- **Zero-Latency Real-Time Slot Synchronization:** Using Server-Sent Events (SSE) so users see slot state changes instantly without reloading.
- **Deep Q-Network (DQN) Dynamic Pricing:** An AI engine that calculates energy pricing based on real-time grid load, time of day, and location demand.
- **Atomic Concurrency Locks:** A 5-minute reservation hold mechanism that prevents double-booking race conditions during high-demand surges.
- **Cross-Platform Native Experience:** A responsive, mobile-first web interface wrapped into an installable Android APK via Capacitor.
- **Zero-Cost Free Mapping:** Built entirely on Leaflet and OpenStreetMap with custom dark-slate tile filters and Nominatim location recommendations—requiring zero external API keys or billing quotas.

---

## 2. Why is this Project So Important Currently?

The global transition to electric mobility is accelerating rapidly, yet the charging infrastructure suffers from critical bottlenecks:

### A. The "Charger Anxiety" & Phantom Availability Problem
- Drivers frequently navigate 20–30 minutes to a charging station marked "available" on static maps, only to find another vehicle plugged in or the charger queued up with a 45-minute wait.
- **How C-HIVE solves this:** C-HIVE introduces **guaranteed time slots** with **atomic 5-minute reservation holds**. Once a driver selects a slot, the system locks it across the entire network in real time. If payment is completed, the slot is definitively booked.

### B. Severe Urban Grid Load & Energy Spikes
- Unmanaged EV charging causes dangerous transformer overloads during evening peak hours (6 PM – 9 PM) when domestic power consumption is already at its daily maximum.
- **How C-HIVE solves this:** The integrated **PyTorch DQN (Deep Q-Network)** reinforcement learning model implements dynamic price signals:
  - **Off-Peak Night Discounts (12 AM – 6 AM):** Lower prices encourage overnight charging.
  - **Solar Peak Discounts (10 AM – 4 PM):** Discounted rates incentivize charging during maximum renewable/solar generation.
  - **Surge Pricing (6 PM – 9 PM):** Discourages non-critical charging during peak local grid strain.

### C. Underutilized Private & Semi-Commercial Infrastructure
- Millions of private wall-boxes and corporate fleet chargers sit idle for 16 to 20 hours every day.
- **How C-HIVE solves this:** C-HIVE creates an **Airbnb-style marketplace for EV chargers**. Any lender can register a station in under 60 seconds with an interactive map picker, define connectors and power ratings, and immediately receive automated payouts to their virtual wallet.

### D. Eliminating Proprietary API & Billing Vendor Lock-In
- Most production mapping tools (Google Maps Platform, Mapbox) impose steep billing thresholds, credit-card requirements, and strict quota limits that break prototypes and hackathon demos.
- **How C-HIVE solves this:** Open-source OpenStreetMap tiles paired with client-side CSS inversion filters and Nominatim geocoding deliver a zero-cost, enterprise-grade mapping experience with autocomplete recommendations.

---

## 3. System Architecture & Tech Stack

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 18 + Vite)                       │
│  - Tailwind CSS + Custom Industrial Dark Design System                 │
│  - Leaflet + OSM Dark Tiles (Zero API Key)                             │
│  - Server-Sent Events (SSE) EventSource Listener                       │
│  - Capacitor Android Native Wrapper                                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP REST + SSE Stream
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Python Flask REST API)                 │
│  - Flask-CORS, Flask-Bcrypt, Flask-JWT-Extended                        │
│  - SSE Pub/Sub Event Broadcaster (Thread-Safe Queue)                   │
│  - Background Daemon Thread for Expired Slot Cleanup                   │
│  - PyTorch Deep Q-Network (DQN) Pricing Inference                      │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌────────────────────────────────────┐  ┌────────────────────────────────┐
│   DATABASE (SQLite 3 with WAL)     │  │     AI REINFORCEMENT LEARNING  │
│  - Write-Ahead Logging (WAL)       │  │  - PyTorch DQN Model (.pth)    │
│  - Immediate Transaction Locks     │  │  - StandardScaler (.pkl)       │
│  - Strict Relational Schema        │  │  - Canonical Price Validation  │
└────────────────────────────────────┘  └────────────────────────────────┘
```

---

## 4. Component-by-Component Breakdown

### A. Frontend Components (`frontend/src/`)

1. **`Navbar.jsx`**
   - **Role:** Global persistent header and navigation bar.
   - **Features:** Shows brand identity, role-aware navigation links (Find Chargers, My Bookings, Lender Portal), live wallet balance pill (polling every 15s), user avatar, and one-click sign out.

2. **`MapView.jsx`**
   - **Role:** Interactive multi-station explorer map on the Home page.
   - **Features:** Renders all active charging stations with custom color-coded teardrop pins (green = available plugs, red = fully occupied). Smoothly flies to selected stations and opens styled popup cards with station metadata.

3. **`MapPicker.jsx`**
   - **Role:** High-precision station location selector for lenders.
   - **Features:**
     - **Location Autocomplete:** Real-time search input querying Nominatim. Displays a suggestion dropdown like Google Maps.
     - **Smooth Fly-To:** Automatically centers and zooms the map onto the chosen landmark or street.
     - **Interactive Click:** Allows pinpoint clicking anywhere on the map to set coordinates.
     - **Reverse Geocoding:** Auto-resolves GPS latitude/longitude into human-readable street addresses and auto-populates the registration form.

4. **`LoadingSkeleton.jsx`**
   - **Role:** Perceived performance enhancer.
   - **Features:** Shimmering placeholder cards displayed during asynchronous data fetching to eliminate layout shift.

### B. Frontend Pages (`frontend/src/pages/`)

1. **`Login.jsx`**
   - **Design:** Modern split-screen layout (left: platform features & EV grid branding; right: clean authentication form).
   - **Features:** JWT authentication, error alerts, and one-click **Quick Demo Login buttons** for evaluators (`driver1` and `lender1`).

2. **`Register.jsx`**
   - **Design:** Split-screen layout matching Login.
   - **Features:** Allows users to register as either an **EV Driver** or **Station Lender**, enforcing password complexity and unique username/email constraints.

3. **`Home.jsx`**
   - **Role:** Primary discovery hub for EV drivers.
   - **Features:** Live station directory, search bar, filters for Area/Zone, Connector Type (CCS2, Type 2, CHAdeMO), and Power Level (22 kW to 120 kW). Features a responsive Split/List/Map layout toggle.

4. **`BookSlot.jsx`**
   - **Role:** End-to-end charging slot reservation control room.
   - **Features:**
     - Date picker (defaults to today; prevents selecting past dates).
     - Visual grid of hourly charging slots (06:00 to 23:00) color-coded by state: **Available**, **Held (5-min lock)**, and **Booked**.
     - AI Dynamic Pricing requester displaying calculated rates and renewable energy justifications.
     - Atomic 5-minute slot hold with live countdown timer.
     - In-modal wallet payment confirmation.
     - Zero-reload real-time updates via Server-Sent Events.

5. **`MyBookings.jsx`**
   - **Role:** Driver activity center and virtual wallet ledger.
   - **Features:**
     - Segmented lists of **Upcoming**, **Past**, and **Cancelled** charging sessions.
     - 2-Hour free cancellation button with automatic wallet refund.
     - Virtual wallet balance card with one-click top-up and complete transaction history.

6. **`LenderDashboard.jsx`**
   - **Role:** Comprehensive management portal for charging station owners.
   - **Features:**
     - **My Stations Tab:** Overview of all stations owned by the lender, with plug maintenance toggles (`AVAILABLE` ↔ `MAINTENANCE`).
     - **Earnings & Grid Analytics Tab:** Net revenue, wallet balance, confirmed sessions count, total charging hours delivered, station utilization percentage, and receipt records.
     - **Add Station Tab:** Form connected to the interactive `MapPicker` for registering new charging hubs.

### C. Backend Engine (`backend/app.py` & `database.py`)

1. **`database.py`**
   - Initializes SQLite in **Write-Ahead Logging (WAL)** mode for concurrent reads and writes.
   - Manages threading locks (`db_lock`) and enforces strict foreign key constraints across tables: `users`, `stations`, `plugs`, `slots`, `bookings`, and `wallet_transactions`.
   - Contains `release_expired_holds()` which automatically resets slots whose 5-minute hold window has elapsed back to `AVAILABLE`.

2. **`app.py`**
   - Implements 15+ secure REST endpoints protected by JWT claims and role-based access control.
   - Runs a background daemon thread every 15 seconds executing `release_expired_holds()` and pushing updates to connected clients.
   - Manages the thread-safe SSE Pub/Sub broadcaster at `/api/slots/stream`.
   - Hosts the PyTorch DQN model inference routine with fallback heuristics.

---

## 5. Detailed Walkthrough of All 10 User Flows

### Flow 1: Sign Up & Log In (Dual-Role Authentication)
- Users register with full name, unique username, email, password (min 8 chars), and role (`driver` or `lender`).
- Initial wallet balances are provisioned on sign-up (₹1,000 for drivers; ₹500 for lenders).
- Passwords are encrypted with Bcrypt salt rounds. JWT access tokens encode user identity, role, and metadata.

### Flow 2: Station Browsing & Real-Time Filtering
- Drivers view charging hubs on the map or list.
- Real-time filters filter by Zone (ECR, Anna Nagar, Medavakkam, Pammal, Maduravoyal), Connector type, and Power level.
- Live badge chips indicate whether open plugs currently exist at that station.

### Flow 3: Slot Availability & Operating Windows
- Drivers select a date. The backend queries operating windows (e.g. 06:00 to 23:00) and correlates booked/held slots.
- Slots are rendered with clear visual states: Green (Available), Amber (Temporarily Held by someone else), Slate (Already Booked), and Dimmed (Past hours).

### Flow 4: AI Dynamic Price Estimation
- Drivers pick a slot and duration (1 to 4 hours) and click "Calculate Dynamic Rate with AI".
- The backend evaluates the input through the Deep Q-Network model and returns a canonical rate along with an explainable reason (e.g., *"Mid-day solar surge discount applied"* or *"Evening peak demand surge applied"*).

### Flow 5: Atomic 5-Minute Slot Hold (Concurrency Guard)
- Drivers click "Reserve Slot (Hold 5 Mins)".
- The backend checks slot availability inside a database write lock. If another user attempts to hold the same slot simultaneously, the second request immediately receives an HTTP `409 Conflict`.
- Upon successful hold, a 5-minute countdown starts on the frontend, and an SSE broadcast notifies all other connected drivers that the slot is now locked.

### Flow 6: Booking Confirmation & Wallet Settlement
- Drivers click "Pay with Virtual Wallet & Confirm".
- The backend atomically deducts the quoted fee from the driver's wallet, credits the station lender's wallet, transitions the slot status to `BOOKED`, creates a booking record, and logs the wallet transactions.
- A final SSE event notifies the network that the slot is confirmed.

### Flow 7: My Bookings & Virtual Wallet Ledger
- Drivers review all upcoming and completed bookings with station addresses, time ranges, and receipts.
- Drivers can inspect their wallet balance and execute instant wallet top-ups (₹200, ₹500, ₹1,000).

### Flow 8: Booking Cancellation & Automatic Refund
- Drivers can cancel any upcoming booking up to 2 hours before the start time.
- The cancellation marks the booking as `CANCELLED`, resets the underlying slot to `AVAILABLE`, refunds 100% of the booking fee to the driver's wallet, debits the lender's wallet, and pushes an SSE update to reopen the slot on all client maps.

### Flow 9: Lender Station Management & Grid Analytics
- Lenders can add stations with auto-resolved addresses from the map picker.
- Lenders can toggle individual plugs in and out of maintenance mode.
- Lenders have access to grid analytics: total sessions, net revenue, utilization percentages, and booking logs.

### Flow 10: Real-Time SSE Slot Updates (Zero Page Reload)
- When any driver holds, books, or cancels a slot—or when an expired hold is cleaned up—the server broadcasts a lightweight JSON payload over Server-Sent Events.
- All open client browsers automatically refresh their slot availability matrix without requiring a page reload.

---

## 6. Android Native Integration (Capacitor)

The platform is designed mobile-first and packaged for Android using **Capacitor**:
- **Configuration:** Defined in `frontend/capacitor.config.json` with App ID `com.bmw.chive`.
- **Assets Sync:** Automated via `npm run build && npx cap sync android`.
- **Mobile Principles Applied:**
  - 44px minimum touch targets on all interactive elements.
  - Safe-area inset padding for edge-to-edge camera notches and navigation bars.
  - Smooth hardware-accelerated CSS animations and touch feedback.
  - Viewport meta tags preventing accidental user zooming and UI displacement.

---

## 7. How to Run & Test the Application

### Backend:
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python seed.py     # Seeds test stations, plugs, and demo accounts
python app.py      # Starts Flask REST API on http://127.0.0.1:5000
```

### Frontend:
```bash
cd frontend
npm install
npm run dev        # Starts Vite dev server on http://localhost:5173
```

### Quick Demo Accounts:
- **Driver:** Username: `driver1` | Password: `password123`
- **Lender:** Username: `lender1` | Password: `password123`
