---
title: "Rate Limiter — System Design"
description: "High-level design for a rate limiter: algorithms, data model, storage, and failure modes."
ShowToc: true
TocOpen: true
---

> **Iteration:** v1 — Basic Design
> **Next:** Distributed rate limiting, multi-tier strategies, adaptive throttling

---

## 1. Problem Statement

A rate limiter controls the number of requests a client can send to a server within a defined time window. Without one, a single client (malicious or buggy) can overwhelm the system, degrading service for everyone.

### When do you need a rate limiter?

| Scenario | Example |
|---|---|
| Prevent abuse / DDoS | Bot hammering login endpoint |
| Protect shared resources | Database connection pool exhaustion |
| Enforce billing tiers | Free tier: 100 req/min, Pro: 10K req/min |
| Ensure fairness | One tenant on a multi-tenant platform shouldn't starve others |
| Cost control | Upstream API charges per call (e.g., OpenAI, Twilio) |

---

## 2. Requirements

### 2.1 Functional Requirements

- **FR1:** Limit requests per client (identified by user ID, API key, or IP) to N requests per time window.
- **FR2:** Return a clear rejection response (HTTP 429) when the limit is exceeded.
- **FR3:** Support configurable limits — different endpoints or user tiers can have different limits.
- **FR4:** Include rate limit metadata in response headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`).

### 2.2 Non-Functional Requirements (Basic)

| NFR | Target | Why it matters |
|---|---|---|
| **Latency** | < 1ms per check | Rate limiter sits in the hot path of every request |
| **Accuracy** | Best-effort (slight over-count is acceptable) | Exact counting is expensive; a few extra requests slipping through is fine |
| **Availability** | Should not become a single point of failure | If the limiter goes down, we need a fallback policy (fail-open vs fail-closed) |
| **Memory** | Bounded, proportional to active clients | Can't allocate unbounded memory per IP/user |

> **Parking for v2:** Strong consistency across nodes, geo-distributed limiting, sub-second window granularity.

---

## 3. High-Level Architecture (v1 — Single Node)

```
                    ┌─────────────────────────┐
                    │        Client            │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │      API Gateway /       │
                    │     Reverse Proxy        │
                    │   (e.g., Nginx, Envoy)   │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │    Rate Limiter          │
                    │    Middleware            │
                    │                         │
                    │  ┌───────────────────┐  │
                    │  │  In-Memory Store   │  │
                    │  │  (HashMap/Cache)   │  │
                    │  └───────────────────┘  │
                    └────────────┬────────────┘
                                 │
                          ┌──────┴──────┐
                          │             │
                       ALLOWED       REJECTED
                          │             │
                          ▼             ▼
                    ┌───────────┐  ┌──────────┐
                    │  App      │  │ HTTP 429  │
                    │  Server   │  │ Too Many  │
                    │           │  │ Requests  │
                    └───────────┘  └──────────┘
```

### Where does the rate limiter live?

| Option | Pros | Cons |
|---|---|---|
| **Client-side** | Reduces unnecessary network calls | Can be bypassed; not trustworthy |
| **Server middleware** | Simple to implement; colocated with app logic | Coupled to app; doesn't protect upstream |
| **API Gateway** | Centralized; language-agnostic; protects all services | Another infra component to manage |

**v1 decision:** Server middleware (simplest to start). We'll move to API Gateway in v2.

---

## 4. Rate Limiting Algorithms

This is the core of the design. There are 4 well-known algorithms. Let's understand each and pick one for v1.

### 4.1 Fixed Window Counter

**How it works:** Divide time into fixed windows (e.g., each minute). Maintain a counter per client per window. Increment on each request. Reject if counter > limit.

```
Window: [12:00:00 — 12:01:00]   Counter: 0 → 1 → 2 → ... → 100 → REJECT

Window: [12:01:00 — 12:02:00]   Counter resets to 0
```

**Data structure:**
```
Key: "{client_id}:{window_start_timestamp}"
Value: count (integer)
```

| Pros | Cons |
|---|---|
| Dead simple | **Boundary burst problem**: 100 requests at 12:00:59 + 100 at 12:01:00 = 200 in 2 seconds |
| Low memory (1 entry per client per window) | Unfair at window edges |

### 4.2 Sliding Window Log

**How it works:** Store the timestamp of every request. On a new request, remove timestamps older than `now - window_size`. If remaining count >= limit, reject.

```
Timestamps: [12:00:01, 12:00:05, 12:00:12, ..., 12:00:58]
New request at 12:01:02 → remove everything before 12:00:02 → count remaining
```

**Data structure:**
```
Key: "{client_id}"
Value: sorted set of timestamps
```

| Pros | Cons |
|---|---|
| Perfectly accurate sliding window | **High memory** — stores every timestamp |
| No boundary burst problem | Cleanup overhead on every request |

### 4.3 Sliding Window Counter (Hybrid)

**How it works:** Combine fixed window counter with a weighted overlap from the previous window.

```
Previous window count: 80 (window was 60s, 45s have passed into current)
Current window count: 20 (15s into current window)

