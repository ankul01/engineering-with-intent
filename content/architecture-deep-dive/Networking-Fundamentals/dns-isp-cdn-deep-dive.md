---
title: "DNS, ISP & CDN — Technical Deep Dive"
description: "How DNS resolution works, the role of ISPs in internet routing, and CDN architecture patterns for distributed systems."
ShowToc: true
TocOpen: true
---

> **Scope:** Production-grade understanding of core networking infrastructure
> **Audience:** Staff/Principal engineers, System Design interviews, Architecture reviews

---

# Part 1: Domain Name System (DNS)

## 1.1 What is DNS?

DNS (Domain Name System) is the **phonebook of the internet**. It translates human-readable domain names (e.g., `www.google.com`) into machine-readable IP addresses (e.g., `142.250.190.68`).

Without DNS, you'd have to memorize IP addresses for every website you visit.

### Why DNS Matters for System Design

| Concern | Impact |
|---------|--------|
| **Latency** | DNS lookup adds 20-120ms to the first request. Critical for user-facing apps. |
| **Availability** | DNS is a single point of failure. If DNS fails, your entire service is unreachable. |
| **Load Balancing** | DNS-based load balancing (Round Robin, GeoDNS) is a fundamental traffic distribution strategy. |
| **Failover** | DNS TTL controls how fast you can failover to a backup data center. |
| **Security** | DNS hijacking, spoofing, and DDoS are real attack vectors. |

---

## 1.2 DNS Resolution Flow — The Complete Picture

