# Leader Election in Distributed Systems — System Design

> High-level design for leader election: consensus algorithms, fault tolerance, split-brain prevention, and scalability patterns.

> **Iteration:** v1 — Core Leader Election Design
> **Next:** Multi-datacenter leader election, hierarchical leadership, lease-based optimization

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Requirements](#2-requirements)
3. [Capacity Estimations](#3-capacity-estimations)
4. [Data Model](#4-data-model)
5. [API Design](#5-api-design)
6. [High-Level Architecture](#6-high-level-architecture)
7. [Deep Dive: Leader Election Algorithms](#7-deep-dive-leader-election-algorithms)
8. [Critical Tradeoffs](#8-critical-tradeoffs)
9. [Failure Modes & Recovery](#9-failure-modes--recovery)
10. [Interview Discussion Points](#10-interview-discussion-points)
11. [Extensions for v2](#11-extensions-for-v2)
12. [Real-World Implementations](#12-real-world-implementations)

---

## 1. Problem Statement

Leader election is a fundamental coordination problem in distributed systems where multiple nodes must agree on a single node to act as the **leader** (or primary/master), while the remaining nodes become **followers** (or replicas/secondaries). The elected leader coordinates operations, handles writes, and ensures consistency across the system.

### When do you need leader election?

| Scenario | Example |
|---|---|
| Distributed databases | Primary node handling all writes (PostgreSQL, MongoDB) |
| Message queues | Partition leader managing message ordering (Kafka) |
| Coordination services | Lock management and configuration (ZooKeeper, etcd) |
| Distributed caching | Cache invalidation coordinator (Redis Cluster) |
| Job scheduling | Single scheduler preventing duplicate execution |
| Service discovery | Health check coordinator and registry master |

### The Core Challenge

```
Without leader election:
- Multiple nodes may process the same write → data inconsistency
- No coordination point → conflicting decisions
- Resource contention → deadlocks and race conditions

With leader election:
- Single source of truth for writes
- Coordinated decision-making
- Ordered operations and consistency guarantees
```

---

## 2. Requirements

### 2.1 Functional Requirements

| FR# | Requirement | Description |
|---|---|---|
| **FR1** | Leader Election | System must elect exactly one leader from available nodes |
| **FR2** | Failure Detection | System must detect leader failure within bounded time |
| **FR3** | Automatic Failover | New leader must be elected automatically when current leader fails |
| **FR4** | Leader Discovery | Followers must be able to discover the current leader |
| **FR5** | Leader Validity | Stale leaders must be prevented from acting as leader (fencing) |
| **FR6** | Membership Management | System must handle nodes joining and leaving the cluster |

### 2.2 Non-Functional Requirements

| NFR | Target | Why it matters |
|---|---|---|
| **Safety** | At most one leader at any time | Split-brain causes data corruption and inconsistency |
| **Liveness** | Election completes within 10s | System must make progress; can't be stuck without leader |
| **Failover Time** | < 5 seconds | Minimize downtime when leader fails |
| **Partition Tolerance** | Survive minority partition | System continues operating with majority of nodes |
| **Consistency** | Strong leader identity | All nodes agree on who the leader is |
| **Scalability** | 3-7 nodes typical, up to 100 | Support various cluster sizes |

### 2.3 Out of Scope (v1)

- Multi-datacenter / geo-distributed leader election
- Hierarchical leadership (leader of leaders)
- Byzantine fault tolerance (malicious nodes)
- Dynamic quorum reconfiguration
- Leader election for stateless services

---

## 3. Capacity Estimations

### 3.1 Scale Parameters

| Parameter | Value | Notes |
|---|---|---|
| Cluster size | 3-7 nodes (typical) | Odd numbers prevent ties |
| Heartbeat interval | 150-300ms | Leader sends to followers |
| Election timeout | 500-1500ms | Randomized to prevent split votes |
| Network RTT | < 10ms (same DC) | Within datacenter |
| Node failure rate | 1-2 per month | Hardware/software failures |
| Elections per month | 2-5 | Including planned maintenance |

### 3.2 Message Overhead

```
Heartbeat traffic (steady state):
- Leader sends heartbeat every 150ms
- Cluster size: 5 nodes
- Heartbeat size: ~100 bytes

Messages per second = 1000ms / 150ms × (5-1 followers) = 26 messages/s
Bandwidth = 26 × 100 bytes = 2.6 KB/s (negligible)
```

### 3.3 Election Overhead

```
Election scenario (worst case):
- Election timeout: 1000ms
- Vote request size: ~200 bytes
- Vote response size: ~100 bytes
- Nodes: 5

Messages during election:
- Candidate → All nodes: 4 vote requests
- All nodes → Candidate: 4 vote responses
- Total: 8 messages × ~150 bytes = 1.2 KB

Duration: 1-2 election rounds = 1-3 seconds
```

### 3.4 Infrastructure Summary

| Component | Sizing | Notes |
|---|---|---|
| Cluster Nodes | 3, 5, or 7 | Odd numbers for majority quorum |
| Network | Low-latency, same DC | < 10ms RTT recommended |
| Storage | Persistent log per node | For term/vote persistence |
| Monitoring | Heartbeat + leader metrics | Election frequency, leadership duration |

---

## 4. Data Model

### 4.1 Core Concepts

#### Node State

```
NodeState {
    id:                 UUID          // Unique node identifier
    state:              Enum          // FOLLOWER, CANDIDATE, LEADER
    current_term:       Integer       // Logical clock (monotonically increasing)
    voted_for:          UUID          // Node voted for in current term (null if none)
    leader_id:          UUID          // Current known leader (null during election)
    last_heartbeat:     Timestamp     // Last heartbeat from leader
    cluster_members:    List<UUID>    // Known cluster membership
}
```

#### Term (Epoch)

```
Term {
    term_number:        Integer       // Monotonically increasing logical clock
    leader_id:          UUID          // Leader elected in this term (null if election failed)
    started_at:         Timestamp     // When this term began
    votes_received:     Set<UUID>     // Nodes that voted for leader in this term
}
```

#### Vote Request

```
VoteRequest {
    term:               Integer       // Candidate's term
    candidate_id:       UUID          // Candidate requesting votes
    last_log_index:     Integer       // Index of candidate's last log entry
    last_log_term:      Integer       // Term of candidate's last log entry
}
```

#### Vote Response

```
VoteResponse {
    term:               Integer       // Current term (for candidate to update itself)
    vote_granted:       Boolean       // True if vote was granted
    voter_id:           UUID          // Node that sent this response
}
```

#### Heartbeat (AppendEntries in Raft)

```
Heartbeat {
    term:               Integer       // Leader's term
    leader_id:          UUID          // Leader identifier
    prev_log_index:     Integer       // Index of log entry before new ones
    prev_log_term:      Integer       // Term of prev_log_index entry
    entries:            List<Entry>   // Log entries to replicate (empty for heartbeat)
    leader_commit:      Integer       // Leader's commit index
}
```

### 4.2 State Transitions

```
                    ┌─────────────────────────────────────────────────────┐
                    │                                                       │
                    │  starts as                                            │
                    ▼                                                       │
              ┌──────────┐                                                  │
              │          │                                                  │
              │ FOLLOWER │◀─────────────────────────────────────────────────┤
              │          │         discovers higher term                    │
              └────┬─────┘         or loses election                        │
                   │                                                        │
                   │ election timeout                                       │
                   │ (no heartbeat received)                                │
                   ▼                                                        │
              ┌──────────┐                                                  │
              │          │──────────────────────────────────────────────────┘
              │CANDIDATE │
              │          │
              └────┬─────┘
                   │
                   │ receives majority votes
                   ▼
              ┌──────────┐
              │          │
              │  LEADER  │
              │          │
              └──────────┘
```

---

## 5. API Design

### 5.1 Internal Cluster RPC

| RPC | Sender → Receiver | Description |
|---|---|---|
| `RequestVote` | Candidate → All | Request vote during election |
| `AppendEntries` | Leader → Followers | Heartbeat and log replication |
| `InstallSnapshot` | Leader → Follower | Bulk state transfer for lagging nodes |

### 5.2 RequestVote RPC

```
Request:
{
    "term": 5,
    "candidate_id": "node-A",
    "last_log_index": 100,
    "last_log_term": 4
}

Response:
{
    "term": 5,
    "vote_granted": true
}

Processing Rules:
1. If request term < current term → reject (vote_granted = false)
2. If already voted for another candidate in this term → reject
3. If candidate's log is not at least as up-to-date → reject
4. Otherwise → grant vote, persist voted_for
```

### 5.3 AppendEntries RPC (Heartbeat)

```
Request:
{
    "term": 5,
    "leader_id": "node-A",
    "prev_log_index": 99,
    "prev_log_term": 4,
    "entries": [],           // Empty for pure heartbeat
    "leader_commit": 95
}

Response:
{
    "term": 5,
    "success": true
}

Processing Rules:
1. If request term < current term → reject (success = false)
2. Reset election timeout (leader is alive)
3. If entries present → replicate to local log
4. Update commit index based on leader_commit
```

### 5.4 External API (Leader Discovery)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/cluster/leader` | Get current leader information |
| `GET` | `/api/cluster/status` | Get cluster health and node states |
| `GET` | `/api/cluster/members` | List all cluster members |

```json
GET /api/cluster/leader

Response:
{
    "leader_id": "node-A",
    "leader_address": "10.0.0.1:8080",
    "term": 5,
    "elected_at": "2024-01-15T10:30:00Z",
    "leadership_duration_ms": 3600000
}
```

---

## 6. High-Level Architecture

### 6.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                  Clients                                          │
│                        (Applications, Services, Users)                            │
└─────────────────────────────────────┬───────────────────────────────────────────┘
                                      │
                                      │ Discover Leader
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               Load Balancer                                       │
│                        (Leader-aware routing optional)                            │
└─────────────────────────────────────┬───────────────────────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────────┐
          │                           │                               │
          ▼                           ▼                               ▼
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│     Node A      │         │     Node B      │         │     Node C      │
│    (LEADER)     │         │   (FOLLOWER)    │         │   (FOLLOWER)    │
│                 │         │                 │         │                 │
│ ┌─────────────┐ │         │ ┌─────────────┐ │         │ ┌─────────────┐ │
│ │   Consensus │ │         │ │   Consensus │ │         │ │   Consensus │ │
│ │    Module   │ │         │ │    Module   │ │         │ │    Module   │ │
│ └──────┬──────┘ │         │ └──────┬──────┘ │         │ └──────┬──────┘ │
│        │        │         │        │        │         │        │        │
│ ┌──────▼──────┐ │         │ ┌──────▼──────┐ │         │ ┌──────▼──────┐ │
│ │ State       │ │         │ │ State       │ │         │ │ State       │ │
│ │ Machine     │ │         │ │ Machine     │ │         │ │ Machine     │ │
│ └──────┬──────┘ │         │ └──────┬──────┘ │         │ └──────┬──────┘ │
│        │        │         │        │        │         │        │        │
│ ┌──────▼──────┐ │         │ ┌──────▼──────┐ │         │ ┌──────▼──────┐ │
│ │ Persistent  │ │         │ │ Persistent  │ │         │ │ Persistent  │ │
│ │ Log + Term  │ │         │ │ Log + Term  │ │         │ │ Log + Term  │ │
│ └─────────────┘ │         │ └─────────────┘ │         │ └─────────────┘ │
└────────┬────────┘         └────────┬────────┘         └────────┬────────┘
         │                           │                           │
         │◀─────────────────────────▶│◀─────────────────────────▶│
         │        Heartbeats         │        Heartbeats         │
         │       Vote Requests       │       Vote Requests       │
         │                           │                           │
         └───────────────────────────┴───────────────────────────┘
```

### 6.2 Component Responsibilities

| Component | Responsibility | Notes |
|---|---|---|
| **Consensus Module** | Leader election, vote handling, term management | Core Raft/Paxos implementation |
| **State Machine** | Business logic execution based on committed entries | Deterministic state transitions |
| **Persistent Log** | Durable storage of term, voted_for, log entries | Must survive restarts |
| **RPC Layer** | Node-to-node communication | RequestVote, AppendEntries |
| **Failure Detector** | Monitor heartbeats, trigger elections | Timeout-based detection |

### 6.3 Steady-State Operation (Leader Active)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           Steady-State Flow                                  │
└────────────────────────────────────────────────────────────────────────────┘

1. Leader sends periodic heartbeats (every 150ms)

   LEADER (Node A)
       │
       ├──── Heartbeat ────▶ FOLLOWER (Node B)  ──▶ Reset election timeout
       │                                              Acknowledge
       │
       └──── Heartbeat ────▶ FOLLOWER (Node C)  ──▶ Reset election timeout
                                                      Acknowledge

2. Followers reset their election timers on each heartbeat

3. If follower doesn't receive heartbeat within timeout → starts election

Timeline (normal operation):
┌────────────────────────────────────────────────────────────────────────────┐
│ t=0ms     t=150ms    t=300ms    t=450ms    t=600ms                         │
│   │         │          │          │          │                              │
│   HB────────HB─────────HB─────────HB─────────HB────▶  (heartbeats)         │
│   │         │          │          │          │                              │
│   └─────────┴──────────┴──────────┴──────────┴──────  Followers happy      │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Deep Dive: Leader Election Algorithms

### 7.1 The Election Problem

```
Challenge:
- N nodes, each can fail independently
- Network can delay, lose, or reorder messages
- No global clock or shared memory
- Must agree on exactly ONE leader

Impossibility Result (FLP Theorem):
- In an asynchronous system with even one faulty process,
  no deterministic algorithm can guarantee consensus.

Practical Solution:
- Use timeouts and randomization
- Guarantee safety always, liveness eventually
```

### 7.2 Algorithm Comparison

| Algorithm | Complexity | Understandability | Industry Use |
|---|---|---|---|
| **Raft** | Medium | High (designed for clarity) | etcd, Consul, CockroachDB |
| **Paxos** | High | Low (notoriously complex) | Google Chubby, Spanner |
| **Bully** | Low | High | Simple systems, not partition-tolerant |
| **Ring** | Low | High | Token ring networks |
| **ZAB** | Medium | Medium | ZooKeeper |

### 7.3 Our Choice: Raft Consensus

Raft is chosen for its clarity and proven production reliability.

#### Core Principles

```
1. Leader Completeness: If an entry is committed, it will be present
   in the logs of all future leaders.

2. State Machine Safety: If a server has applied a log entry at index i,
   no other server will ever apply a different entry at index i.

3. Log Matching: If two logs contain an entry with the same index and term,
   the logs are identical up to that index.
```

#### Election Process

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         Raft Election Sequence                               │
└────────────────────────────────────────────────────────────────────────────┘

Initial State: Node A is LEADER, Nodes B and C are FOLLOWERS

Timeline (Leader Failure):

t=0:     Node A (LEADER) crashes
         │
t=300ms: Node B's election timeout fires (randomized: 500-1000ms)
         Node B → CANDIDATE, increments term (term=2)
         │
t=310ms: Node B sends RequestVote to A and C
         │
         Node B ──RequestVote(term=2)──▶ Node A  (no response, dead)
         Node B ──RequestVote(term=2)──▶ Node C  ──▶ Grants vote
         │
t=320ms: Node B receives vote from C
         Node B has 2 votes (self + C) out of 3 = MAJORITY
         │
t=321ms: Node B → LEADER (term=2)
         Node B immediately sends heartbeats
         │
t=330ms: Node C receives heartbeat, confirms B as leader

Total failover time: ~330ms
```

### 7.4 Randomized Election Timeout

```
Why randomization?

Problem: If all followers have the same timeout, they become candidates
simultaneously → split votes → no winner → retry → repeat forever

Solution: Each node picks random timeout in range [T, 2T]
- Example: [500ms, 1000ms]
- High probability that one node times out before others
- That node wins the election before others even start

Tuning Guidelines:
- T > broadcast time (RTT to all nodes)
- T >> heartbeat interval (avoid false elections)
- 2T should be tolerable failover delay

Typical values:
- Heartbeat: 150ms
- Election timeout: 500-1000ms (randomized)
```

### 7.5 Term (Logical Clock)

```
Term is the central concept for consistency:

1. Each term has at most ONE leader
2. Terms are monotonically increasing
3. Any message with stale term is rejected
4. Nodes always adopt higher terms they see

Term acts as a fencing token:
┌────────────────────────────────────────────────────────────────────────────┐
│ Term 1    │ Term 2    │ Term 3    │                                        │
│ Leader: A │ Leader: B │ Leader: C │                                        │
├───────────┼───────────┼───────────┤                                        │
│           │           │           │                                        │
│ Network   │ A thinks  │ C's term  │                                        │
│ partition │ it's still│ (3) higher│                                        │
│ isolates A│ leader    │ → A steps │                                        │
│           │           │   down    │                                        │
└────────────────────────────────────────────────────────────────────────────┘

If node A (stale leader in term 1) tries to act:
- Sends heartbeat with term=1
- Followers are in term 3
- Followers reject (term too low)
- A discovers term 3, steps down to FOLLOWER
```

### 7.6 Split-Brain Prevention

```
Split-brain: Two nodes both believe they are leader simultaneously.

This is CATASTROPHIC for consistency (conflicting writes, data corruption).

Prevention Mechanism: Majority Quorum

┌────────────────────────────────────────────────────────────────────────────┐
│ 5-node cluster with network partition                                       │
│                                                                             │
│    Partition A (2 nodes)      │      Partition B (3 nodes)                 │
│                               │                                             │
│    Node 1 (old leader)        │      Node 3, Node 4, Node 5                │
│    Node 2                     │                                             │
│                               │      Can elect new leader                   │
│    Cannot elect leader        │      (3 = majority of 5)                   │
│    (2 < majority of 5)        │                                             │
│                               │                                             │
│    Old leader steps down      │      Node 3 becomes leader                 │
│    (can't reach majority)     │      (term incremented)                    │
└────────────────────────────────────────────────────────────────────────────┘

Key Insight: Only ONE partition can have majority.
Therefore, only ONE partition can elect a leader.
Therefore, at most ONE leader exists at any time.
```

### 7.7 Quorum Mathematics

```
Cluster Size (N)    Majority Required    Failures Tolerated
     3                    2                    1
     5                    3                    2
     7                    4                    3
     9                    5                    4

Formula:
- Majority = floor(N/2) + 1
- Failures tolerated = N - Majority = floor((N-1)/2)

Why odd numbers?
- Even numbers don't improve fault tolerance
- 4 nodes: need 3 for majority, tolerate 1 failure (same as 3 nodes)
- 5 nodes: need 3 for majority, tolerate 2 failures (better)

Recommendation: Use 3, 5, or 7 nodes (rarely more due to coordination overhead)
```

### 7.8 Leader Lease (Optimization)

```
Problem: Followers must contact leader for reads to ensure consistency.
This adds latency and load on leader.

Solution: Leader Lease

┌────────────────────────────────────────────────────────────────────────────┐
│ Leader holds a time-bound "lease" on leadership                             │
│                                                                             │
│ 1. Leader sends heartbeat with lease_duration (e.g., 10 seconds)           │
│ 2. Leader can serve reads without contacting followers during lease         │
│ 3. Leader must renew lease before expiry (via successful heartbeats)       │
│ 4. If leader can't renew (loses majority), it steps down before serving    │
│                                                                             │
│ Timeline:                                                                   │
│                                                                             │
│ |-------- Lease 1 (10s) --------|-------- Lease 2 (10s) --------|          │
│      ↑                    ↑          ↑                                      │
│   Heartbeat            Heartbeat   Heartbeat (renews lease)                │
│   grants lease                                                              │
└────────────────────────────────────────────────────────────────────────────┘

Safety: Leader MUST track clock skew and step down if lease may have expired
from followers' perspective.
```

### 7.9 Implementation: Election State Machine

```java
class RaftNode {
    enum State { FOLLOWER, CANDIDATE, LEADER }
    
    private State state = State.FOLLOWER;
    private int currentTerm = 0;
    private UUID votedFor = null;
    private UUID leaderId = null;
    private Set<UUID> votesReceived = new HashSet<>();
    
    // Triggered when election timeout expires
    public void startElection() {
        state = State.CANDIDATE;
        currentTerm++;
        votedFor = selfId;
        votesReceived.clear();
        votesReceived.add(selfId);
        
        // Persist term and vote before sending RPCs
        persistState();
        
        // Send RequestVote to all other nodes
        for (UUID nodeId : clusterMembers) {
            if (!nodeId.equals(selfId)) {
                sendRequestVote(nodeId, currentTerm, lastLogIndex, lastLogTerm);
            }
        }
        
        // Reset election timeout (randomized)
        resetElectionTimeout();
    }
    
    public VoteResponse handleRequestVote(VoteRequest request) {
        // Reject if request term is stale
        if (request.term < currentTerm) {
            return new VoteResponse(currentTerm, false);
        }
        
        // Update term if request has higher term
        if (request.term > currentTerm) {
            stepDown(request.term);
        }
        
        // Grant vote if we haven't voted and candidate's log is up-to-date
        boolean canVote = (votedFor == null || votedFor.equals(request.candidateId))
                          && isLogUpToDate(request.lastLogIndex, request.lastLogTerm);
        
        if (canVote) {
            votedFor = request.candidateId;
            persistState();
            resetElectionTimeout();
            return new VoteResponse(currentTerm, true);
        }
        
        return new VoteResponse(currentTerm, false);
    }
    
    public void handleVoteResponse(VoteResponse response) {
        if (state != State.CANDIDATE) return;
        
        if (response.term > currentTerm) {
            stepDown(response.term);
            return;
        }
        
        if (response.voteGranted) {
            votesReceived.add(response.voterId);
            
            // Check if we have majority
            if (votesReceived.size() > clusterMembers.size() / 2) {
                becomeLeader();
            }
        }
    }
    
    private void becomeLeader() {
        state = State.LEADER;
        leaderId = selfId;
        
        // Initialize nextIndex and matchIndex for all followers
        initializeLeaderState();
        
        // Send immediate heartbeat to establish authority
        sendHeartbeats();
    }
    
    private void stepDown(int newTerm) {
        state = State.FOLLOWER;
        currentTerm = newTerm;
        votedFor = null;
        persistState();
    }
}
```

### 7.10 Handling Edge Cases

#### Split Vote

```
Scenario: Two candidates start election simultaneously

Timeline:
t=0:   Node A and Node B both become candidates (term=5)
t=10:  Node A votes for self, sends RequestVote to B, C, D, E
t=12:  Node B votes for self, sends RequestVote to A, C, D, E
t=20:  Node C votes for A (received A's request first)
t=22:  Node D votes for B (received B's request first)
t=25:  Node E receives both, votes for A (first received)

Result:
- Node A: 3 votes (A, C, E) = majority → BECOMES LEADER
- Node B: 2 votes (B, D) = not majority → remains candidate

If exact tie (rare with randomization):
- Election timeout expires
- New election in term 6
- Randomization makes tie unlikely to repeat
```

#### Pre-Vote (Optimization)

```
Problem: Partitioned node keeps incrementing term, causes disruption on rejoin.

┌────────────────────────────────────────────────────────────────────────────┐
│ Without Pre-Vote:                                                           │
│                                                                             │
│ Node X gets partitioned                                                     │
│ X keeps timing out, incrementing term: 5, 6, 7, 8, 9, 10...                │
│ X rejoins with term=10                                                      │
│ Leader (term=5) sees higher term, steps down                               │
│ Unnecessary election disruption!                                            │
└────────────────────────────────────────────────────────────────────────────┘

Solution: Pre-Vote Phase

Before incrementing term and requesting votes:
1. Candidate sends PreVote request (doesn't increment term)
2. Only if PreVote succeeds (majority would vote), proceed with real election
3. Isolated nodes won't get PreVote majority, won't disrupt cluster
```

#### Stale Leader (Zombie Leader)

```
Problem: Network partition heals, old leader tries to act

Protection Mechanisms:

1. Term checking:
   - Old leader's messages have stale term
   - Followers reject, respond with current term
   - Old leader steps down

2. Lease expiration:
   - Old leader's lease expires
   - Must step down before serving requests
   
3. Fencing tokens:
   - Every operation includes term as fencing token
   - Storage layer rejects operations with stale term
```

---

## 8. Critical Tradeoffs

### 8.1 Safety vs Liveness

| Property | Guarantee | Implementation |
|---|---|---|
| **Safety** | At most one leader per term | Always guaranteed by quorum |
| **Liveness** | Eventually elect a leader | May fail during network issues |

```
FLP Impossibility: Can't guarantee both in async systems.

Our choice: Prioritize safety over liveness.
- Never allow split-brain (safety)
- May have temporary unavailability (liveness compromise)
- System will make progress when network stabilizes
```

### 8.2 Consistency vs Availability (CAP)

| Scenario | Our Choice | Tradeoff |
|---|---|---|
| Network partition | Maintain consistency | Minority partition unavailable |
| Leader failure | Wait for election | Brief unavailability (seconds) |
| Slow leader | Tolerate latency | Don't trigger false elections |

**Decision:** CP system. Consistency is paramount; availability is sacrificed during partitions.

### 8.3 Election Timeout Tuning

| Setting | Low Timeout | High Timeout |
|---|---|---|
| Failover speed | Fast | Slow |
| False elections | More frequent | Less frequent |
| Network sensitivity | High (unstable) | Low (stable) |

```
Recommendation:
- Production: 1000-2000ms timeout, 150-300ms heartbeat
- Testing: Can use lower values

Rule of thumb:
- Election timeout > 10 × network RTT
- Election timeout > 3 × heartbeat interval
```

### 8.4 Cluster Size Tradeoffs

| Size | Fault Tolerance | Coordination Overhead | Use Case |
|---|---|---|---|
| **3 nodes** | 1 failure | Lowest | Small deployments, dev/test |
| **5 nodes** | 2 failures | Medium | Production standard |
| **7 nodes** | 3 failures | Higher | Critical systems |

**Decision:** 5 nodes for production (good balance of fault tolerance and overhead).

### 8.5 Heartbeat Frequency

| Frequency | Network Load | Failure Detection |
|---|---|---|
| **50ms** | Higher | Very fast |
| **150ms** | Medium | Fast (Recommended) |
| **500ms** | Lower | Slower |

### 8.6 Synchronous vs Asynchronous Replication

| Approach | Durability | Latency |
|---|---|---|
| **Sync (wait for majority)** | High | Higher |
| **Async (ack after local)** | Lower | Lower |

**Decision:** Synchronous replication to majority for all committed entries.

---

## 9. Failure Modes & Recovery

### 9.1 Failure Scenarios

| Failure | Impact | Detection | Recovery |
|---|---|---|---|
| **Leader crash** | No writes accepted | Heartbeat timeout | New election |
| **Follower crash** | Reduced fault tolerance | Leader heartbeat fails | Node restart, catch up |
| **Network partition** | Cluster split | Heartbeat failures | Partition heals, terms reconcile |
| **Slow leader** | High latency | Application timeouts | May trigger election |
| **Disk failure** | State loss | Node restart fails | Replace node, state transfer |

### 9.2 Leader Failure Recovery

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Leader Failure Timeline                                                     │
└────────────────────────────────────────────────────────────────────────────┘

t=0:      Leader (Node A) crashes
t=150ms:  Followers miss first heartbeat (still within timeout)
t=300ms:  Followers miss second heartbeat
t=500ms:  Node B's election timeout fires (randomized: 500-1000ms)
t=510ms:  Node B → CANDIDATE (term 2), sends RequestVote
t=520ms:  Node C grants vote to B
t=525ms:  Node B has majority (B + C), becomes LEADER
t=530ms:  Node B sends heartbeat, system operational

Total downtime: ~530ms

Optimization: Reduce heartbeat interval for faster detection
Risk: More false positives on network hiccups
```

### 9.3 Network Partition Recovery

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Partition Scenario: 5 nodes split into [A, B] and [C, D, E]                │
└────────────────────────────────────────────────────────────────────────────┘

Before partition:
- Node A is leader (term 1)

During partition:
- Partition [A, B]: A can't reach majority, stops accepting writes
- Partition [C, D, E]: Elects new leader (e.g., C) in term 2

After partition heals:
1. Node A sends heartbeat (term 1) to Node C
2. Node C rejects (term 2 > term 1)
3. Node C responds with term 2
4. Node A discovers higher term, steps down to FOLLOWER
5. Node A recognizes C as leader
6. Node A catches up on missed log entries

Safety preserved: At no point were there two functioning leaders
```

### 9.4 Node Recovery Procedure

```
When a crashed node restarts:

1. Load persistent state:
   - currentTerm
   - votedFor
   - log entries

2. Start as FOLLOWER (regardless of previous state)

3. Wait for leader contact or election timeout

4. If behind on log:
   - Leader sends missing entries via AppendEntries
   - Or InstallSnapshot if too far behind

5. Once caught up, participate normally

Recovery time depends on:
- Log size to replay
- Network bandwidth
- Leader's snapshot availability
```

### 9.5 Monitoring & Alerting

| Metric | Threshold | Action |
|---|---|---|
| Elections per hour | > 5 | Investigate network/timeout config |
| Time since last election | > 24h (normal) | Expected during stable operation |
| Leadership changes | > 3 in 10 min | Alert: unstable cluster |
| Heartbeat latency | > 100ms | Warning: potential timeout issues |
| Log replication lag | > 1000 entries | Warning: follower falling behind |

---

## 10. Interview Discussion Points

When presenting this design, highlight:

1. **"I chose Raft over Paxos because..."** — Raft's clarity makes it easier to implement correctly and debug, while providing the same safety guarantees.

2. **Quorum mathematics** — Explain why majority quorum prevents split-brain and why odd cluster sizes are preferred.

3. **Term as fencing token** — Shows understanding of how stale leaders are prevented from causing damage.

4. **Randomized timeouts** — Demonstrates understanding of how liveness is achieved without perfect synchronization.

5. **Trade-off awareness** — Safety over liveness, consistency over availability during partitions.

6. **Practical considerations** — Heartbeat tuning, pre-vote optimization, lease-based reads.

### Common Follow-up Questions

```
Q: How do you prevent split-brain?
A: Majority quorum ensures only one partition can elect a leader.
   Terms act as fencing tokens to reject stale leaders.

Q: What happens if the leader is slow but not dead?
A: Followers may trigger election. New leader with higher term takes over.
   Old leader discovers higher term and steps down.

Q: How do you handle exactly-once semantics?
A: Client includes unique request ID. Leader deduplicates using ID.
   Committed entries are never re-executed.

Q: Why not use wall-clock time for leader validity?
A: Clock skew between nodes can cause safety violations.
   Logical clocks (terms) are safer in distributed systems.
```

---

## 11. Extensions for v2

| Feature | Key Challenges |
|---|---|
| **Multi-datacenter** | Cross-DC latency affects heartbeats; hierarchical leaders |
| **Dynamic membership** | Joint consensus for adding/removing nodes safely |
| **Witness nodes** | Non-voting members for improved fault tolerance without full replication |
| **Read scaling** | Follower reads with bounded staleness |
| **Prioritized election** | Prefer certain nodes as leader (e.g., faster hardware) |
| **Graceful leadership transfer** | Planned failover without availability impact |

---

## 12. Real-World Implementations

| System | Algorithm | Key Features |
|---|---|---|
| **etcd** | Raft | Kubernetes' coordination backbone |
| **Consul** | Raft | Service mesh coordination |
| **ZooKeeper** | ZAB | Original coordination service |
| **CockroachDB** | Raft | Per-range leader election |
| **TiKV** | Raft | Distributed key-value store |
| **Kafka (KRaft)** | Raft | Replaced ZooKeeper dependency |

---

## References

- [Raft Paper](https://raft.github.io/raft.pdf) — In Search of an Understandable Consensus Algorithm
- [Raft Visualization](https://thesecretlivesofdata.com/raft/) — Interactive Raft explanation
- [etcd Raft Implementation](https://github.com/etcd-io/raft)
- [Designing Data-Intensive Applications](https://dataintensive.net/) — Martin Kleppmann
- [FLP Impossibility Result](https://groups.csail.mit.edu/tds/papers/Lynch/jacm85.pdf)
