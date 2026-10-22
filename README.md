# ⚡ C-HIVE — Smart EV Charging Platform

> **AI-Powered Dynamic Pricing & Real-Time EV Slot Reservation Grid for Chennai**  
> *Built with React, Vite, Flask, SQLite/MongoDB WAL, PyTorch DQN, Server-Sent Events (SSE), and Capacitor Android.*

---

## 🌟 Architecture Overview

C-HIVE connects EV **Drivers** with charging station **Lenders**. The platform features AI-driven dynamic pricing using a Deep Q-Network (DQN) model, real-time slot state synchronization across devices without page reloads, atomic 5-minute concurrency-safe holds, a virtual wallet system, and native Android support via Capacitor.

```text
Zoho-Hackathon-main/
├── backend/
│   ├── app.py                 # Flask REST API, Auth, Wallet, SSE Pub/Sub
│   ├── database.py            # SQLite WAL persistence layer with concurrency locks
│   ├── seed.py                # Database seeder with sample Chennai hubs & accounts
│   ├── artifacts/             # PyTorch DQN model (dqn_model.pth, scaler.pkl)
│   ├── tests/
│   │   └── test_concurrency.py # Multithreaded test verifying atomic hold locking
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx          # Auth with demo one-click logins
│   │   │   ├── Register.jsx       # Driver / Lender onboarding
│   │   │   ├── Home.jsx           # Split map/list charging hub browser & filters
│   │   │   ├── BookSlot.jsx       # Real-time slot availability, AI price & 5m hold
│   │   │   ├── MyBookings.jsx     # Booking receipts, cancellations & wallet ledger
│   │   │   └── LenderDashboard.jsx# Station registration, maintenance & analytics
│   │   ├── components/            # MapView, MapPicker, Navbar, Skeletons
│   │   └── services/api.js        # REST client & EventSource SSE stream
│   ├── capacitor.config.json      # Android WebView configuration
│   └── android/                   # Capacitor Android native project
└── README.md
```

---

## 📡 Real-Time Slot State Updates: Architecture & Technical Choice

### The Requirement
> *"When another user holds or books a seat/slot, it changes state on my open seat map within a few seconds, without a page reload. Use polling, Server-Sent Events or WebSockets. Explain your choice in the README."*

### Technology Comparison

| Evaluation Metric | Short Polling (3–5s) | WebSockets (WS/WSS) | Server-Sent Events (SSE) (Selected) |
| :--- | :--- | :--- | :--- |
| **Data Direction** | Request/Response poll | Bi-directional duplex | **Server-to-Client Unidirectional Push** |
| **Protocol Overhead** | Extremely high; repeated HTTP handshake headers every 3s | Low after initial handshake, but stateful WS protocol | **Low; standard HTTP/1.1 or HTTP/2 persistent stream** |
| **Mobile & Battery Impact** | Drains battery, keeps mobile radio awake | High reconnection overhead on mobile networks | **Optimal; OS and browser handle streaming sleep states** |
| **Auto-Reconnection** | N/A (Manual timer) | Must be implemented manually | **Native `EventSource` automatic reconnect & backoff** |
| **Proxy / WebView Compatibility** | Good | Can be blocked by corporate firewalls/proxies | **Flawless; uses standard HTTP `text/event-stream`** |

### Why We Chose Server-Sent Events (SSE)
For charging slot / seat reservation maps, client actions (e.g., requesting a 5-minute hold or confirming payment) are mutations handled cleanly via idempotent **REST APIs** (`POST /api/slots/hold`, `POST /api/slots/confirm`). The only real-time requirement is **broadcasting slot state changes (`AVAILABLE` → `HELD` → `BOOKED` → `CANCELLED`) to all viewers**.

**SSE is the superior engineering choice here because:**
1. **Unidirectional Efficiency:** The map page only needs to receive live state updates from the server; client interactions remain standard REST calls.
2. **Native Resilience in Android WebViews:** The standard browser `EventSource` API reconnects automatically if the driver enters a tunnel or loses cellular signal, re-syncing availability instantly upon reconnect.
3. **No Stateful Socket Server Complexity:** Unlike WebSockets, SSE works cleanly across serverless gateways, load balancers, and standard HTTP servers without requiring persistent stateful socket cluster coordination.

---

## 📱 Android Principles & Mobile Implementation

The web application is converted into an installable Android app using **Capacitor 8** (`frontend/android`). When adapting C-HIVE for Android, the following core Android design and platform principles were implemented:

1. **Material Design Touch Targets (48x48 dp):**
   - All interactive slot items, plug switches, filter buttons, and payment CTA controls have a minimum touch target size of **48x48 dp** with ample padding, ensuring effortless thumb-reachability on mobile devices.
2. **Safe Area & Edge-to-Edge Padding:**
   - Handled notch, camera cutouts, and Android navigation bar insets using CSS `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`.
3. **Hardware Back Button Handling:**
   - React Router navigation integrates with Capacitor's Android back-button event listener. Pressing back from slot reservation returns the user to the stations map rather than abruptly exiting the app.
4. **Reconnection & Network State Feedback:**
   - The UI includes live state badges (`🟢 Live State Sync Active` vs `🟡 Sync Reconnecting...`) so mobile drivers have continuous visual feedback on their connectivity.
5. **Battery-Efficient Background Operation:**
   - Real-time streams are closed when navigating away or minimizing the app, conserving the vehicle driver's mobile battery.

---

## 🔒 Concurrency Protection & Atomic 5-Minute Slot Holds

To guarantee that two drivers cannot book or hold the same physical charging plug simultaneously:
1. **Atomic State Lock:** The backend executes hold requests inside an atomic transaction using database row locking. If two requests arrive at the same millisecond, the database grants the hold to the first transaction and immediately returns `409 Conflict` to the second.
2. **5-Minute Auto-Expiry:** Every hold record is tagged with an ISO timestamp `held_until`. A background cleanup worker and query-time check automatically releases expired holds back to `AVAILABLE`.
3. **Automated Verification:**
   Run the concurrency stress test to prove simultaneous requests result in exactly one hold:
   ```bash
   cd backend
   python tests/test_concurrency.py
   ```
   **Output:**
   ```text
   [Driver 1] HTTP Status: 200 -> Slot held successfully for 5 minutes.
   [Driver 2] HTTP Status: 409 -> This slot is currently held by another driver.
   [SUCCESS] CONCURRENCY PROOF VERIFIED: Exactly one driver held the slot!
   ```

---

## 🚀 Quick Start Guide

### 1. Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate   # On Windows
pip install -r requirements.txt

python seed.py          # Seeds initial Chennai stations and test users
python app.py           # Starts API server on http://localhost:5000
```

### 2. Frontend Web Setup
```bash
cd frontend
npm install
npm run dev             # Starts Vite development server on http://localhost:5173
```

### 3. Build & Sync Installable Android App
```bash
cd frontend
npm run build           # Compiles production React bundle to dist/
npx cap sync android    # Copies assets and plugins to android/ project

# To open in Android Studio:
npx cap open android

# Or build debug APK directly:
cd android
./gradlew assembleDebug
```
The installable APK will be generated at `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 🔑 Demo Credentials

| Role | Username | Password | Wallet Balance | Features |
| :--- | :--- | :--- | :--- | :--- |
| **EV Driver** | `driver1` | `password123` | ₹1,500.00 | Browse Map, AI Dynamic Price, 5m Hold, Pay, Cancel & Refund |
| **Station Lender** | `lender1` | `password123` | ₹500.00 | Register Stations with Map Picker, Toggle Maintenance, Earnings Analytics |