When you type `www.google.com` in your browser:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          DNS RESOLUTION FLOW                                      │
└─────────────────────────────────────────────────────────────────────────────────┘

   ┌──────────┐                                                                   
   │  Browser │                                                                   
   └────┬─────┘                                                                   
        │ 1. Check browser DNS cache                                              
        │    (Chrome: chrome://net-internals/#dns)                                
        │                                                                         
        ▼                                                                         
   ┌──────────┐                                                                   
   │    OS    │                                                                   
   └────┬─────┘                                                                   
        │ 2. Check OS DNS cache                                                   
        │    (Linux: /etc/hosts, systemd-resolved)                                
        │    (macOS: scutil --dns)                                                
        │    (Windows: ipconfig /displaydns)                                      
        │                                                                         
        ▼                                                                         
   ┌──────────────────┐                                                           
   │  Stub Resolver   │  (Built into OS)                                          
   └────────┬─────────┘                                                           
            │ 3. Forward query to configured DNS server                           
            │    (Usually ISP's resolver or 8.8.8.8 / 1.1.1.1)                    
            │                                                                     
            ▼                                                                     
   ┌────────────────────────────────────────────────────────────────┐             
   │              RECURSIVE RESOLVER (ISP / Google / Cloudflare)    │             
   │                                                                 │             
   │   ┌─────────────────────────────────────────────────────────┐  │             
   │   │  Cache: Has this domain been queried recently?          │  │             
   │   │  If YES → Return cached IP (fast path)                  │  │             
   │   │  If NO  → Start recursive resolution (slow path)        │  │             
   │   └─────────────────────────────────────────────────────────┘  │             
   └────────────────────────┬───────────────────────────────────────┘             
                            │                                                      
         ┌──────────────────┴──────────────────┐                                  
         │  RECURSIVE RESOLUTION (Cache Miss)   │                                  
         └──────────────────┬──────────────────┘                                  
                            │                                                      
    ┌───────────────────────┼───────────────────────┐                             
    │                       │                       │                             
    ▼                       ▼                       ▼                             
┌─────────┐          ┌─────────────┐         ┌─────────────────┐                  
│  ROOT   │          │    TLD      │         │  AUTHORITATIVE  │                  
│ SERVERS │   ──►    │   SERVERS   │  ──►    │     SERVERS     │                  
│         │          │   (.com)    │         │  (google.com)   │                  
└─────────┘          └─────────────┘         └─────────────────┘                  
  13 root              ~1500 TLD                 Owned by                         
  server IPs           servers for               domain owner                     
  (a-m.root)           each TLD                                                   

    Step 4:              Step 5:                  Step 6:                         
    "Who handles         "Who handles             "What's the IP                  
     .com?"              google.com?"              for www.google.com?"           
                                                                                  
    Response:            Response:                Response:                       
    "Ask TLD servers     "Ask ns1.google.com"     "142.250.190.68"               
     at x.gtld.net"                               (with TTL=300s)                
```

### Step-by-Step Breakdown

| Step | Component | Action |
|------|-----------|--------|
| 1 | **Browser Cache** | Check if domain was resolved recently (TTL-based) |
| 2 | **OS Cache** | Check `/etc/hosts` and system DNS cache |
| 3 | **Stub Resolver** | Forward query to recursive resolver (from `/etc/resolv.conf` or DHCP) |
| 4 | **Recursive Resolver Cache** | If cached, return immediately. If not, start recursive lookup. |
| 5 | **Root Servers** | Return IP of TLD servers for `.com` |
| 6 | **TLD Servers** | Return IP of authoritative nameservers for `google.com` |
| 7 | **Authoritative Servers** | Return actual IP address for `www.google.com` |
| 8 | **Cache & Return** | Resolver caches the result (respecting TTL), returns to client |

---

## 1.3 Critical Components of DNS

### 1.3.1 Root Servers

```
┌─────────────────────────────────────────────────────────────────┐
│                      ROOT DNS SERVERS                            │
│                                                                  │
│   13 logical root servers: a.root-servers.net → m.root-servers  │
│                                                                  │
│   Reality: 1000+ physical servers worldwide (via Anycast)        │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  Operator Distribution:                                  │   │
│   │  • Verisign (A, J)        • ICANN (L)                   │   │
│   │  • USC-ISI (B)            • WIDE Project (M)            │   │
│   │  • Cogent (C)             • US DoD (G, H)               │   │
│   │  • U of Maryland (D)      • Netnod (I)                  │   │
│   │  • NASA (E)               • RIPE NCC (K)                │   │
│   │  • ISC (F)                                              │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   KEY POINT: Root servers don't know every domain.              │
│   They only know where to find TLD servers (.com, .org, .io)    │
└─────────────────────────────────────────────────────────────────┘
```

**Why 13 root servers?**
Historical UDP packet size limitation (512 bytes). 13 IPv4 addresses + overhead = 512 bytes max.

**How do they scale?**
**Anycast routing**: The same IP address is announced from multiple physical locations. Your request goes to the nearest one automatically.

### 1.3.2 TLD (Top-Level Domain) Servers

| TLD Type | Examples | Operator |
|----------|----------|----------|
| **Generic (gTLD)** | .com, .net, .org, .io | Verisign, PIR, Afilias |
| **Country Code (ccTLD)** | .uk, .de, .in, .jp | National registries |
| **Sponsored (sTLD)** | .edu, .gov, .mil | Specific organizations |
| **New gTLDs** | .app, .dev, .cloud | Various (ICANN program) |

**Key Point:** TLD servers know authoritative nameservers for all domains under that TLD. Verisign's `.com` servers know the nameservers for all ~160 million `.com` domains.

### 1.3.3 Authoritative Nameservers

These are servers YOU control (or your DNS provider like Route53, Cloudflare, Google Cloud DNS).

```
┌─────────────────────────────────────────────────────────────────┐
│                AUTHORITATIVE NAMESERVER                          │
│                                                                  │
│   Zone File for google.com:                                      │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  $ORIGIN google.com.                                     │   │
│   │  $TTL 300                                                │   │
│   │                                                          │   │
│   │  @       IN  SOA   ns1.google.com. dns-admin.google.com. │   │
│   │  @       IN  NS    ns1.google.com.                       │   │
│   │  @       IN  NS    ns2.google.com.                       │   │
│   │  @       IN  A     142.250.190.46                        │   │
│   │  www     IN  A     142.250.190.68                        │   │
│   │  www     IN  AAAA  2607:f8b0:4004:800::2004              │   │
│   │  mail    IN  MX    10 smtp.google.com.                   │   │
│   │  @       IN  TXT   "v=spf1 include:_spf.google.com ~all" │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   This server is the SOURCE OF TRUTH for google.com              │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3.4 Recursive Resolver

This is the **workhorse** of DNS. It does all the heavy lifting on behalf of clients.

| Provider | IP Addresses | Special Features |
|----------|--------------|------------------|
| **Google Public DNS** | 8.8.8.8, 8.8.4.4 | Global anycast, DNSSEC validation |
| **Cloudflare** | 1.1.1.1, 1.0.0.1 | Privacy-focused, fastest resolver |
| **OpenDNS (Cisco)** | 208.67.222.222 | Content filtering, phishing protection |
| **Quad9** | 9.9.9.9 | Security-focused, blocks malicious domains |
| **ISP Resolver** | Varies | Default; often slower, may log queries |

---

## 1.4 DNS Record Types

| Record | Purpose | Example |
|--------|---------|---------|
| **A** | Maps domain to IPv4 address | `www.example.com → 93.184.216.34` |
| **AAAA** | Maps domain to IPv6 address | `www.example.com → 2606:2800:220:1::` |
| **CNAME** | Alias to another domain | `www.example.com → example.com` |
| **MX** | Mail server for domain | `example.com → mail.example.com (priority 10)` |
| **TXT** | Arbitrary text (SPF, DKIM, verification) | `"v=spf1 include:_spf.google.com ~all"` |
| **NS** | Authoritative nameserver for domain | `example.com → ns1.example.com` |
| **SOA** | Start of Authority (zone metadata) | Primary NS, admin email, serial, refresh |
| **PTR** | Reverse lookup (IP → domain) | `34.216.184.93.in-addr.arpa → example.com` |
| **SRV** | Service location (port + protocol) | `_sip._tcp.example.com → sipserver:5060` |
| **CAA** | Certificate Authority Authorization | `example.com CAA 0 issue "letsencrypt.org"` |

### Critical Record: TTL (Time To Live)

```
┌─────────────────────────────────────────────────────────────────┐
│                          TTL STRATEGY                            │
└─────────────────────────────────────────────────────────────────┘

  HIGH TTL (e.g., 86400 = 24 hours)
  ├── Pros: Reduced DNS queries, lower latency for repeat visitors
  ├── Cons: Slow failover, changes take 24h to propagate
  └── Use for: Stable IPs, static infrastructure

  LOW TTL (e.g., 60 = 1 minute)
  ├── Pros: Fast failover, rapid IP changes
  ├── Cons: More DNS queries, higher resolver load
  └── Use for: Dynamic IPs, active failover, CDN

  PRODUCTION PATTERN:
  ┌──────────────────────────────────────────────────────────┐
  │  Normal operation:     TTL = 300 (5 minutes)             │
  │  Before maintenance:   Lower TTL to 60s, wait 300s       │
  │  During maintenance:   Switch IP, wait 60s               │
  │  After maintenance:    Raise TTL back to 300s            │
  └──────────────────────────────────────────────────────────┘
```

---

## 1.5 DNS Load Balancing Strategies

### Round Robin DNS

```
www.example.com.  300  IN  A  192.168.1.1
www.example.com.  300  IN  A  192.168.1.2
www.example.com.  300  IN  A  192.168.1.3

DNS server rotates the order of responses:
  Query 1: [1.1, 1.2, 1.3]
  Query 2: [1.2, 1.3, 1.1]
  Query 3: [1.3, 1.1, 1.2]
```

| Pros | Cons |
|------|------|
| Simple, no extra infrastructure | No health checks — sends traffic to dead servers |
| Built into DNS | Uneven distribution due to caching |
| | Can't factor in server load or capacity |

### GeoDNS (Latency-Based Routing)

```
┌─────────────────────────────────────────────────────────────────┐
│                         GeoDNS                                   │
│                                                                  │
│   User in Tokyo        →  Resolve to: 13.231.x.x (ap-northeast) │
│   User in London       →  Resolve to: 52.56.x.x (eu-west)       │
│   User in California   →  Resolve to: 13.52.x.x (us-west)       │
│                                                                  │
│   How it works:                                                  │
│   1. DNS resolver sends query with EDNS Client Subnet (ECS)     │
│   2. Authoritative server looks up client's approximate location│
│   3. Returns IP of nearest data center                          │
│                                                                  │
│   Providers: AWS Route53, Cloudflare, NS1, Google Cloud DNS     │
└─────────────────────────────────────────────────────────────────┘
```

### Weighted DNS

```
www.example.com.  A  192.168.1.1  (weight: 70%)
www.example.com.  A  192.168.1.2  (weight: 20%)
www.example.com.  A  192.168.1.3  (weight: 10%)

Use cases:
  • Canary deployments (10% traffic to new version)
  • Blue-green deployments
  • Capacity-proportional routing
```

### Health-Check Based DNS

```
┌─────────────────────────────────────────────────────────────────┐
│                  HEALTH-CHECK DNS (Route53 style)                │
│                                                                  │
│   ┌──────────────┐      Health Check        ┌──────────────┐    │
│   │  DNS Server  │  ──────────────────────► │  Server A    │    │
│   │              │        HTTP 200 ✓        │  (healthy)   │    │
│   │              │                          └──────────────┘    │
│   │              │      Health Check        ┌──────────────┐    │
│   │              │  ──────────────────────► │  Server B    │    │
│   │              │        TIMEOUT ✗         │  (unhealthy) │    │
│   └──────────────┘                          └──────────────┘    │
│                                                                  │
│   DNS response only includes Server A's IP                       │
│   Unhealthy servers are automatically excluded                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1.6 DNS Security

### Attack Vectors

| Attack | Description | Mitigation |
|--------|-------------|------------|
| **DNS Spoofing/Cache Poisoning** | Attacker injects false records into resolver cache | DNSSEC |
| **DNS Hijacking** | Attacker changes DNS settings on router/device | HTTPS, certificate pinning |
| **DDoS on DNS** | Overwhelm authoritative servers | Anycast, rate limiting, multiple providers |
| **DNS Tunneling** | Exfiltrate data via DNS queries | Monitor unusual query patterns |
| **Typosquatting** | Register similar domains (gooogle.com) | Monitor and register variants |

### DNSSEC (DNS Security Extensions)

```
┌─────────────────────────────────────────────────────────────────┐
│                         DNSSEC                                   │
│                                                                  │
│   Problem: DNS responses are unauthenticated.                    │
│            Anyone on the network path can forge responses.       │
│                                                                  │
│   Solution: Cryptographically sign DNS records.                  │
│                                                                  │
│   ┌────────────────────────────────────────────────────────┐    │
│   │  RRSIG record contains:                                 │    │
│   │  • Signature of the record set                          │    │
│   │  • Algorithm, validity period                           │    │
│   │  • Key tag (which key was used)                         │    │
│   │                                                         │    │
│   │  DNSKEY record contains:                                │    │
│   │  • Public key to verify signatures                      │    │
│   │                                                         │    │
│   │  DS record (in parent zone):                            │    │
│   │  • Hash of child's DNSKEY (chain of trust)              │    │
│   └────────────────────────────────────────────────────────┘    │
│                                                                  │
│   Chain of trust: Root → .com → example.com                      │
│   Root's keys are trusted (hardcoded in resolvers)               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1.7 DNS Performance Optimization

| Technique | How | Impact |
|-----------|-----|--------|
| **Prefetch DNS** | `<link rel="dns-prefetch" href="//cdn.example.com">` | Resolve during page load |
| **Reduce DNS lookups** | Fewer third-party domains | Less DNS overhead |
| **Use fast resolvers** | 1.1.1.1, 8.8.8.8 instead of ISP | Lower resolution latency |
| **Anycast DNS** | Geographically distributed authoritative servers | Lower latency to nameservers |
| **Multiple NS records** | Redundant authoritative servers | Higher availability |

---

# Part 2: Role of ISP in Accessing URLs/APIs

## 2.1 What is an ISP?

An **Internet Service Provider (ISP)** is the company that provides your device with internet connectivity. When you hit `www.google.com`, your ISP is the **first network hop** that connects you to the global internet.

```
┌─────────────────────────────────────────────────────────────────┐
│                       ISP TYPES                                  │
└─────────────────────────────────────────────────────────────────┘

  Tier 1 ISPs (Transit-Free)
  ├── Own global backbone networks
  ├── Peer with each other for free (settlement-free peering)
  ├── Examples: AT&T, Verizon, NTT, Lumen (CenturyLink), Telia
  └── Can reach any IP without paying for transit

  Tier 2 ISPs (Regional)
  ├── Regional or national networks
  ├── Peer with some, pay transit to Tier 1 for global reach
  ├── Examples: Comcast, Cox, Charter, regional telcos
  └── Mix of peering and transit

  Tier 3 ISPs (Local / Last-Mile)
  ├── Buy transit from Tier 1/2
  ├── Focus on last-mile delivery to homes/businesses
  ├── Examples: Local cable providers, DSL providers
  └── No peering arrangements
```

---

## 2.2 Complete Request Flow: Browser to Google

Let's trace what happens when you type `www.google.com` and press Enter:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE REQUEST FLOW                                         │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────┐    ┌──────────┐    ┌───────────┐    ┌───────────┐    ┌──────────────┐
│  Your    │    │  Home    │    │   ISP     │    │ Internet  │    │   Google     │
│  Device  │───►│  Router  │───►│  Network  │───►│ Backbone  │───►│   Server     │
└──────────┘    └──────────┘    └───────────┘    └───────────┘    └──────────────┘
     │               │               │                │                  │
     │               │               │                │                  │
     ▼               ▼               ▼                ▼                  ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: DNS RESOLUTION                                                           │
│                                                                                   │
│  Browser → OS → ISP's DNS Resolver → (Root → TLD → Authoritative)                │
│                                                                                   │
│  ISP's Role: Provides default DNS resolver (usually auto-configured via DHCP)    │
│  • ISP resolver is often the first DNS server queried                            │
│  • ISP may cache popular domains aggressively                                    │
│  • ISP can see all your DNS queries (privacy concern)                            │
│  • Some ISPs hijack NXDOMAIN responses for ad revenue                            │
└──────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: TCP CONNECTION (Three-Way Handshake)                                     │
│                                                                                   │
│  Your Device                                              Google Server           │
│       │                                                        │                 │
│       │ ──────────── SYN (seq=x) ──────────────────────────►  │                 │
│       │                                                        │                 │
│       │ ◄───────── SYN-ACK (seq=y, ack=x+1) ─────────────────  │                 │
│       │                                                        │                 │
│       │ ──────────── ACK (ack=y+1) ─────────────────────────►  │                 │
│       │                                                        │                 │
│                                                                                   │
│  ISP's Role:                                                                      │
│  • Routes packets through their network to reach Google                           │
│  • May add latency based on network congestion                                    │
│  • Maintains routing tables (BGP) to find best path                               │
└──────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: TLS HANDSHAKE (HTTPS)                                                    │
│                                                                                   │
│  Client                                                    Server                 │
│     │                                                        │                   │
│     │ ──── ClientHello (supported ciphers, random) ───────► │                   │
│     │                                                        │                   │
│     │ ◄─── ServerHello (chosen cipher, cert, random) ────── │                   │
│     │                                                        │                   │
│     │      [Client verifies certificate chain]               │                   │
│     │                                                        │                   │
│     │ ──── Key Exchange, Finished ────────────────────────► │                   │
│     │                                                        │                   │
│     │ ◄─── Finished ──────────────────────────────────────── │                   │
│     │                                                        │                   │
│     │      [Encrypted connection established]                │                   │
│                                                                                   │
│  ISP's Role:                                                                      │
│  • Cannot decrypt HTTPS traffic (encryption is end-to-end)                        │
│  • CAN see: destination IP, packet sizes, timing, SNI (server name)              │
│  • CANNOT see: URLs, request/response bodies, headers                            │
└──────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: HTTP REQUEST/RESPONSE                                                    │
│                                                                                   │
│  GET / HTTP/1.1                              HTTP/1.1 200 OK                      │
│  Host: www.google.com          ──────►       Content-Type: text/html             │
│  Accept: text/html                           Content-Length: 52134               │
│  ...                                         ...                                 │
│                                              <html>...</html>                    │
│                                                                                   │
│  ISP's Role:                                                                      │
│  • Transfers encrypted packets between you and Google                             │
│  • May throttle bandwidth based on your plan or network policies                  │
│  • May prioritize/deprioritize certain traffic (net neutrality concerns)          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2.3 ISP's Critical Functions

### 2.3.1 Last-Mile Connectivity

```
┌─────────────────────────────────────────────────────────────────┐
│                    LAST-MILE DELIVERY                            │
│                                                                  │
│   "Last mile" = connection from ISP's infrastructure to you     │
│                                                                  │
│   ┌───────────────────────────────────────────────────────┐     │
│   │  Technologies:                                         │     │
│   │                                                        │     │
│   │  Fiber (FTTH)  ─────  1-10 Gbps, lowest latency       │     │
│   │  Cable (DOCSIS) ────  100Mbps-1Gbps, shared bandwidth │     │
│   │  DSL  ──────────────  10-100 Mbps, distance-dependent │     │
│   │  5G Fixed Wireless ─  100Mbps-1Gbps, line-of-sight    │     │
│   │  Satellite (LEO) ───  50-200 Mbps, 20-40ms latency    │     │
│   └───────────────────────────────────────────────────────┘     │
│                                                                  │
│   This connection determines your base latency and bandwidth     │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3.2 Routing (BGP)

ISPs use **Border Gateway Protocol (BGP)** to exchange routing information with other networks.

```
┌─────────────────────────────────────────────────────────────────┐
│                         BGP ROUTING                              │
│                                                                  │
│   Each ISP/network has an ASN (Autonomous System Number)         │
│                                                                  │
│   Example: Google = AS15169, Cloudflare = AS13335                │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                                                          │   │
│   │      Your ISP          Tier 1 ISP          Google        │   │
│   │      AS12345           AS7018             AS15169        │   │
│   │        │                  │                  │           │   │
│   │        │    BGP          │    BGP          │           │   │
│   │        │◄──────────────►│◄──────────────►│           │   │
│   │        │  "I can reach   │  "I can reach   │           │   │
│   │        │   these IPs"    │   these IPs"    │           │   │
│   │                                                          │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   When you request google.com:                                   │
│   1. Your ISP looks up BGP routing table                         │
│   2. Finds shortest AS path to AS15169 (Google)                  │
│   3. Forwards packet to next-hop AS                              │
│   4. Each AS repeats until packet reaches Google                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3.3 Peering and Transit

```
┌─────────────────────────────────────────────────────────────────┐
│                   PEERING vs TRANSIT                             │
└─────────────────────────────────────────────────────────────────┘

  PEERING (Settlement-Free)
  ┌─────────────────────────────────────────────────────────────┐
  │                                                              │
  │     ISP A                                          ISP B     │
  │       │                                              │       │
  │       │◄────────────────────────────────────────────►│       │
  │       │          Direct connection                   │       │
  │       │          No money exchanged                  │       │
  │       │          Only exchange each other's traffic  │       │
  │                                                              │
  │  Happens at: Internet Exchange Points (IXPs)                 │
  │  Examples: DE-CIX (Frankfurt), AMS-IX (Amsterdam), Equinix   │
  │                                                              │
  └─────────────────────────────────────────────────────────────┘

  TRANSIT (Paid)
  ┌─────────────────────────────────────────────────────────────┐
  │                                                              │
  │     Small ISP                                    Tier 1 ISP  │
  │       │                                              │       │
  │       │────────────────── $ ────────────────────────►│       │
  │       │          Pays for access                     │       │
  │       │          Gets access to entire internet      │       │
  │       │          Transit provider handles routing    │       │
  │                                                              │
  │  Small ISPs pay Tier 1 providers for global connectivity    │
  │                                                              │
  └─────────────────────────────────────────────────────────────┘
```

### 2.3.4 NAT (Network Address Translation)

```
┌─────────────────────────────────────────────────────────────────┐
│                        CGNAT                                     │
│           (Carrier-Grade NAT / Large-Scale NAT)                  │
│                                                                  │
│   Problem: IPv4 addresses are exhausted                          │
│   Solution: Multiple customers share a single public IP          │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                                                          │   │
│   │   Customer 1 (192.168.1.10) ──┐                          │   │
│   │   Customer 2 (192.168.2.10) ──┼──► ISP CGNAT ──► 203.x.x.1  │
│   │   Customer 3 (192.168.3.10) ──┘    (shared IP)           │   │
│   │                                                          │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   Implications for system design:                                │
│   • IP-based rate limiting less effective (many users = 1 IP)   │
│   • WebRTC/P2P connections harder to establish                   │
│   • Inbound connections generally not possible                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2.4 What ISP CAN and CANNOT See

| Data Type | ISP Visibility (HTTP) | ISP Visibility (HTTPS) |
|-----------|----------------------|------------------------|
| Destination IP | ✓ Yes | ✓ Yes |
| Domain name (SNI) | ✓ Yes | ✓ Yes (unless ECH) |
| Full URL path | ✓ Yes | ✗ No (encrypted) |
| Request/Response headers | ✓ Yes | ✗ No |
| Request/Response body | ✓ Yes | ✗ No |
| Packet sizes & timing | ✓ Yes | ✓ Yes |
| DNS queries | ✓ Yes (if using ISP DNS) | ✓ Yes (unless DoH/DoT) |

### Privacy Technologies

| Technology | What it hides from ISP |
|------------|----------------------|
| **HTTPS** | Content of requests/responses |
| **DNS over HTTPS (DoH)** | DNS queries (use 1.1.1.1 or 8.8.8.8 DoH) |
| **DNS over TLS (DoT)** | DNS queries |
| **ECH (Encrypted Client Hello)** | Server name (SNI field) |
| **VPN** | Everything except VPN server IP + packet metadata |
| **Tor** | Everything; multi-hop onion routing |

---

## 2.5 ISP Behaviors That Affect System Design

| ISP Behavior | Impact | Mitigation |
|--------------|--------|------------|
| **DNS Hijacking** | NXDOMAIN redirects to ad pages | Use external DNS (1.1.1.1, 8.8.8.8) |
| **Traffic Throttling** | Slower speeds for certain services | Hard to mitigate without VPN |
| **Bandwidth Caps** | Usage limits affect heavy users | Optimize payload sizes, use compression |
| **CGNAT** | IP-based identification unreliable | Use user accounts, API keys |
| **DPI (Deep Packet Inspection)** | ISP can classify traffic types | Already mitigated by HTTPS |
| **Caching Proxies** | ISP may serve stale cached content | Use Cache-Control headers, HTTPS |

---

# Part 3: Content Delivery Network (CDN)

## 3.1 What is a CDN?

A **Content Delivery Network (CDN)** is a globally distributed network of servers that caches and delivers content from locations geographically close to users.

```
┌─────────────────────────────────────────────────────────────────┐
│                    WITHOUT CDN                                   │
│                                                                  │
│   User in Tokyo ─────────────────────────────────► Origin (NYC) │
│                        ~200ms RTT                               │
│                                                                  │
│   User in London ────────────────────────────────► Origin (NYC) │
│                        ~80ms RTT                                │
│                                                                  │
│   User in Sydney ────────────────────────────────► Origin (NYC) │
│                        ~250ms RTT                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     WITH CDN                                     │
│                                                                  │
│   User in Tokyo ──────► Edge (Tokyo)          Origin (NYC)      │
│                   ~10ms     │                      │            │
│                             └──────────────────────┘            │
│                               (cache miss only)                 │
│                                                                  │
│   User in London ─────► Edge (London)         Origin (NYC)      │
│                   ~5ms      │                      │            │
│                             └──────────────────────┘            │
│                                                                  │
│   User in Sydney ─────► Edge (Sydney)         Origin (NYC)      │
│                   ~15ms     │                      │            │
│                             └──────────────────────┘            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3.2 CDN Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          CDN ARCHITECTURE                                        │
└─────────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │   ORIGIN SERVER  │
                              │   (Your Server)  │
                              │                  │
                              │  • Database      │
                              │  • Business logic│
                              │  • Dynamic APIs  │
                              └────────┬─────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
            ┌───────▼───────┐  ┌───────▼───────┐  ┌───────▼───────┐
            │  MID-TIER     │  │  MID-TIER     │  │  MID-TIER     │
            │  (Shield/     │  │  (Regional    │  │  (Regional    │
            │   Regional)   │  │   Cache)      │  │   Cache)      │
            │               │  │               │  │               │
            │  Aggregates   │  │  US-East      │  │  EU-West      │
            │  edge requests│  │               │  │               │
            └───────┬───────┘  └───────┬───────┘  └───────┬───────┘
                    │                  │                  │
     ┌──────────────┼──────────────────┼──────────────────┼──────────────┐
     │              │                  │                  │              │
┌────▼────┐   ┌────▼────┐        ┌────▼────┐        ┌────▼────┐   ┌────▼────┐
│  EDGE   │   │  EDGE   │        │  EDGE   │        │  EDGE   │   │  EDGE   │
│  PoP    │   │  PoP    │        │  PoP    │        │  PoP    │   │  PoP    │
│ (Tokyo) │   │ (Seoul) │        │ (NYC)   │        │(London) │   │ (Paris) │
└────▲────┘   └────▲────┘        └────▲────┘        └────▲────┘   └────▲────┘
     │              │                  │                  │              │
     │              │                  │                  │              │
  Users          Users              Users              Users          Users
  (Japan)       (Korea)            (US East)          (UK)          (France)


  PoP = Point of Presence (Edge location)

  EDGE PoPs:
  • 100s-1000s worldwide
  • Close to users (~10-50km)
  • L1 cache (small, fast, hot content)
  
  MID-TIER/SHIELD:
  • Fewer locations (10s)
  • Aggregates requests from edge
  • L2 cache (larger, warm content)
  • Reduces origin load significantly
```

---

## 3.3 How CDN Request Flow Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    CDN REQUEST FLOW                              │
└─────────────────────────────────────────────────────────────────┘

User requests: https://cdn.example.com/images/logo.png

┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: DNS RESOLUTION                                           │
│                                                                  │
│ cdn.example.com → CNAME → d1234.cloudfront.net                  │
│                        → GeoDNS returns nearest edge IP          │
│                        → 13.35.x.x (Edge in user's region)       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: EDGE CACHE LOOKUP                                        │
│                                                                  │
│ Edge server receives request                                     │
│                                                                  │
│ Cache Key = Hash(URL + Vary headers + query params)              │
│           = Hash("/images/logo.png" + Accept-Encoding:gzip)      │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │  CACHE HIT (fast path)                                       │ │
│ │  • Content found in edge cache                               │ │
│ │  • TTL not expired                                           │ │
│ │  → Return immediately (latency: 5-20ms)                      │ │
│ │  → Response header: X-Cache: Hit from edge                   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │  CACHE MISS (slow path)                                      │ │
│ │  • Content not in edge cache (or expired)                    │ │
│ │  → Forward request to mid-tier or origin                     │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (on cache miss)
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: MID-TIER CACHE (SHIELD) LOOKUP                           │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │  CACHE HIT                                                   │ │
│ │  → Return to edge (latency: 20-50ms)                         │ │
│ │  → Edge caches the response                                  │ │
│ │  → Response header: X-Cache: Hit from shield                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │  CACHE MISS                                                  │ │
│ │  → Forward request to origin                                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (on cache miss)
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: ORIGIN FETCH                                             │
│                                                                  │
│ Origin server processes request                                  │
│ Returns response with caching headers:                           │
│                                                                  │
│   Cache-Control: public, max-age=86400                          │
│   ETag: "abc123"                                                │
│   Last-Modified: Sat, 28 Feb 2026 10:00:00 GMT                  │
│                                                                  │
│ Response flows back:                                             │
│   Origin → Shield (caches) → Edge (caches) → User               │
│                                                                  │
│ Latency: 100-500ms (includes origin processing)                  │
│ Response header: X-Cache: Miss                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3.4 CDN Caching Strategies

### 3.4.1 Cache-Control Headers

```
┌─────────────────────────────────────────────────────────────────┐
│                   CACHE-CONTROL DIRECTIVES                       │
└─────────────────────────────────────────────────────────────────┘

  PUBLIC vs PRIVATE
  ─────────────────
  public    → CDN can cache (shared cache)
  private   → Only browser can cache (user-specific content)

  FRESHNESS
  ─────────
  max-age=3600       → Fresh for 1 hour
  s-maxage=86400     → CDN caches for 24h (overrides max-age for CDN)
  no-cache           → Must revalidate with origin every time
  no-store           → Never cache anywhere

  REVALIDATION
  ────────────
  must-revalidate    → After expiry, MUST check origin before serving stale
  stale-while-revalidate=60  → Serve stale for 60s while fetching fresh
  stale-if-error=300         → Serve stale for 5min if origin is down

  EXAMPLES
  ────────
  Static assets (CSS/JS/images with hash in filename):
    Cache-Control: public, max-age=31536000, immutable
    
  HTML pages (dynamic but cacheable):
    Cache-Control: public, max-age=0, must-revalidate
    (Always revalidate, but can use 304 Not Modified)
    
  API responses (short cache):
    Cache-Control: public, max-age=60, stale-while-revalidate=300
    
  User-specific data:
    Cache-Control: private, no-store
```

### 3.4.2 Cache Key Design

```
┌─────────────────────────────────────────────────────────────────┐
│                      CACHE KEY DESIGN                            │
│                                                                  │
│   Default cache key = URL                                        │
│   But this can cause problems...                                 │
│                                                                  │
│   PROBLEM: Query string variations                               │
│   ────────────────────────────────────────────────────────────  │
│   /image.jpg?v=1      ← Cache miss                              │
│   /image.jpg?v=2      ← Cache miss (different key!)             │
│   /image.jpg?utm=abc  ← Cache miss (analytics param)            │
│                                                                  │
│   SOLUTION: Normalize cache key                                  │
│   • Strip marketing params (utm_*, fbclid, etc.)                │
│   • Sort query params                                            │
│   • Lowercase URL                                                │
│                                                                  │
│   PROBLEM: Vary header explosion                                 │
│   ────────────────────────────────────────────────────────────  │
│   Vary: Accept-Encoding, Accept-Language, User-Agent            │
│   = Thousands of cache variants per URL!                         │
│                                                                  │
│   SOLUTION: Normalize Vary                                       │
│   • Accept-Encoding: normalize to [gzip | br | identity]        │
│   • User-Agent: normalize to [mobile | desktop | tablet]        │
│   • Accept-Language: normalize to [en | es | fr | ...]          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3.5 Common CDN Design Patterns

### 3.5.1 Pattern: Static Asset Caching

```
┌─────────────────────────────────────────────────────────────────┐
│              STATIC ASSET CACHING (Most Common)                  │
│                                                                  │
│   What: CSS, JS, images, fonts, videos                          │
│   Cache duration: Forever (use content-hash in filename)         │
│                                                                  │
│   URL structure:                                                 │
│     /assets/app.a1b2c3d4.js   ← Hash changes when content does  │
│     /assets/logo.e5f6g7h8.png                                   │
│                                                                  │
│   Headers:                                                       │
│     Cache-Control: public, max-age=31536000, immutable          │
│     Content-Encoding: gzip (or br for Brotli)                   │
│                                                                  │
│   Benefits:                                                      │
│   • 99%+ cache hit ratio                                        │
│   • Zero origin load for assets                                 │
│   • Instant cache invalidation (new hash = new URL)             │
└─────────────────────────────────────────────────────────────────┘
```

### 3.5.2 Pattern: HTML Document Caching

```
┌─────────────────────────────────────────────────────────────────┐
│                  HTML DOCUMENT CACHING                           │
│                                                                  │
│   Challenge: HTML changes frequently, needs to be fresh         │
│                                                                  │
│   OPTION 1: No caching (always hit origin)                      │
│   ─────────────────────────────────────────                     │
│   Cache-Control: no-store                                        │
│   Cons: Every request hits origin, high latency                 │
│                                                                  │
│   OPTION 2: Short TTL with revalidation                         │
│   ──────────────────────────────────────                        │
│   Cache-Control: public, max-age=0, must-revalidate             │
│   ETag: "abc123"                                                │
│                                                                  │
│   Flow:                                                          │
│   1. CDN caches HTML with ETag                                  │
│   2. Next request: CDN sends If-None-Match: "abc123"            │
│   3. Origin returns 304 Not Modified (no body)                  │
│   4. CDN serves cached copy                                      │
│                                                                  │
│   Benefit: Saves bandwidth, origin only sends diff              │
│                                                                  │
│   OPTION 3: Stale-while-revalidate                              │
│   ───────────────────────────────                               │
│   Cache-Control: public, max-age=60, stale-while-revalidate=300 │
│                                                                  │
│   Flow:                                                          │
│   1. First 60s: serve from cache                                │
│   2. 60s-360s: serve stale, fetch fresh in background           │
│   3. After 360s: must wait for fresh copy                       │
│                                                                  │
│   Benefit: Always fast (serve stale), eventually fresh          │
└─────────────────────────────────────────────────────────────────┘
```

### 3.5.3 Pattern: API Response Caching

```
┌─────────────────────────────────────────────────────────────────┐
│                    API RESPONSE CACHING                          │
│                                                                  │
│   CACHEABLE APIS:                                                │
│   • GET /products (catalog data)                                │
│   • GET /weather?city=tokyo                                     │
│   • GET /config (feature flags)                                 │
│                                                                  │
│   Cache-Control: public, max-age=60, stale-while-revalidate=300 │
│   Vary: Accept, Accept-Encoding                                 │
│                                                                  │
│   NON-CACHEABLE APIS:                                           │
│   • POST/PUT/DELETE (mutations)                                 │
│   • GET /users/me (user-specific)                               │
│   • GET /cart (session-specific)                                │
│                                                                  │
│   Cache-Control: private, no-store                              │
│                                                                  │
│   PATTERN: Cache key includes auth context                      │
│   ─────────────────────────────────────────                     │
│   For semi-personalized content:                                │
│   Cache key = URL + user_tier (free/pro/enterprise)             │
│   Cache key = URL + country_code                                │
│                                                                  │
│   Avoids N users = N cache entries                              │
│   Instead: N users = K tiers (where K << N)                     │
└─────────────────────────────────────────────────────────────────┘
```

### 3.5.4 Pattern: Edge Computing (Serverless at Edge)

```
┌─────────────────────────────────────────────────────────────────┐
│                    EDGE COMPUTING                                │
│                                                                  │
│   Run code at edge PoPs instead of origin                       │
│                                                                  │
│   Providers:                                                     │
│   • Cloudflare Workers                                          │
│   • AWS Lambda@Edge / CloudFront Functions                      │
│   • Fastly Compute@Edge                                         │
│   • Vercel Edge Functions                                       │
│                                                                  │
│   USE CASES:                                                     │
│                                                                  │
│   1. A/B Testing                                                │
│      Edge function assigns user to variant                      │
│      Returns variant-specific cached content                    │
│                                                                  │
│   2. Geolocation Routing                                        │
│      Detect user country from IP                                │
│      Serve localized content or redirect                        │
│                                                                  │
│   3. Authentication at Edge                                     │
│      Validate JWT at edge                                       │
│      Block unauthorized requests before hitting origin          │
│                                                                  │
│   4. Request/Response Transformation                            │
│      Add security headers                                       │
│      Rewrite URLs                                               │
│      Inject analytics scripts                                   │
│                                                                  │
│   5. Edge-Side Includes (ESI)                                   │
│      Assemble page from cached fragments                        │
│      <esi:include src="/header" />                              │
│      <esi:include src="/user-specific-widget" />                │
│      <esi:include src="/footer" />                              │
└─────────────────────────────────────────────────────────────────┘
```

### 3.5.5 Pattern: Multi-CDN Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    MULTI-CDN STRATEGY                            │
│                                                                  │
│   Why: Redundancy, performance, cost optimization               │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                                                          │   │
│   │            DNS Load Balancer (NS1, Route53)              │   │
│   │                        │                                 │   │
│   │        ┌───────────────┼───────────────┐                 │   │
│   │        │               │               │                 │   │
│   │        ▼               ▼               ▼                 │   │
│   │   ┌─────────┐    ┌─────────┐    ┌─────────┐             │   │
│   │   │Cloudflare│   │  Akamai │   │CloudFront│             │   │
│   │   │  (40%)   │   │  (40%)  │   │  (20%)   │             │   │
│   │   └─────────┘    └─────────┘    └─────────┘             │   │
│   │                                                          │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   Routing strategies:                                            │
│   • Weighted: Split traffic by percentage                       │
│   • Performance: Route to fastest CDN per region                │
│   • Failover: Primary CDN fails → switch to backup              │
│   • Cost: Route based on egress pricing by region               │
│                                                                  │
│   Challenge: Cache consistency across CDNs                       │
│   Solution: Same Cache-Control headers, coordinated purge       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3.6 Cache Invalidation Strategies

```
┌─────────────────────────────────────────────────────────────────┐
│                  CACHE INVALIDATION                              │
│        (One of the two hard problems in computer science)        │
└─────────────────────────────────────────────────────────────────┘

  STRATEGY 1: TTL-Based Expiration
  ─────────────────────────────────
  • Set Cache-Control: max-age=300
  • Content expires automatically after 5 minutes
  • Simple, but stale content served until TTL expires

  STRATEGY 2: Versioned URLs (Best Practice for Assets)
  ────────────────────────────────────────────────────
  • /app.v1.2.3.js → /app.v1.2.4.js
  • /image.abc123.png (content hash)
  • New version = new URL = instant "invalidation"
  • Old URL can remain cached forever (no one requests it)

  STRATEGY 3: Purge API
  ─────────────────────
  • POST /purge { urls: ["/api/products", "/api/products/*"] }
  • CDN invalidates across all edge PoPs
  • Takes 1-30 seconds to propagate globally
  
  Purge types:
  • Single URL purge: /images/logo.png
  • Wildcard purge: /images/*
  • Tag-based purge: All objects tagged "product-123"
  • Full cache purge: Everything (nuclear option)

  STRATEGY 4: Soft Purge (Stale-if-error + Revalidation)
  ─────────────────────────────────────────────────────
  • Mark cached content as stale (not deleted)
  • Next request fetches fresh from origin
  • If origin fails, serve stale version
  • Safer than hard purge

  STRATEGY 5: Surrogate Keys / Cache Tags
  ────────────────────────────────────────
  Origin response:
    Surrogate-Key: product-123 category-electronics

  Purge request:
    PURGE /purge/product-123
    → Invalidates all URLs tagged with "product-123"

  Use case: Product updated → purge all pages showing that product
```

---

## 3.7 CDN Security Features

| Feature | Description |
|---------|-------------|
| **DDoS Protection** | Absorb attack traffic at edge before it hits origin |
| **WAF (Web Application Firewall)** | Block SQL injection, XSS, and known attack patterns |
| **Bot Management** | Identify and block malicious bots while allowing good bots |
| **Rate Limiting** | Limit requests per IP/API key at edge |
| **TLS Termination** | Handle HTTPS at edge, reduce origin TLS overhead |
| **Origin Shield** | Hide origin IP, prevent direct origin attacks |
| **Signed URLs** | Time-limited, cryptographically signed URLs for private content |
| **Token Authentication** | Validate tokens at edge before serving content |

---

## 3.8 CDN Provider Comparison

| Feature | CloudFlare | AWS CloudFront | Akamai | Fastly |
|---------|------------|----------------|--------|--------|
| **Edge PoPs** | 300+ | 600+ | 4000+ | 90+ |
| **Edge Compute** | Workers (V8 isolates) | Lambda@Edge, CloudFront Functions | EdgeWorkers | Compute@Edge (Wasm) |
| **Purge Speed** | <500ms global | 1-2 min | Seconds | <150ms |
| **Pricing Model** | Flat (bandwidth included) | Pay per request + bandwidth | Contract | Pay per request |
| **Best For** | Developer-friendly, security | AWS ecosystem integration | Enterprise, video | Real-time purge, streaming |

---

## 3.9 CDN Performance Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| **Cache Hit Ratio** | Requests served from cache / total requests | > 95% for static, > 70% for APIs |
| **Origin Offload** | % of bytes served from cache | > 90% |
| **TTFB (Time to First Byte)** | Time from request to first byte received | < 100ms at edge |
| **P50/P95/P99 Latency** | Percentile response times | P50 < 50ms, P99 < 200ms |
| **Bandwidth** | Data transferred | Monitor for cost |
| **Error Rate** | 4xx + 5xx responses | < 0.1% |

---

## 3.10 Interview Discussion Points

When discussing DNS, ISP, and CDN in interviews, highlight:

### DNS
1. **Caching hierarchy**: Browser → OS → Recursive Resolver → Authoritative
2. **TTL tradeoffs**: Fast failover vs. reduced DNS load
3. **GeoDNS for global services**: Route users to nearest data center
4. **DNSSEC**: Chain of trust from root to your domain

### ISP
1. **They're not just a pipe**: Routing, peering, caching, DNS all affect your users
2. **CGNAT implications**: IP-based rate limiting is unreliable
3. **ISP visibility**: They can see metadata even with HTTPS
4. **Net neutrality**: Traffic may be throttled differently

### CDN
1. **Cache hit ratio is king**: Every cache miss = origin load + latency
2. **Cache key design**: Normalize to avoid fragmentation
3. **Invalidation strategies**: Versioned URLs >> purge APIs
4. **Edge computing**: Offload auth, A/B testing, personalization
5. **Multi-CDN**: Redundancy for high availability
6. **Stale-while-revalidate**: Best of both worlds (fast + fresh)

---

## Quick Reference: End-to-End Request Flow

```
User types www.google.com
        │
        ▼
[1] BROWSER checks local cache
        │ miss
        ▼
[2] OS checks /etc/hosts, system DNS cache
        │ miss
        ▼
[3] ISP's RECURSIVE RESOLVER
        │ miss
        ▼
[4] ROOT SERVER → "ask .com TLD"
        │
        ▼
[5] .COM TLD SERVER → "ask ns1.google.com"
        │
        ▼
[6] GOOGLE's AUTHORITATIVE NS → "142.250.190.68"
        │
        ▼
[7] Result cached at each level (respecting TTL)
        │
        ▼
[8] TCP connection to 142.250.190.68 (via ISP routing)
        │
        ▼
[9] TLS handshake (encrypted from here)
        │
        ▼
[10] HTTP request flows through CDN edge
        │ cache hit → return immediately
        │ cache miss → fetch from origin
        │
        ▼
[11] Response served to user

Total latency:
  • Cached at CDN edge: 10-50ms
  • CDN cache miss, origin hit: 100-300ms
  • Cold DNS + CDN miss: 200-500ms
```
