---
title: "Last-Mile Delivery System — System Design (Zomato 10-Min Style)"
description: "High-level design for a last-mile delivery platform with real-time order tracking, capacity estimation for 1M daily orders, and global scalability."
ShowToc: true
TocOpen: true
---

> **Iteration:** v1 — Complete Design
> **Scope:** HLD, Real-time Tracking Deep Dive, Capacity Estimation, Global Scalability

---

## 1. Problem Statement

Design a last-mile delivery platform (like Zomato's 10-minute delivery) that enables:
- Customers to order products and track delivery in real-time on a map
- Riders to receive orders, navigate, and update delivery status
- Partners (stores/restaurants) to manage inventory and order preparation
- Operations to monitor and optimize delivery efficiency

### Key Challenges

| Challenge | Description |
|-----------|-------------|
| **Real-time tracking** | Live rider location on map with smooth animation |
| **Sub-15 minute delivery** | Dark stores, hyperlocal inventory, instant dispatch |
| **Scale** | 1M+ daily orders, 50K+ concurrent riders |
| **Reliability** | Order must never be "lost" — state machine with clear transitions |
| **Global expansion** | Data sovereignty, regional compliance, local integrations |

---

## 2. Requirements

### 2.1 Functional Requirements

| ID | Requirement |
|----|-------------|
| **FR1** | Customer can browse products, place orders, and pay |
| **FR2** | Customer can track order status and rider location in real-time on map |
| **FR3** | Rider receives order assignment with pickup and delivery details |
| **FR4** | Rider app captures GPS location and updates ETA continuously |
| **FR5** | Partner app shows incoming orders and manages preparation status |
| **FR6** | System auto-assigns optimal rider based on location, load, and ETA |
| **FR7** | Support for multiple delivery states: preparing, picked up, in transit, delivered |
| **FR8** | Notifications at key milestones (order confirmed, out for delivery, arriving) |

### 2.2 Non-Functional Requirements

| NFR | Target | Rationale |
|-----|--------|-----------|
| **Availability** | 99.95% | Orders are revenue; downtime = lost business |
| **Latency (API)** | P99 < 200ms | Mobile users expect instant response |
| **Latency (Tracking)** | < 3s location lag | Real-time feel on map |
| **Throughput** | 100 orders/sec peak | 1M daily with 3x headroom |
| **Location updates** | 15K updates/sec | 50K riders × 1 update/3 sec |
| **Data durability** | No order loss | Financial implications |
| **Scalability** | Horizontal | Must handle 10x growth |

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                        │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────────┤
│  Customer App   │   Rider App     │  Partner App    │      Admin Dashboard      │
│  (iOS/Android)  │  (iOS/Android)  │  (Web/Mobile)   │         (Web)             │
└────────┬────────┴────────┬────────┴────────┬────────┴──────────────┬────────────┘
         │                 │                 │                       │
         ▼                 ▼                 ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY / LOAD BALANCER                            │
│                    (Kong/AWS ALB + WAF + Rate Limiting)                         │
└────────┬────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              BFF LAYER (Backend for Frontend)                    │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────────┤
│  Customer BFF   │    Rider BFF    │   Partner BFF   │       Admin BFF           │
└────────┬────────┴────────┬────────┴────────┬────────┴──────────────┬────────────┘
         │                 │                 │                       │
         ▼                 ▼                 ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            CORE DOMAIN SERVICES                                  │
├───────────┬───────────┬───────────┬───────────┬───────────┬─────────────────────┤
│  Order    │ Inventory │  Rider    │  Tracking │  Pricing  │   Notification      │
│  Service  │  Service  │  Service  │  Service  │  Service  │     Service         │
├───────────┼───────────┼───────────┼───────────┼───────────┼─────────────────────┤
│  Payment  │  Partner  │  Routing  │  Search   │    ETA    │   Analytics         │
│  Service  │  Service  │  Service  │  Service  │  Service  │     Service         │
└───────────┴───────────┴───────────┴───────────┴───────────┴─────────────────────┘
         │                 │                 │                       │
         ▼                 ▼                 ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DATA & MESSAGING LAYER                                 │
├───────────────┬─────────────────┬─────────────────┬─────────────────────────────┤
│   PostgreSQL  │   Redis Cluster │   Apache Kafka  │    Elasticsearch            │
│  (Orders, etc)│  (Cache, Geo)   │  (Event Stream) │    (Search/Logs)            │
├───────────────┼─────────────────┼─────────────────┼─────────────────────────────┤
│  TimescaleDB  │   S3/MinIO      │   ClickHouse    │       MongoDB               │
│ (Time-series) │    (Files)      │   (Analytics)   │  (Flexible Schema)          │
└───────────────┴─────────────────┴─────────────────┴─────────────────────────────┘
```

### 3.1 Core Services Breakdown

| Service | Responsibility | Key Technologies |
|---------|---------------|------------------|
| **Order Service** | Order lifecycle management (create, update, cancel) | PostgreSQL, Kafka |
| **Inventory Service** | Real-time stock management at dark stores | Redis, PostgreSQL |
| **Rider Service** | Rider onboarding, availability, assignment | PostgreSQL, Redis Geo |
| **Tracking Service** | Real-time location tracking & updates | Redis Geo, WebSocket, TimescaleDB |
| **Routing Service** | Optimal route calculation, navigation | OSRM/GraphHopper, Redis |
| **ETA Service** | Dynamic ETA prediction using ML | Python/TensorFlow, Redis |
| **Payment Service** | Payment processing, refunds, wallet | PostgreSQL, Kafka (for idempotency) |
| **Notification Service** | Push, SMS, Email notifications | Firebase, SNS, Kafka |
| **Search Service** | Product/restaurant search | Elasticsearch |
| **Analytics Service** | Real-time & batch analytics | ClickHouse, Spark |

---

## 4. Deep Dive: Real-Time Order Tracking

### 4.1 Tracking Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         REAL-TIME TRACKING SYSTEM                             │
└──────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────┐                                           ┌─────────────────┐
  │  Rider App  │───────GPS Updates (3-5s)─────────────────▶│ Location Ingestion│
  │  (Android/  │       HTTP POST / MQTT                    │    Gateway       │
  │    iOS)     │                                           │   (Go/Rust)      │
  └─────────────┘                                           └────────┬─────────┘
                                                                     │
                                                                     ▼
                                                          ┌──────────────────────┐
                                                          │   Apache Kafka       │
                                                          │ topic: rider-location│
                                                          │  (Partitioned by     │
                                                          │   rider_id % 128)    │
                                                          └──────────┬───────────┘
                                                                     │
                    ┌────────────────────────────────────────────────┼──────────────┐
                    │                                                │              │
                    ▼                                                ▼              ▼
         ┌────────────────────┐                         ┌──────────────────┐ ┌─────────────┐
         │ Location Processor │                         │   ETA Calculator │ │ TimescaleDB │
         │  (Kafka Consumer)  │                         │    (ML Model)    │ │ (Historical │
         │                    │                         │                  │ │   Storage)  │
         └─────────┬──────────┘                         └────────┬─────────┘ └─────────────┘
                   │                                             │
                   ▼                                             │
         ┌────────────────────┐                                  │
         │   Redis Cluster    │◀─────────────────────────────────┘
         │  (Geo + Pub/Sub)   │
         │                    │
         │ • GEOADD rider:loc │
         │ • HSET order:track │
         │ • PUBLISH channel  │
         └─────────┬──────────┘
                   │
                   │ Redis Pub/Sub
                   ▼
         ┌────────────────────┐
         │  WebSocket Server  │
         │   (Node.js/Go)     │
         │                    │
         │ • Connection Pool  │
         │ • Room Management  │
         │ • Heartbeat        │
         └─────────┬──────────┘
                   │
                   │ WebSocket (wss://)
                   ▼
         ┌─────────────────┐
         │  Customer App   │
         │  (Map + ETA)    │
         └─────────────────┘
```

### 4.2 Data Flow for Location Update

```
Timeline: Every 3-5 seconds per active rider

1. LOCATION CAPTURE (Rider App)
   ├── GPS coordinates (lat, lng)
   ├── Accuracy (meters)
   ├── Speed (km/h)
   ├── Bearing (direction)
   ├── Battery level
   └── Timestamp (device + server)

2. INGESTION (Location Gateway)
   ├── Validate payload
   ├── Dedupe (same location within 1s)
   ├── Rate limit (max 1 update/2s per rider)
   └── Publish to Kafka

3. PROCESSING (Kafka Consumer)
   ├── Update Redis GEO index
   │   └── GEOADD riders:location <lng> <lat> <rider_id>
   ├── Update order tracking state
   │   └── HSET order:<order_id>:tracking location <coords> eta <seconds>
   ├── Calculate ETA (if order active)
   └── Publish to Redis Pub/Sub channel

4. REAL-TIME PUSH (WebSocket Server)
   ├── Subscribe to order-specific channel
   ├── Serialize update (Protocol Buffers)
   └── Push to connected clients

5. CLIENT RENDER (Customer App)
   ├── Interpolate movement (smooth animation)
   ├── Update map marker
   └── Update ETA display
```

### 4.3 WebSocket Connection Management

```json
{
  "room_id": "order:ORD12345",
  "subscribers": [
    {"client_id": "cust_abc123", "connected_at": "...", "last_heartbeat": "..."},
    {"client_id": "support_xyz", "connected_at": "...", "last_heartbeat": "..."}
  ],
  "rider_id": "rider_456",
  "order_state": "OUT_FOR_DELIVERY"
}
```

**Connection Lifecycle:**

```
Customer Opens Tracking → 
  1. HTTP: GET /api/v1/orders/{id}/tracking-token (JWT, 30min expiry)
  2. WebSocket: CONNECT wss://tracking.example.com/ws?token={jwt}
  3. WebSocket: JOIN_ROOM {order_id}
  4. Server: SUBSCRIBE to Redis channel order:{order_id}
  5. Loop: Receive location updates, push to client
  6. Customer Closes App → DISCONNECT → Cleanup subscriptions
```

### 4.4 Location Data Schema

```sql
-- TimescaleDB for historical tracking data
CREATE TABLE rider_locations (
    time            TIMESTAMPTZ NOT NULL,
    rider_id        UUID NOT NULL,
    order_id        UUID,
    latitude        DOUBLE PRECISION NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    accuracy        REAL,
    speed           REAL,
    bearing         REAL,
    battery_level   SMALLINT,
    city_id         INTEGER NOT NULL,
    
    PRIMARY KEY (time, rider_id)
);

-- Convert to hypertable (TimescaleDB)
SELECT create_hypertable('rider_locations', 'time', chunk_time_interval => INTERVAL '1 hour');

-- Compression policy (after 24 hours)
SELECT add_compression_policy('rider_locations', INTERVAL '24 hours');

-- Retention policy (keep 90 days)
SELECT add_retention_policy('rider_locations', INTERVAL '90 days');
```

**Redis Data Structures:**

```
// 1. Real-time rider locations (GEO index by city)
GEOADD riders:city:mumbai <lng> <lat> <rider_id>

// 2. Order tracking state (Hash)
HSET order:ORD12345:tracking \
  rider_id "rider_456" \
  rider_lat "19.0760" \
  rider_lng "72.8777" \
  store_lat "19.0748" \
  store_lng "72.8856" \
  dest_lat "19.0822" \
  dest_lng "72.8812" \
  eta_seconds "480" \
  state "PICKED_UP" \
  last_updated "1709123456"

// 3. Active orders per rider (Set)
SADD rider:rider_456:active_orders ORD12345 ORD12346

// TTL: Auto-expire after 2 hours
EXPIRE order:ORD12345:tracking 7200
```

### 4.5 ETA Prediction Model

**Input Features:**

```python
{
    "distance_remaining_km": 1.2,
    "current_speed_kmh": 18.5,
    "traffic_factor": 1.3,           # 1.0 = normal, >1 = congestion
    "time_of_day": "evening_peak",   # categorical
    "day_of_week": "friday",
    "weather": "clear",
    "rider_experience_score": 4.2,
    "historical_route_time_p50": 420, # seconds
    "live_signal_count": 3,          # traffic signals ahead
    "elevation_change_m": 12
}
```

**Output:**

```python
{
    "eta_seconds": 480,
    "confidence": 0.85,
    "range_low": 420,
    "range_high": 560
}
```

### 4.6 Tracking States & Transitions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ORDER TRACKING STATE MACHINE                          │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌───────────┐    order_placed    ┌────────────────┐   accepted    ┌───────────┐
  │  CREATED  │──────────────────▶│ WAITING_ACCEPT │─────────────▶│  ACCEPTED │
  └───────────┘                    └────────────────┘               └─────┬─────┘
                                                                         │
                                                                   preparing
                                                                         │
                                                                         ▼
┌─────────────┐   delivered    ┌───────────────┐   picked_up    ┌────────────────┐
│  DELIVERED  │◀───────────────│OUT_FOR_DELIVERY│◀──────────────│   PREPARING    │
└─────────────┘                └───────────────┘                └────────────────┘
       │                              │
       │                              │ customer_unavailable
       ▼                              ▼
┌─────────────┐                ┌───────────────┐
│  COMPLETED  │                │   ON_HOLD     │
└─────────────┘                └───────────────┘

// Map shows rider location from: ACCEPTED → DELIVERED
// Different UI for each state:
// - PREPARING: Show store location + prep timer
// - OUT_FOR_DELIVERY: Live rider tracking + ETA
// - DELIVERED: Delivery proof (photo/OTP)
```

---

## 5. Capacity Estimation (1M Daily Orders - India)

### 5.1 Traffic Patterns

```
Peak Hours Analysis (India):
├── Lunch Peak:   12:00 - 14:00 (25% of daily orders)
├── Dinner Peak:  19:00 - 22:00 (40% of daily orders)
├── Off-Peak:     Remaining hours (35% of daily orders)

Peak Factor: ~3-4x average load during dinner peak
```

### 5.2 Core Metrics Calculation

```
Daily Orders:           1,000,000
Peak Hours (Dinner):    3 hours = 10,800 seconds
Peak Orders:            400,000 orders (40% of daily)

┌─────────────────────────────────────────────────────────────────────────────┐
│                          ORDERS PER SECOND (OPS)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  Average OPS:     1,000,000 / 86,400 ≈ 12 OPS                              │
│  Peak OPS:        400,000 / 10,800 ≈ 37 OPS                                │
│  Design Target:   100 OPS (2.5x headroom for spikes/flash sales)           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Rider & Location Metrics

```
Assumptions:
├── Active riders during peak:        50,000 riders
├── Orders per rider per hour:        2-3 orders
├── Average delivery time:            10-15 minutes
├── GPS update frequency:             Every 3 seconds (during active delivery)

┌─────────────────────────────────────────────────────────────────────────────┐
│                     LOCATION UPDATES PER SECOND                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Riders with active orders:     ~25,000 (at any moment during peak)         │
│  Updates per rider:             1 update / 3 seconds                        │
│  Location updates/sec:          25,000 / 3 ≈ 8,333 updates/sec              │
│  Design Target:                 15,000 updates/sec (with headroom)          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.4 WebSocket Connections

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CONCURRENT WEBSOCKET CONNECTIONS                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Active orders (peak):              ~60,000 at any moment                   │
│  Customers tracking:                ~50,000 (80% track their order)         │
│  Support agents:                    ~500                                    │
│  Partner apps (stores):             ~5,000                                  │
│                                                                             │
│  Total WebSocket connections:       ~55,000 concurrent                      │
│  Design Target:                     100,000 connections                     │
│                                                                             │
│  Messages/sec outbound:             55,000 × (1 update/3s) ≈ 18,000 msg/s  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.5 Storage Estimation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DAILY STORAGE REQUIREMENTS                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LOCATION DATA (TimescaleDB)                                                │
│  ├── Updates/day: 8,333/s × 86,400s = 720M records                         │
│  ├── Avg record size: ~100 bytes                                           │
│  ├── Daily raw: 720M × 100B = 72 GB/day                                    │
│  ├── With compression (10:1): ~7.2 GB/day                                  │
│  └── 90-day retention: ~650 GB                                             │
│                                                                             │
│  ORDER DATA (PostgreSQL)                                                    │
│  ├── Orders/day: 1M                                                        │
│  ├── Avg order size: ~2 KB (with line items, addresses)                    │
│  ├── Daily: 2 GB/day                                                       │
│  └── 1-year retention: ~730 GB                                             │
│                                                                             │
│  REDIS (In-Memory)                                                          │
│  ├── Active order tracking: 60K × 500B = 30 MB                             │
│  ├── Rider GEO index: 50K × 50B = 2.5 MB                                   │
│  ├── Caches, sessions: ~500 MB                                             │
│  └── Total Redis: ~1 GB (design for 10 GB with headroom)                   │
│                                                                             │
│  KAFKA (Retention: 24 hours)                                                │
│  ├── Location topic: 720M × 150B = 108 GB                                  │
│  ├── Order events: 5M × 500B = 2.5 GB                                      │
│  └── Total: ~120 GB with replication factor 3 = 360 GB                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.6 Bandwidth Estimation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BANDWIDTH REQUIREMENTS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LOCATION INGESTION (Rider → Server)                                        │
│  ├── 15K updates/sec × 200 bytes = 3 MB/s = 24 Mbps                        │
│                                                                             │
│  WEBSOCKET OUTBOUND (Server → Customers)                                    │
│  ├── 18K messages/sec × 300 bytes = 5.4 MB/s = 43 Mbps                     │
│                                                                             │
│  API TRAFFIC (REST/GraphQL)                                                 │
│  ├── Peak: 10K requests/sec × 5 KB avg = 50 MB/s = 400 Mbps                │
│                                                                             │
│  TOTAL EGRESS: ~500 Mbps peak (design for 1 Gbps)                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.7 Infrastructure Sizing

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       INFRASTRUCTURE REQUIREMENTS                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SERVICE INSTANCES (Kubernetes pods)                                        │
│  ├── Order Service:         8 pods × 2 vCPU, 4GB RAM                       │
│  ├── Tracking Service:      12 pods × 4 vCPU, 8GB RAM                      │
│  ├── WebSocket Servers:     10 pods × 4 vCPU, 8GB RAM (10K conn each)      │
│  ├── Location Processor:    6 pods × 2 vCPU, 4GB RAM                       │
│  ├── Other services:        ~30 pods combined                              │
│                                                                             │
│  DATABASES                                                                  │
│  ├── PostgreSQL:    Primary + 2 Read Replicas (16 vCPU, 64GB each)        │
│  ├── TimescaleDB:   3-node cluster (32 vCPU, 128GB, 2TB SSD each)         │
│  ├── Redis Cluster: 6 nodes (8 vCPU, 32GB each)                           │
│                                                                             │
│  KAFKA                                                                      │
│  ├── Brokers:       6 nodes (8 vCPU, 32GB, 500GB SSD each)                │
│  ├── Partitions:    128 partitions for location topic                      │
│                                                                             │
│  ESTIMATED MONTHLY COST (AWS Mumbai): $80,000 - $120,000                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Global Scalability (US, UK, etc.)

### 6.1 Multi-Region Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      GLOBAL MULTI-REGION ARCHITECTURE                        │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │  Global DNS     │
                              │  (Route 53 /    │
                              │   Cloudflare)   │
                              └────────┬────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
              ▼                        ▼                        ▼
    ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
    │   INDIA REGION  │     │    US REGION    │     │    UK REGION    │
    │  (ap-south-1)   │     │   (us-east-1)   │     │  (eu-west-2)    │
    └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
             │                       │                       │
    ┌────────┴────────┐     ┌────────┴────────┐     ┌────────┴────────┐
    │                 │     │                 │     │                 │
    ▼                 ▼     ▼                 ▼     ▼                 ▼
┌───────┐        ┌───────┐ ┌───────┐    ┌───────┐ ┌───────┐    ┌───────┐
│Mumbai │        │Delhi  │ │Virginia│   │Oregon │ │London │    │Dublin │
│ Zone  │        │ Zone  │ │ Zone   │   │ Zone  │ │ Zone  │    │ Zone  │
└───────┘        └───────┘ └───────┘   └───────┘ └───────┘    └───────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  REGIONAL (Isolated per region - Data Sovereignty)                          │
│  ├── Order Data (PostgreSQL)                                                │
│  ├── Customer PII (PostgreSQL - encrypted)                                  │
│  ├── Location History (TimescaleDB)                                         │
│  ├── Payment Data (PCI-compliant isolated)                                  │
│  └── Redis Cache (regional cluster)                                         │
│                                                                             │
│  GLOBAL (Replicated across regions)                                         │
│  ├── Product Catalog (CockroachDB / Spanner)                               │
│  ├── Partner/Restaurant Master Data                                         │
│  ├── ML Models & Feature Flags                                              │
│  └── Configuration & Secrets (Vault)                                        │
│                                                                             │
│  ANALYTICS (Centralized with regional read replicas)                        │
│  ├── ClickHouse cluster (primary in one region)                            │
│  ├── Data Lake (S3 with cross-region replication)                          │
│  └── ML Training Pipeline (centralized)                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Region-Specific Considerations

| Aspect | India | US | UK |
|--------|-------|-----|-----|
| **Map Provider** | Google Maps + OpenStreetMap | Mapbox / Google Maps | HERE / Google Maps |
| **Payment** | Razorpay, Paytm, UPI, Cards | Stripe, PayPal, Apple Pay | Stripe, Apple Pay, Klarna |
| **SMS Provider** | MSG91, Kaleyra | Twilio | Twilio, MessageBird |
| **Compliance** | RBI data local, IT Act | CCPA (California), State laws | GDPR, Data Protection Act |
| **Data Residency** | India only | US only | EU/UK only |
| **Currency** | INR | USD | GBP |
| **Distance Unit** | Kilometers | Miles | Miles |
| **Time Format** | 12-hour | 12-hour | 24-hour |

### 6.3 Data Sovereignty & Compliance Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DATA SOVEREIGNTY IMPLEMENTATION                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         REGIONAL DATA STORE                                  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       REGIONAL DATABASE CLUSTER                      │   │
│  │                                                                      │   │
│  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │   │   Orders DB  │  │ Customers DB │  │  Payments DB (PCI DSS)   │  │   │
│  │   │              │  │              │  │                          │  │   │
│  │   │ • order_id   │  │ • user_id    │  │ • transaction_id         │  │   │
│  │   │ • items      │  │ • name (enc) │  │ • payment_token          │  │   │
│  │   │ • status     │  │ • phone (enc)│  │ • status                 │  │   │
│  │   │ • timestamps │  │ • address    │  │ • encrypted_details      │  │   │
│  │   │              │  │ (encrypted)  │  │                          │  │   │
│  │   └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  │                                                                      │   │
│  │   Encryption: AES-256-GCM, Keys managed by regional HSM              │   │
│  │   Backups: Encrypted, stored in same region                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                     GDPR COMPLIANCE IMPLEMENTATION                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. RIGHT TO ACCESS                                                         │
│     └── Data export API: GET /api/v1/users/{id}/data-export                │
│                                                                             │
│  2. RIGHT TO ERASURE (Right to be Forgotten)                               │
│     └── DELETE /api/v1/users/{id}/erase                                    │
│     └── Cascade deletion across all services                               │
│     └── Anonymize analytics data (keep aggregates)                         │
│                                                                             │
│  3. DATA PORTABILITY                                                        │
│     └── Export in JSON/CSV format                                          │
│                                                                             │
│  4. CONSENT MANAGEMENT                                                      │
│     └── Granular consent tracking per data category                        │
│     └── Consent withdrawal propagation                                     │
│                                                                             │
│  5. DATA RETENTION                                                          │
│     └── Automated purge after retention period                             │
│     └── Legal hold support for disputes                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.4 Cross-Region Communication

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CROSS-REGION EVENT PROPAGATION                            │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌────────────────────┐
                              │   Global Event     │
                              │   Router (Kafka    │
                              │   Mirror Maker 2)  │
                              └─────────┬──────────┘
                                        │
          ┌─────────────────────────────┼─────────────────────────────┐
          │                             │                             │
          ▼                             ▼                             ▼
  ┌───────────────┐           ┌───────────────┐           ┌───────────────┐
  │ India Kafka   │◀─────────▶│  US Kafka     │◀─────────▶│  UK Kafka     │
  │ Cluster       │           │  Cluster      │           │  Cluster      │
  └───────────────┘           └───────────────┘           └───────────────┘
         │                            │                            │
         │                            │                            │
         ▼                            ▼                            ▼
  ┌───────────────────────────────────────────────────────────────────────┐
  │                        REPLICATED TOPICS                               │
  ├───────────────────────────────────────────────────────────────────────┤
  │  • catalog.product.updated        (Replicate globally)                │
  │  • config.feature-flags.changed   (Replicate globally)                │
  │  • analytics.events.aggregated    (Replicate to analytics region)     │
  │                                                                       │
  │  NON-REPLICATED (Regional only):                                      │
  │  • orders.created                 (Stay in region)                    │
  │  • rider.location.updated         (Stay in region)                    │
  │  • payment.processed              (Stay in region)                    │
  └───────────────────────────────────────────────────────────────────────┘
```

### 6.5 Deployment Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     MULTI-REGION DEPLOYMENT STRATEGY                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          GITOPS WORKFLOW                                     │
│                                                                             │
│   GitHub Repo                                                               │
│       │                                                                     │
│       ├── /charts/                    # Helm charts                         │
│       ├── /environments/                                                    │
│       │       ├── india/              # India-specific values               │
│       │       ├── us/                 # US-specific values                  │
│       │       └── uk/                 # UK-specific values                  │
│       └── /base/                      # Common configurations               │
│                                                                             │
│   CI/CD: GitHub Actions → ArgoCD (per region)                              │
│                                                                             │
│   Rollout Strategy:                                                         │
│   1. Deploy to staging (all regions)                                        │
│   2. Canary to India (5% traffic)                                          │
│   3. Progressive rollout India (25% → 50% → 100%)                          │
│   4. Replicate to US, UK (same canary process)                             │
│                                                                             │
│   Rollback: Automatic on error rate > 1% or latency P99 > 500ms            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                     REGIONAL FEATURE FLAGS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  {                                                                          │
│    "feature": "express_delivery",                                           │
│    "enabled_regions": ["india", "uk"],                                      │
│    "rollout_percentage": {                                                  │
│      "india": 100,                                                          │
│      "uk": 25,                                                              │
│      "us": 0                                                                │
│    },                                                                       │
│    "config_overrides": {                                                    │
│      "india": { "delivery_time_minutes": 10 },                             │
│      "uk": { "delivery_time_minutes": 15 }                                 │
│    }                                                                        │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Summary & Key Decisions

### 7.1 Technology Stack Summary

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **API Gateway** | Kong / AWS ALB | Rate limiting, auth, routing |
| **Backend** | Java Spring Boot / Go | Performance, ecosystem |
| **Real-time** | WebSocket (Node.js/Go) | Low latency, high concurrency |
| **Message Queue** | Apache Kafka | High throughput, durability |
| **Primary DB** | PostgreSQL | ACID, mature, extensions |
| **Time-series DB** | TimescaleDB | Location history, compression |
| **Cache/Geo** | Redis Cluster | Sub-ms latency, GEO commands |
| **Search** | Elasticsearch | Full-text, geo-search |
| **Analytics** | ClickHouse | OLAP, fast aggregations |
| **Container** | Kubernetes (EKS/GKE) | Orchestration, scaling |
| **Maps** | Google Maps / Mapbox | Routing, visualization |

### 7.2 Key Design Decisions

1. **Event-Driven Architecture**: Kafka for decoupling services and enabling replay
2. **CQRS for Tracking**: Separate write (location ingestion) and read (WebSocket) paths
3. **Regional Isolation**: Data sovereignty compliance, lower latency
4. **Edge Caching**: CDN for static assets, API caching at gateway
5. **Circuit Breakers**: Resilience for external dependencies (maps, payments)
6. **Idempotency**: All mutations use idempotency keys
7. **Observability**: OpenTelemetry tracing, Prometheus metrics, centralized logging

### 7.3 Scaling Triggers

| Metric | Threshold | Action |
|--------|-----------|--------|
| Order Service CPU | > 70% | Scale out pods |
| Kafka consumer lag | > 10,000 | Add consumer instances |
| WebSocket connections | > 8,000/pod | Add WebSocket servers |
| Redis memory | > 80% | Add shards |
| DB connections | > 80% pool | Add read replicas |
| API latency P99 | > 300ms | Investigate & scale |

---

## 8. Interview Discussion Points

When presenting this design, highlight:

1. **Real-time tracking architecture** — WebSocket + Redis Pub/Sub + Kafka pipeline shows distributed systems understanding
2. **Capacity estimation math** — Shows you can do back-of-envelope calculations under pressure
3. **Regional data isolation** — Shows awareness of compliance (GDPR, RBI) and data sovereignty
4. **State machine for orders** — Shows you think about edge cases and consistency
5. **ETA as ML problem** — Shows you understand where ML adds value vs. simple heuristics
6. **Tradeoffs acknowledged** — Eventual consistency for location, strong consistency for payments

---

## 9. What This Design Does NOT Cover (Future Iterations)

| Gap | Future Iteration |
|-----|-----------------|
| Fraud detection | ML-based anomaly detection for fake deliveries |
| Dynamic pricing (surge) | Real-time demand-supply pricing engine |
| Multi-order batching | Optimizing rider routes for multiple pickups |
| Dark store inventory ML | Demand prediction for inventory placement |
| Customer clustering | Geo-based customer segmentation for marketing |
| Rider incentive optimization | ML for optimal incentive distribution |