Estimated count = 80 × (45/60) + 20 = 60 + 20 = 80
```

| Pros | Cons |
|---|---|
| Low memory (two counters per client) | Approximate (but very close in practice) |
| Smooths out boundary bursts | Slightly more complex logic |

### 4.4 Token Bucket

**How it works:** Each client has a bucket with capacity `B` tokens. Tokens are added at rate `R` per second. Each request consumes 1 token. If the bucket is empty, reject.

```
Bucket capacity: 10
Refill rate: 2 tokens/sec

[t=0]  Bucket: 10  →  Request arrives  →  Bucket: 9   ✓
[t=0]  Bucket: 9   →  Request arrives  →  Bucket: 8   ✓
...
[t=0]  Bucket: 0   →  Request arrives  →  REJECTED    ✗
[t=1]  Bucket: 2 (refilled)  →  Request arrives  →  Bucket: 1  ✓
```

**Data structure:**
```
Key: "{client_id}"
Value: { tokens: float, last_refill_timestamp: epoch }
```

No background thread needed — compute tokens lazily on each request:
```
elapsed = now - last_refill_timestamp
tokens = min(capacity, tokens + elapsed × refill_rate)
```

| Pros | Cons |
|---|---|
| Allows controlled bursts (up to bucket size) | Two parameters to tune (capacity + rate) |
| Smooth rate enforcement | Slightly harder to reason about than counters |
| Very low memory (2 values per client) | |
| Industry standard (AWS, Stripe use this) | |

### Algorithm Comparison Summary

| Algorithm | Memory | Accuracy | Burst Handling | Complexity |
|---|---|---|---|---|
| Fixed Window | Low | Weak at edges | Poor | Very Low |
| Sliding Window Log | High | Exact | Good | Medium |
| Sliding Window Counter | Low | Approximate | Good | Low |
| Token Bucket | Low | Good | Controlled bursts | Medium |

### v1 Decision: Token Bucket

**Why:** It's the industry standard. Low memory. Allows controlled bursts (which is realistic — users often send a few requests quickly, then pause). Two values per client. No background threads.

---

## 5. Detailed Design (v1)

### 5.1 Core Data Model

```
RateLimitEntry {
    tokens:              float64    // current tokens available
    last_refill_time:    int64      // unix timestamp (milliseconds)
}

RateLimitConfig {
    bucket_capacity:     int        // max burst size
    refill_rate:         float64    // tokens per second
}
```

### 5.2 Algorithm Pseudocode

```
function is_allowed(client_id, config):
    entry = store.get(client_id)

    if entry is null:
        entry = { tokens: config.bucket_capacity, last_refill_time: now() }

    // Lazy refill
    elapsed = now() - entry.last_refill_time
    entry.tokens = min(config.bucket_capacity, entry.tokens + elapsed * config.refill_rate)
    entry.last_refill_time = now()

    if entry.tokens >= 1:
        entry.tokens -= 1
        store.set(client_id, entry)
        return ALLOWED    // remaining = floor(entry.tokens)
    else:
        store.set(client_id, entry)
        return REJECTED   // retry_after = (1 - entry.tokens) / config.refill_rate
```

### 5.3 HTTP Response Design

**Allowed (200/2xx):**
```
HTTP/1.1 200 OK
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1708425600
```

**Rejected (429):**
```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1708425600
Retry-After: 3
Content-Type: application/json

{
    "error": "rate_limit_exceeded",
    "message": "Too many requests. Please retry after 3 seconds.",
    "retry_after_seconds": 3
}
```

### 5.4 Client Identification Strategy

| Method | Use Case | Limitation |
|---|---|---|
| API Key | Authenticated APIs | Doesn't work for unauthenticated endpoints |
| User ID | Per-user limits after auth | Same — requires authentication |
| IP Address | Unauthenticated / pre-auth endpoints | Shared IPs (NAT, corporate proxies) punish all users behind them |
| Composite Key | `"{user_id}:{endpoint}"` | Best for per-endpoint-per-user limiting |

**v1 decision:** Use API Key as primary identifier. Fall back to IP for unauthenticated endpoints.

### 5.5 Configuration Example

```yaml
rate_limits:
  default:
    bucket_capacity: 100
    refill_rate: 10        # 10 requests/sec sustained, 100 burst

  tiers:
    free:
      bucket_capacity: 20
      refill_rate: 2
    pro:
      bucket_capacity: 200
      refill_rate: 50
    enterprise:
      bucket_capacity: 1000
      refill_rate: 200

  endpoint_overrides:
    "/api/v1/login":
      bucket_capacity: 5    # Strict — prevent brute force
      refill_rate: 0.1       # 1 attempt per 10 seconds sustained
    "/api/v1/search":
      bucket_capacity: 30
      refill_rate: 5
```

---

## 6. Storage Choice (v1)

| Option | Latency | Persistence | Fit for v1? |
|---|---|---|---|
| In-process HashMap | ~nanoseconds | None (lost on restart) | Yes — simplest |
| Redis | ~0.5ms | Optional | Overkill for single node |
| Memcached | ~0.5ms | None | Overkill for single node |

**v1 decision:** In-process HashMap (or ConcurrentHashMap in Java / `sync.Map` in Go).

**Eviction:** Use a TTL equal to `bucket_capacity / refill_rate` (time to fully refill). Clients who stop sending requests get cleaned up automatically. Alternatively, run a periodic cleanup goroutine/thread every 60 seconds.

---

## 7. Failure Mode: Fail-Open vs Fail-Closed

This is a critical design decision even for v1.

| Strategy | Behavior when limiter fails | Risk |
|---|---|---|
| **Fail-open** | Allow all requests through | System can be overwhelmed |
| **Fail-closed** | Reject all requests | Legitimate users blocked |

**v1 decision:** Fail-open with alerting. Rationale: The rate limiter protects, but it should never become the reason the service is down. Log aggressively when the limiter is unavailable so ops can react.

---

## 8. What This Design Handles

- [x] Per-client rate limiting (by API key or IP)
- [x] Configurable limits per tier and endpoint
- [x] Controlled bursts via token bucket
- [x] Clear rejection response with retry guidance
- [x] Low latency (in-memory, no network hop)
- [x] Bounded memory with TTL-based eviction

## 9. What This Design Does NOT Handle (Yet)

These are intentionally deferred to keep v1 simple. Each becomes a future iteration.

| Gap | Why it matters | Future iteration |
|---|---|---|
| **Distributed rate limiting** | Multiple app servers each have their own counters — a client gets N × limit | v2: Centralized store (Redis) |
| **Race conditions** | Concurrent requests on same node can read stale token count | v2: Atomic operations / Lua scripts |
| **Global rate limiting** | Limit across all clients (e.g., total 10K req/s to protect DB) | v3: Global token bucket |
| **Sliding window precision** | Token bucket allows bursts; some use cases need strict per-second caps | v3: Hybrid algorithm |
| **Multi-region** | Users hitting different data centers get separate limits | v4: Cross-DC synchronization |
| **Adaptive / dynamic limits** | Adjusting limits based on system health (CPU, queue depth) | v4: Feedback loop |
| **Request prioritization** | Not all requests are equal — health checks vs writes | v3: Priority queues |
| **Analytics & observability** | Who's being throttled? How often? | v2: Metrics + dashboards |

---

## 10. Quick Estimation (Back-of-Envelope)

Assumptions: 1M active users, rate limit check on every request.

| Dimension | Calculation | Result |
|---|---|---|
| **Memory per entry** | client_id (64B) + tokens (8B) + timestamp (8B) | ~80 bytes |
| **Total memory (1M users)** | 80B × 1,000,000 | **~80 MB** |
| **Latency per check** | HashMap lookup + arithmetic | **< 1 microsecond** |
| **Throughput** | CPU-bound; single core can do millions of lookups/sec | **Not a bottleneck** |

This fits comfortably in a single server's memory. The rate limiter will never be the bottleneck at this scale.

---

## 11. Interview Discussion Points

When presenting this design, a staff/principal engineer would highlight:

1. **"I chose token bucket because..."** — shows you evaluated alternatives and made a reasoned tradeoff.
2. **Fail-open vs fail-closed** — shows you think about failure modes proactively.
3. **"This breaks down when..."** — acknowledging the single-node limitation and having a clear v2 plan shows architectural maturity.
4. **Response headers** — shows you think about developer experience, not just backend plumbing.
5. **Per-endpoint overrides** — shows you understand that not all traffic is equal (login vs search).

---

## Next: v2 — Distributed Rate Limiting

When we're ready, the next iteration will tackle:
- Moving from in-memory to Redis (centralized store)
- Handling race conditions with atomic operations (Redis Lua scripts / `MULTI`/`EXEC`)
- Consistency vs availability tradeoffs in the rate limiter itself
- Observability: metrics, dashboards, alerting on throttle rates
