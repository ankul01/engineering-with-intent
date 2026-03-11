# File Upload for AI Chat Applications — System Design

> High-level design for file upload: chunked uploads, multimodal processing, security validation, and integration with AI models.

> **Iteration:** v1 — Core File Upload Design
> **Next:** Real-time collaborative uploads, advanced RAG pipelines, multi-region CDN optimization

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Requirements](#2-requirements)
3. [Capacity Estimations](#3-capacity-estimations)
4. [Data Model](#4-data-model)
5. [API Design](#5-api-design)
6. [High-Level Architecture](#6-high-level-architecture)
7. [Deep Dive: Core Problems](#7-deep-dive-core-problems)
8. [Critical Tradeoffs](#8-critical-tradeoffs)
9. [Failure Modes & Recovery](#9-failure-modes--recovery)
10. [Interview Discussion Points](#10-interview-discussion-points)
11. [Extensions for v2](#11-extensions-for-v2)
12. [Real-World Implementations](#12-real-world-implementations)

---

## 1. Problem Statement

File upload in AI chat applications enables users to share documents, images, code files, and other media that the AI can analyze, understand, and reference during conversations. Unlike traditional file storage systems, AI chat file uploads require:

1. **Content extraction** — Converting files into formats AI models can process
2. **Context integration** — Making file content available within conversation context
3. **Real-time processing** — Handling uploads without blocking user interaction
4. **Multimodal support** — Processing diverse file types (text, images, PDFs, code)

### Why is this challenging?

| Challenge | Description |
|---|---|
| Size limits vs. context windows | AI models have token limits; large files need intelligent chunking |
| Processing latency | Users expect immediate feedback, but extraction takes time |
| Security concerns | Files may contain malware, PII, or sensitive data |
| Format diversity | PDFs, images, spreadsheets, code — each needs different processing |
| Cost management | AI API calls are expensive; inefficient processing burns money |
| Stateful conversations | File context must persist across conversation turns |

### The Core Challenge

```
Without proper file upload design:
- Large files timeout or fail silently
- AI can't access file content effectively
- Security vulnerabilities from unvalidated uploads
- Poor UX from synchronous blocking processing
- Context lost when files exceed token limits

With well-designed file upload:
- Seamless handling of large files via chunked upload
- Intelligent content extraction and summarization
- Secure validation pipeline before processing
- Async processing with real-time status updates
- Smart chunking to fit within context windows
```

---

## 2. Requirements

### 2.1 Functional Requirements

| FR# | Requirement | Description |
|---|---|---|
| **FR1** | File Upload | Users can upload files (drag-drop, file picker, paste) |
| **FR2** | Multiple File Types | Support PDFs, images, text files, code, spreadsheets, documents |
| **FR3** | Large File Support | Handle files up to 100MB with resumable uploads |
| **FR4** | Content Extraction | Extract text/data from files for AI consumption |
| **FR5** | Conversation Context | AI can reference uploaded files in responses |
| **FR6** | File Preview | Users can preview uploaded files in the chat |
| **FR7** | Download Original | Users can download the original uploaded file |
| **FR8** | Progress Indication | Real-time upload and processing progress |
| **FR9** | File Deletion | Users can remove files from conversation context |

### 2.2 Non-Functional Requirements

| NFR | Target | Why it matters |
|---|---|---|
| **Upload Speed** | > 5MB/s for users on good connections | User experience; waiting is frustrating |
| **Processing Time** | < 10s for most files, < 60s for large PDFs | Users need quick AI responses |
| **Availability** | 99.9% uptime | Core functionality for AI conversations |
| **Security** | Zero malware reaching AI processing | System integrity and user trust |
| **Scalability** | 10K concurrent uploads | Support growth without degradation |
| **Cost Efficiency** | < $0.01 per file processed | Sustainable at scale |
| **Data Privacy** | No unauthorized data access | Compliance and user trust |

### 2.3 Out of Scope (v1)

- Real-time collaborative file editing
- Video/audio file transcription
- File versioning and history
- Cross-conversation file sharing
- Advanced OCR for handwritten text
- Encrypted file handling (E2E encrypted uploads)

---

## 3. Capacity Estimations

### 3.1 Scale Parameters

| Parameter | Value | Notes |
|---|---|---|
| Daily active users | 1M DAU | Peak hours: 2-3x average |
| Files per user per day | 2-3 files | Power users upload more |
| Average file size | 2MB | Mix of small images and larger docs |
| Max file size | 100MB | Covers most document types |
| Peak concurrent uploads | 10,000 | During business hours |
| File retention | 90 days | Configurable per account tier |

### 3.2 Storage Calculations

```
Daily uploads:
- Users uploading: 1M × 30% = 300K users upload daily
- Files per uploader: 2.5 files average
- Daily files: 300K × 2.5 = 750K files/day

Storage:
- Average size: 2MB per file
- Daily storage: 750K × 2MB = 1.5TB/day
- Monthly storage: 1.5TB × 30 = 45TB/month
- 90-day retention: ~135TB active storage

Extracted content:
- Extraction ratio: ~10% of original size (text extraction)
- Daily extracted: 150GB/day
- 90-day extraction storage: ~13.5TB
```

### 3.3 Bandwidth Calculations

```
Upload bandwidth:
- Peak uploads: 10,000 concurrent
- Average upload size: 2MB
- Upload duration: 2-5 seconds
- Peak bandwidth: 10,000 × 2MB / 3s = 6.67 GB/s = ~54 Gbps

Download bandwidth (previews + originals):
- Download requests: 20% of uploads = 150K/day
- Peak downloads: 2,000 concurrent
- Peak bandwidth: 2,000 × 2MB / 3s = 1.3 GB/s = ~10 Gbps
```

### 3.4 Processing Capacity

```
Processing queue:
- Files to process: 750K/day = 8.7 files/second average
- Peak processing: 50 files/second
- Processing time: 5-30 seconds average
- Workers needed: 50 × 30 / 1 = 1,500 concurrent workers (worst case)
- With auto-scaling: 100-500 workers typical, burst to 1,500

AI API calls:
- Files needing AI processing: 80% = 600K/day
- Tokens per file: ~2,000 tokens average (after chunking)
- Daily tokens: 600K × 2,000 = 1.2B tokens/day
- Cost (at $0.01/1K tokens): $12,000/day = ~$360K/month
```

### 3.5 Infrastructure Summary

| Component | Sizing | Notes |
|---|---|---|
| Object Storage (S3) | 150TB active | Plus glacier for old files |
| CDN | 100 Gbps capacity | For preview delivery |
| Processing Workers | 100-1,500 (auto-scale) | Kubernetes pods |
| Message Queue | 100K messages/minute | SQS/Kafka |
| Metadata DB | 10TB (PostgreSQL) | File metadata, extraction results |
| Vector DB | 50TB (Pinecone/Weaviate) | For RAG embeddings |
| Cache (Redis) | 100GB | Upload sessions, rate limits |

---

## 4. Data Model

### 4.1 Core Entities

#### File Upload

```
FileUpload {
    id:                     UUID            // Primary identifier
    conversation_id:        UUID            // Parent conversation
    user_id:                UUID            // Uploader
    
    // Original file info
    original_filename:      String          // User's filename
    content_type:           String          // MIME type
    size_bytes:             Long            // Original size
    checksum:               String          // SHA-256 hash
    
    // Storage
    storage_key:            String          // S3 key for original
    cdn_url:                String          // CDN URL for previews (nullable)
    thumbnail_key:          String          // Thumbnail S3 key (nullable)
    
    // Processing status
    status:                 Enum            // UPLOADING, PROCESSING, READY, FAILED
    processing_started_at:  Timestamp       // When processing began
    processing_completed_at: Timestamp      // When processing finished
    error_message:          String          // If FAILED, why
    
    // Metadata
    created_at:             Timestamp
    expires_at:             Timestamp       // For retention policy
    deleted_at:             Timestamp       // Soft delete
}
```

#### Chunked Upload Session

```
ChunkedUploadSession {
    id:                     UUID            // Session identifier
    file_upload_id:         UUID            // Target file
    user_id:                UUID            // Owner
    
    // Chunking config
    total_size:             Long            // Expected total bytes
    chunk_size:             Integer         // Size per chunk (e.g., 5MB)
    total_chunks:           Integer         // Total expected chunks
    
    // Progress
    chunks_received:        Set<Integer>    // Chunk numbers received
    bytes_received:         Long            // Total bytes so far
    
    // Session management
    status:                 Enum            // ACTIVE, COMPLETED, EXPIRED, ABORTED
    created_at:             Timestamp
    expires_at:             Timestamp       // Session timeout (24h)
    last_activity:          Timestamp
}
```

#### Extracted Content

```
ExtractedContent {
    id:                     UUID
    file_upload_id:         UUID            // Source file
    
    // Content type
    extraction_type:        Enum            // TEXT, TABLE, IMAGE_DESCRIPTION, CODE
    
    // Extracted data
    content:                Text            // Extracted text/data
    page_number:            Integer         // For paginated docs (nullable)
    section:                String          // Section identifier (nullable)
    
    // Token estimation
    token_count:            Integer         // Estimated tokens
    
    // For images
    image_description:      Text            // AI-generated description
    detected_objects:       JSON            // Object detection results
    
    // Metadata
    extraction_method:      String          // "pdfplumber", "tesseract", "gpt-4-vision"
    confidence_score:       Float           // Extraction confidence
    created_at:             Timestamp
}
```

#### File Chunk (for RAG)

```
FileChunk {
    id:                     UUID
    file_upload_id:         UUID
    extracted_content_id:   UUID
    
    // Chunk info
    chunk_index:            Integer         // Order within file
    content:                Text            // Chunk text
    token_count:            Integer         // Tokens in chunk
    
    // Embedding
    embedding_vector:       Vector[1536]    // OpenAI ada-002 or similar
    embedding_model:        String          // Model used
    
    // Context
    metadata:               JSON            // Page, section, headers for context
    created_at:             Timestamp
}
```

### 4.2 Relationships

```
┌─────────────────┐
│  Conversation   │
└────────┬────────┘
         │ 1:N
         ▼
┌─────────────────┐       1:1        ┌──────────────────────┐
│   FileUpload    │◄────────────────►│ ChunkedUploadSession │
└────────┬────────┘                  └──────────────────────┘
         │ 1:N
         ▼
┌─────────────────┐
│ ExtractedContent│
└────────┬────────┘
         │ 1:N
         ▼
┌─────────────────┐
│   FileChunk     │ ──────► Vector DB (for RAG retrieval)
└─────────────────┘
```

---

## 5. API Design

### 5.1 Upload APIs

#### Initiate Upload (for chunked uploads)

```
POST /api/v1/conversations/{conversation_id}/uploads/initiate

Request:
{
    "filename": "quarterly-report.pdf",
    "content_type": "application/pdf",
    "size_bytes": 52428800,
    "checksum": "sha256:abc123..."
}

Response: 201 Created
{
    "upload_id": "uuid",
    "session_id": "uuid",
    "chunk_size": 5242880,
    "total_chunks": 10,
    "upload_urls": [
        {
            "chunk_number": 0,
            "upload_url": "https://presigned-s3-url...",
            "expires_at": "2024-01-01T00:15:00Z"
        },
        // ... more chunks
    ],
    "expires_at": "2024-01-01T12:00:00Z"
}
```

#### Upload Chunk

```
PUT /api/v1/uploads/{session_id}/chunks/{chunk_number}

Headers:
    Content-Type: application/octet-stream
    Content-Length: 5242880
    X-Chunk-Checksum: sha256:def456...

Body: <binary chunk data>

Response: 200 OK
{
    "chunk_number": 0,
    "received_bytes": 5242880,
    "chunks_completed": 1,
    "chunks_remaining": 9
}
```

#### Complete Upload

```
POST /api/v1/uploads/{session_id}/complete

Request:
{
    "chunk_checksums": [
        {"chunk_number": 0, "checksum": "sha256:..."},
        // ...
    ]
}

Response: 202 Accepted
{
    "upload_id": "uuid",
    "status": "PROCESSING",
    "estimated_completion_seconds": 15,
    "status_url": "/api/v1/uploads/{upload_id}/status"
}
```

#### Simple Upload (for small files < 10MB)

```
POST /api/v1/conversations/{conversation_id}/uploads

Headers:
    Content-Type: multipart/form-data

Body:
    file: <file binary>

Response: 202 Accepted
{
    "upload_id": "uuid",
    "status": "PROCESSING",
    "original_filename": "image.png",
    "size_bytes": 1048576
}
```

### 5.2 Status & Retrieval APIs

#### Get Upload Status

```
GET /api/v1/uploads/{upload_id}/status

Response: 200 OK
{
    "upload_id": "uuid",
    "status": "READY",  // UPLOADING | PROCESSING | READY | FAILED
    "original_filename": "quarterly-report.pdf",
    "content_type": "application/pdf",
    "size_bytes": 52428800,
    "processing_progress": 100,
    "preview_url": "https://cdn.example.com/previews/...",
    "download_url": "https://cdn.example.com/files/...",
    "extracted_summary": "Q3 financial report showing...",
    "page_count": 45,
    "token_count": 28500,
    "created_at": "2024-01-01T10:00:00Z",
    "expires_at": "2024-04-01T10:00:00Z"
}
```

#### Get File Content (for AI context)

```
GET /api/v1/uploads/{upload_id}/content

Query params:
    format: "full" | "summary" | "chunks"
    max_tokens: 4000
    page: 1 (for paginated access)

Response: 200 OK
{
    "upload_id": "uuid",
    "format": "chunks",
    "total_chunks": 12,
    "chunks": [
        {
            "chunk_id": "uuid",
            "content": "...",
            "token_count": 350,
            "metadata": {
                "page": 1,
                "section": "Executive Summary"
            }
        }
    ],
    "has_more": true,
    "next_page": 2
}
```

### 5.3 WebSocket Events (Real-time Updates)

```
// Client subscribes to upload events
ws://api.example.com/ws/uploads/{conversation_id}

// Server pushes events:

// Upload progress
{
    "event": "upload_progress",
    "upload_id": "uuid",
    "chunks_received": 5,
    "chunks_total": 10,
    "bytes_received": 26214400,
    "bytes_total": 52428800
}

// Processing progress
{
    "event": "processing_progress",
    "upload_id": "uuid",
    "stage": "extracting",  // validating | extracting | embedding | complete
    "progress_percent": 65,
    "current_page": 30,
    "total_pages": 45
}

// Processing complete
{
    "event": "processing_complete",
    "upload_id": "uuid",
    "status": "READY",
    "preview_url": "...",
    "summary": "..."
}

// Error
{
    "event": "processing_error",
    "upload_id": "uuid",
    "error_code": "EXTRACTION_FAILED",
    "error_message": "Unable to parse PDF structure"
}
```

---

## 6. High-Level Architecture

### 6.1 System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Web App    │  │  Mobile App │  │   Desktop   │  │    CLI      │        │
│  │  (React)    │  │  (React N.) │  │  (Electron) │  │             │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
└─────────┼────────────────┼────────────────┼────────────────┼────────────────┘
          │                │                │                │
          └────────────────┴────────────────┴────────────────┘
                                    │
                            ┌───────▼───────┐
                            │   CDN / Edge  │
                            │  (CloudFront) │
                            └───────┬───────┘
                                    │
┌───────────────────────────────────┼─────────────────────────────────────────┐
│                              API GATEWAY                                     │
│  ┌────────────────────────────────┼────────────────────────────────────┐    │
│  │              Load Balancer (ALB) + WAF + Rate Limiting               │    │
│  └────────────────────────────────┼────────────────────────────────────┘    │
└───────────────────────────────────┼─────────────────────────────────────────┘
                                    │
┌───────────────────────────────────┼─────────────────────────────────────────┐
│                           APPLICATION LAYER                                  │
│                                   │                                          │
│  ┌────────────────────────────────┼────────────────────────────────────┐    │
│  │                         Upload Service                               │    │
│  │  ┌──────────────┐  ┌───────────────┐  ┌─────────────────┐          │    │
│  │  │ Upload API   │  │ Chunk Manager │  │ Presigned URL   │          │    │
│  │  │ Controller   │  │               │  │ Generator       │          │    │
│  │  └──────────────┘  └───────────────┘  └─────────────────┘          │    │
│  └─────────┬────────────────┬─────────────────────┬────────────────────┘    │
│            │                │                     │                          │
│  ┌─────────▼────────┐ ┌─────▼──────┐  ┌──────────▼───────────┐              │
│  │ Session Store    │ │ File Meta  │  │ WebSocket Service    │              │
│  │ (Redis)          │ │ (Postgres) │  │ (Real-time updates)  │              │
│  └──────────────────┘ └────────────┘  └──────────────────────┘              │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                           ┌────────▼────────┐
                           │  Message Queue  │
                           │  (SQS / Kafka)  │
                           └────────┬────────┘
                                    │
┌───────────────────────────────────┼─────────────────────────────────────────┐
│                          PROCESSING LAYER                                    │
│                                   │                                          │
│  ┌────────────────────────────────┼────────────────────────────────────┐    │
│  │                    Processing Workers (K8s Pods)                     │    │
│  │                                │                                     │    │
│  │  ┌─────────────────────────────┼─────────────────────────────────┐  │    │
│  │  │                     Processing Pipeline                        │  │    │
│  │  │                             │                                  │  │    │
│  │  │  ┌───────────┐  ┌──────────▼─────────┐  ┌──────────────────┐  │  │    │
│  │  │  │ Security  │  │  Content Extractor │  │  AI Processor    │  │  │    │
│  │  │  │ Scanner   │──►  ┌─────────────┐   │──►  ┌────────────┐  │  │  │    │
│  │  │  │           │  │  │ PDF Parser  │   │  │  │ Embeddings │  │  │  │    │
│  │  │  │ • Malware │  │  │ Image OCR   │   │  │  │ Summarizer │  │  │  │    │
│  │  │  │ • MIME    │  │  │ Doc Parser  │   │  │  │ Chunker    │  │  │  │    │
│  │  │  │ • Size    │  │  │ Code Parse  │   │  │  └────────────┘  │  │  │    │
│  │  │  └───────────┘  │  └─────────────┘   │  └──────────────────┘  │  │    │
│  │  │                 └────────────────────┘                        │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                   │                                          │
└───────────────────────────────────┼─────────────────────────────────────────┘
                                    │
┌───────────────────────────────────┼─────────────────────────────────────────┐
│                            STORAGE LAYER                                     │
│                                   │                                          │
│  ┌────────────────┐  ┌───────────▼────────┐  ┌──────────────────┐           │
│  │  Object Store  │  │   Vector Database  │  │  Metadata Store  │           │
│  │  (S3)          │  │  (Pinecone/Weaviate│  │  (PostgreSQL)    │           │
│  │                │  │                    │  │                  │           │
│  │  • Originals   │  │  • Embeddings      │  │  • File metadata │           │
│  │  • Thumbnails  │  │  • Chunk vectors   │  │  • User data     │           │
│  │  • Previews    │  │  • Similarity idx  │  │  • Conversations │           │
│  └────────────────┘  └────────────────────┘  └──────────────────┘           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Upload Flow (Chunked)

```
┌────────┐          ┌────────┐         ┌─────────┐        ┌────┐        ┌─────────┐
│ Client │          │ Upload │         │  Redis  │        │ S3 │        │  Queue  │
│        │          │ Service│         │         │        │    │        │         │
└───┬────┘          └───┬────┘         └────┬────┘        └─┬──┘        └────┬────┘
    │                   │                   │               │                │
    │ 1. Initiate       │                   │               │                │
    │ ─────────────────►│                   │               │                │
    │                   │ 2. Create session │               │                │
    │                   │ ─────────────────►│               │                │
    │                   │                   │               │                │
    │                   │ 3. Generate presigned URLs        │                │
    │                   │ ─────────────────────────────────►│                │
    │                   │                   │               │                │
    │ 4. Return URLs    │                   │               │                │
    │ ◄─────────────────│                   │               │                │
    │                   │                   │               │                │
    │ 5. Upload chunk directly to S3        │               │                │
    │ ─────────────────────────────────────────────────────►│                │
    │                   │                   │               │                │
    │ 6. Notify chunk complete              │               │                │
    │ ─────────────────►│                   │               │                │
    │                   │ 7. Update session │               │                │
    │                   │ ─────────────────►│               │                │
    │                   │                   │               │                │
    │ (repeat 5-7 for all chunks)           │               │                │
    │                   │                   │               │                │
    │ 8. Complete upload│                   │               │                │
    │ ─────────────────►│                   │               │                │
    │                   │ 9. Verify all chunks              │                │
    │                   │ ─────────────────────────────────►│                │
    │                   │                   │               │                │
    │                   │ 10. Assemble multipart            │                │
    │                   │ ─────────────────────────────────►│                │
    │                   │                   │               │                │
    │                   │ 11. Queue for processing          │                │
    │                   │ ─────────────────────────────────────────────────►│
    │                   │                   │               │                │
    │ 12. Accepted      │                   │               │                │
    │ ◄─────────────────│                   │               │                │
    │                   │                   │               │                │
```

### 6.3 Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          File Processing Pipeline                            │
│                                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌───────┐ │
│  │ Validate │───►│ Sanitize │───►│ Extract  │───►│  Chunk   │───►│ Embed │ │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘    └───────┘ │
│       │               │               │               │              │      │
│       ▼               ▼               ▼               ▼              ▼      │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌───────┐ │
│  │ MIME     │    │ Strip    │    │ PDF/Doc/ │    │ Semantic │    │OpenAI │ │
│  │ Check    │    │ Metadata │    │ Image    │    │ Chunking │    │ ada   │ │
│  │ Size     │    │ Resize   │    │ Code     │    │ ~512 tok │    │       │ │
│  │ Malware  │    │ Convert  │    │ Parser   │    │ overlap  │    │       │ │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘    └───────┘ │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        Processing Results                             │   │
│  │  • Original stored in S3                                             │   │
│  │  • Thumbnail/preview generated                                       │   │
│  │  • Extracted text stored in PostgreSQL                              │   │
│  │  • Chunks with embeddings stored in Vector DB                       │   │
│  │  • Summary generated for quick AI context                           │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Deep Dive: Core Problems

### 7.1 Problem: Large File Uploads

Uploading large files (>10MB) over HTTP is unreliable due to network interruptions, timeouts, and browser limitations.

#### Challenge Analysis

| Issue | Impact |
|---|---|
| Connection drops | Upload fails, user must restart |
| Browser memory | Large files consume client memory |
| Server timeout | Long uploads exceed request limits |
| Progress visibility | Users don't know if upload is working |
| Bandwidth waste | Failed uploads waste already-transmitted data |

#### Solution: Chunked Resumable Uploads

```
┌─────────────────────────────────────────────────────────────────┐
│                    Chunked Upload Strategy                       │
│                                                                  │
│  Original File: 50MB                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │█████████████████████████████████████████████████████████│    │
│  └─────────────────────────────────────────────────────────┘    │
│                            ▼                                     │
│  Chunked (5MB each):                                            │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ... ┌─────┐   │
│  │  1  │ │  2  │ │  3  │ │  4  │ │  5  │ │  6  │     │ 10  │   │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘     └─────┘   │
│     ✓       ✓       ✓       ✗       -       -           -       │
│                            │                                     │
│              Network failure at chunk 4                         │
│                            ▼                                     │
│  Resume: Only re-upload from chunk 4                            │
│                     ┌─────┐ ┌─────┐ ┌─────┐     ┌─────┐         │
│                     │  4  │ │  5  │ │  6  │ ... │ 10  │         │
│                     └─────┘ └─────┘ └─────┘     └─────┘         │
└─────────────────────────────────────────────────────────────────┘
```

#### Implementation Components

**Client-side chunking:**
```javascript
// Pseudocode for client-side chunking
async function uploadFile(file, sessionInfo) {
    const chunkSize = sessionInfo.chunk_size;
    const totalChunks = Math.ceil(file.size / chunkSize);
    
    // Track progress locally (for resume)
    const completedChunks = loadCompletedChunks(sessionInfo.session_id);
    
    for (let i = 0; i < totalChunks; i++) {
        if (completedChunks.has(i)) continue; // Skip completed
        
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        
        // Upload with retry
        await uploadChunkWithRetry(chunk, i, sessionInfo);
        
        // Save progress
        saveChunkProgress(sessionInfo.session_id, i);
        
        // Report progress
        onProgress((i + 1) / totalChunks * 100);
    }
    
    // Complete the upload
    await completeUpload(sessionInfo.session_id);
}
```

**Server-side assembly:**
```java
// Pseudocode for server-side chunk assembly
public void completeMultipartUpload(String sessionId, List<ChunkChecksum> checksums) {
    ChunkedUploadSession session = sessionStore.get(sessionId);
    
    // Verify all chunks received
    if (session.getChunksReceived().size() != session.getTotalChunks()) {
        throw new IncompleteUploadException("Missing chunks");
    }
    
    // Verify checksums
    for (ChunkChecksum cs : checksums) {
        String storedChecksum = s3Client.getObjectChecksum(
            getChunkKey(sessionId, cs.getChunkNumber())
        );
        if (!storedChecksum.equals(cs.getChecksum())) {
            throw new ChecksumMismatchException(cs.getChunkNumber());
        }
    }
    
    // Assemble in S3 (server-side, no download needed)
    s3Client.completeMultipartUpload(
        session.getMultipartUploadId(),
        session.getCompletedParts()
    );
    
    // Queue for processing
    messageQueue.send(new ProcessFileMessage(session.getFileUploadId()));
}
```

---

### 7.2 Problem: Content Extraction at Scale

Different file types require different extraction strategies. Extraction must be fast, accurate, and cost-efficient.

#### File Type Processing Matrix

| File Type | Extraction Method | Processing Time | Complexity |
|---|---|---|---|
| Plain text (.txt, .md) | Direct read | < 1s | Low |
| Code files (.py, .java) | Syntax-aware parsing | 1-2s | Medium |
| PDF (text-based) | pdfplumber / PyMuPDF | 2-10s | Medium |
| PDF (scanned/image) | OCR (Tesseract/Cloud Vision) | 10-60s | High |
| Images | GPT-4 Vision / BLIP-2 | 2-5s | Medium |
| Word docs (.docx) | python-docx | 2-5s | Medium |
| Spreadsheets (.xlsx) | openpyxl with structure detection | 5-15s | High |
| Presentations (.pptx) | python-pptx + image extraction | 10-30s | High |

#### Extraction Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Extraction Router                                 │
│                                                                          │
│  Input: File + MIME type                                                │
│         │                                                                │
│         ▼                                                                │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Route by MIME Type                             │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│         │                                                                │
│         ├──────────┬──────────┬──────────┬──────────┬──────────┐        │
│         ▼          ▼          ▼          ▼          ▼          ▼        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │   Text   │ │   Code   │ │   PDF    │ │  Image   │ │ Office   │      │
│  │ Extractor│ │ Extractor│ │ Extractor│ │ Extractor│ │ Extractor│      │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘      │
│       │            │            │            │            │             │
│       ▼            ▼            │            ▼            ▼             │
│  ┌──────────┐ ┌──────────┐     │       ┌──────────┐ ┌──────────┐       │
│  │ Preserve │ │ AST +    │     │       │ Vision   │ │ Structure │       │
│  │ Structure│ │ Comments │     │       │ Analysis │ │ Detection │       │
│  └──────────┘ └──────────┘     │       └──────────┘ └──────────┘       │
│                                │                                        │
│                    ┌───────────┴───────────┐                           │
│                    ▼                       ▼                            │
│              ┌──────────┐           ┌──────────┐                       │
│              │Text-based│           │  Scanned │                       │
│              │   PDF    │           │   PDF    │                       │
│              └────┬─────┘           └────┬─────┘                       │
│                   ▼                      ▼                              │
│              ┌──────────┐           ┌──────────┐                       │
│              │pdfplumber│           │   OCR    │                       │
│              │ PyMuPDF  │           │ Pipeline │                       │
│              └──────────┘           └──────────┘                       │
│                                                                         │
│  All paths converge to:                                                │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              Unified Content Output                               │  │
│  │  {                                                                │  │
│  │    "text": "...",                                                │  │
│  │    "structure": { "pages": [...], "sections": [...] },          │  │
│  │    "tables": [...],                                              │  │
│  │    "images": [{ "description": "..." }],                        │  │
│  │    "code_blocks": [...]                                          │  │
│  │  }                                                                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

#### OCR Decision Tree (PDF Processing)

```
PDF Received
     │
     ▼
┌─────────────────┐
│ Extract text    │
│ with pdfplumber │
└────────┬────────┘
         │
         ▼
    ┌────────────┐    Yes   ┌───────────────────┐
    │ Text found │─────────►│ Use extracted text│
    │  > 100 chars│          │ (fast path)       │
    └────────────┘          └───────────────────┘
         │ No
         ▼
┌─────────────────┐
│ Check if scanned│
│ (image-based)   │
└────────┬────────┘
         │
         ▼
    ┌────────────┐    No    ┌───────────────────┐
    │ Has images │─────────►│ Mark as empty/    │
    │ per page?  │          │ unextractable     │
    └────────────┘          └───────────────────┘
         │ Yes
         ▼
┌─────────────────┐
│ Quality check:  │
│ DPI > 150?      │
└────────┬────────┘
         │
    ┌────┴────┐
   Yes       No
    │         │
    ▼         ▼
┌───────┐ ┌──────────┐
│  OCR  │ │ Upscale  │
│Direct │ │ then OCR │
└───────┘ └──────────┘
```

---

### 7.3 Problem: Fitting Files into AI Context Windows

AI models have token limits (e.g., 128K for GPT-4, 200K for Claude). Large documents exceed these limits.

#### Context Window Challenge

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Context Window Problem                              │
│                                                                          │
│  Document: 500-page PDF = ~300,000 tokens                               │
│  Model context window: 128,000 tokens                                   │
│  Conversation history: 20,000 tokens                                    │
│  Available for document: 108,000 tokens                                 │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │████████████████████████████████████████████████████████████████ │    │
│  │             Document: 300,000 tokens                           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌──────────────────────────────────────┐                               │
│  │████████████████████████████████████ │ Context Window: 128K tokens   │
│  └──────────────────────────────────────┘                               │
│                                                                          │
│  Problem: Document is 2.8x larger than available context!               │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Solution Strategy: Hierarchical Retrieval

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Hierarchical Content Strategy                         │
│                                                                          │
│  TIER 1: Summary (Always in context)                                    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Document summary: 500-1000 tokens                               │    │
│  │ "This is a quarterly financial report for Q3 2024 containing   │    │
│  │  revenue data, expense breakdowns, and future projections..."  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                               │                                          │
│                               ▼                                          │
│  TIER 2: Section Index (On-demand retrieval)                            │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Section 1: Executive Summary (pages 1-3, 2000 tokens)           │    │
│  │ Section 2: Revenue Analysis (pages 4-15, 8000 tokens)           │    │
│  │ Section 3: Expense Breakdown (pages 16-25, 6000 tokens)         │    │
│  │ ...                                                              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                               │                                          │
│                               ▼                                          │
│  TIER 3: Semantic Chunks (RAG retrieval)                                │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ 600 chunks × ~500 tokens each                                   │    │
│  │ Each chunk has embedding vector for semantic search             │    │
│  │ Retrieved based on user query similarity                        │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  RUNTIME: Query "What was Q3 revenue?"                                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Context assembled:                                               │    │
│  │ - Document summary (1000 tokens)                                │    │
│  │ - Retrieved chunks about revenue (3000 tokens)                  │    │
│  │ - Conversation history (5000 tokens)                            │    │
│  │ Total: ~9000 tokens (fits easily in context)                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Chunking Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Semantic Chunking Algorithm                         │
│                                                                          │
│  Input: Extracted document text                                         │
│                                                                          │
│  Step 1: Identify natural boundaries                                    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ • Paragraph breaks                                               │    │
│  │ • Section headers (H1, H2, H3)                                  │    │
│  │ • Page breaks                                                    │    │
│  │ • Sentence boundaries (fallback)                                │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  Step 2: Create chunks with overlap                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Target chunk size: 512 tokens                                  │    │
│  │  Overlap: 50 tokens (context continuity)                        │    │
│  │                                                                  │    │
│  │  ┌─────────────────────────────────────────┐                    │    │
│  │  │          Chunk 1 (512 tokens)          │                    │    │
│  │  └─────────────────────────────────────────┤                    │    │
│  │                              ┌─────────────┴─────────────────────┐│   │
│  │                              │    Chunk 2 (512 tokens)          ││   │
│  │                              └───────────────────────────────────┤│   │
│  │                                            ┌─────────────────────┴┐   │
│  │                                            │  Chunk 3 (512 tok)  │   │
│  │                                            └─────────────────────┘   │
│  │         ◄───── 50 token overlap ────►                           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  Step 3: Preserve metadata                                              │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Each chunk includes:                                             │    │
│  │ • Source page number                                            │    │
│  │ • Section header                                                 │    │
│  │ • Table context (if from table)                                 │    │
│  │ • Previous/next chunk IDs (for context expansion)               │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 7.4 Problem: Security & Validation

Files from users can contain malware, exceed quotas, or violate content policies.

#### Security Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Security Pipeline                                │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ LAYER 1: Client-side Validation (Defense in depth, not trusted)  │  │
│  │ • File extension check                                            │  │
│  │ • Size limit check                                                │  │
│  │ • Basic MIME type detection                                       │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                               │                                          │
│                               ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ LAYER 2: Upload Gateway Validation                                │  │
│  │ • Size enforcement (hard limit)                                   │  │
│  │ • Rate limiting per user/IP                                       │  │
│  │ • Content-Type header validation                                  │  │
│  │ • Request signature verification                                  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                               │                                          │
│                               ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ LAYER 3: Deep Content Validation (Processing Workers)            │  │
│  │                                                                    │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │  │
│  │  │ Magic Byte  │  │  Malware    │  │  Content Policy Check   │   │  │
│  │  │ Verification│  │  Scanning   │  │  (NSFW, PII detection)  │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘   │  │
│  │                                                                    │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │  │
│  │  │ Archive     │  │  Image      │  │  Document Structure     │   │  │
│  │  │ Bomb Check  │  │  Validation │  │  Validation (PDF/DOCX)  │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                               │                                          │
│                     ┌─────────┴─────────┐                               │
│                     ▼                   ▼                                │
│              ┌───────────┐       ┌───────────┐                          │
│              │  PASSED   │       │  REJECTED │                          │
│              │ Continue  │       │ Quarantine│                          │
│              │ Processing│       │ & Alert   │                          │
│              └───────────┘       └───────────┘                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Validation Rules

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Validation Rules Matrix                            │
│                                                                          │
│  File Type Whitelist (allow list approach):                             │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Category      │ Extensions               │ Max Size │ Notes       │  │
│  │───────────────┼──────────────────────────┼──────────┼─────────────│  │
│  │ Documents     │ .pdf, .docx, .doc, .txt │ 50MB     │ OCR enabled │  │
│  │ Spreadsheets  │ .xlsx, .xls, .csv       │ 25MB     │ 1M cell max │  │
│  │ Presentations │ .pptx, .ppt             │ 100MB    │             │  │
│  │ Images        │ .png, .jpg, .gif, .webp │ 20MB     │ 4096px max  │  │
│  │ Code          │ .py, .js, .java, .go... │ 5MB      │ 100K lines  │  │
│  │ Markdown      │ .md, .mdx               │ 2MB      │             │  │
│  │ Archives      │ BLOCKED                  │ -        │ Security    │  │
│  │ Executables   │ BLOCKED                  │ -        │ Security    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  Rate Limits:                                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Limit Type           │ Free Tier    │ Pro Tier     │ Enterprise  │  │
│  │──────────────────────┼──────────────┼──────────────┼─────────────│  │
│  │ Files per hour       │ 10           │ 100          │ 1000        │  │
│  │ Total storage        │ 100MB        │ 5GB          │ 100GB       │  │
│  │ Max file size        │ 10MB         │ 50MB         │ 100MB       │  │
│  │ Concurrent uploads   │ 2            │ 10           │ 50          │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Critical Tradeoffs

### 8.1 Storage Strategy

| Option | Pros | Cons | When to Use |
|---|---|---|---|
| **S3 Standard** | High durability, scalable | Cost at scale | Primary storage for active files |
| **S3 Intelligent-Tiering** | Auto cost optimization | Monitoring fees | Unknown access patterns |
| **S3 Glacier** | Very cheap | Retrieval latency | Archival (>90 days) |
| **Local/EBS** | Low latency | Limited scale, single point of failure | Processing cache only |

**Recommendation:** S3 Standard for active files, Glacier for archived files with lifecycle policies.

---

### 8.2 Sync vs. Async Processing

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Sync vs Async Processing                              │
│                                                                          │
│  SYNCHRONOUS (Small files < 5MB)                                        │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ User uploads ──► Process immediately ──► Return result          │    │
│  │                                                                  │    │
│  │ Pros:                                                           │    │
│  │ • Simple implementation                                         │    │
│  │ • Immediate feedback                                            │    │
│  │ • No state management                                           │    │
│  │                                                                  │    │
│  │ Cons:                                                           │    │
│  │ • Blocks user if processing is slow                            │    │
│  │ • Timeout risk for larger files                                │    │
│  │ • Resource contention under load                               │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ASYNCHRONOUS (Large files > 5MB)                                       │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ User uploads ──► Queue job ──► Return immediately               │    │
│  │                      │                                           │    │
│  │                      ▼                                           │    │
│  │               Worker processes ──► Notify via WebSocket         │    │
│  │                                                                  │    │
│  │ Pros:                                                           │    │
│  │ • Non-blocking UX                                               │    │
│  │ • Handles large files gracefully                                │    │
│  │ • Scalable processing                                           │    │
│  │                                                                  │    │
│  │ Cons:                                                           │    │
│  │ • Complex state management                                      │    │
│  │ • Requires notification mechanism                               │    │
│  │ • Eventual consistency                                          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  RECOMMENDATION: Hybrid approach                                        │
│  • Files < 5MB: Sync processing, immediate response                    │
│  • Files > 5MB: Async with WebSocket status updates                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 8.3 Direct S3 Upload vs. Server Proxy

| Approach | Pros | Cons | Best For |
|---|---|---|---|
| **Direct to S3 (Presigned URLs)** | No server bandwidth consumed, faster for large files | Requires client-side complexity, CORS setup | Large files, high volume |
| **Server Proxy** | Simple client, centralized validation | Server becomes bottleneck, doubles bandwidth | Small files, low volume |
| **Hybrid** | Best of both | More complex architecture | Production systems |

```
Direct S3 Upload Flow:
┌────────┐      1. Get presigned URL      ┌─────────┐
│ Client │ ─────────────────────────────► │  Server │
│        │ ◄───────────────────────────── │         │
└───┬────┘      2. Return URL              └─────────┘
    │
    │  3. Upload directly to S3
    │
    ▼
┌────────┐
│   S3   │
└────────┘
    │
    │  4. S3 Event Notification
    ▼
┌─────────┐
│ Lambda  │ ──► Processing Queue
└─────────┘

Benefits:
- Server handles 0 bytes of file data
- Parallel uploads to S3
- S3 handles retries and multipart
```

**Recommendation:** Direct S3 upload with presigned URLs for files > 1MB.

---

### 8.4 RAG vs. Full Context

| Approach | Pros | Cons | Best For |
|---|---|---|---|
| **Full Context** | Complete document understanding, no retrieval errors | Token limit constraints, expensive | Small documents (<50K tokens) |
| **RAG (Retrieval)** | Handles any document size, cost-efficient | May miss relevant context, retrieval quality varies | Large documents, knowledge bases |
| **Hybrid** | Best accuracy for important sections + scale for large docs | Complexity | Production systems |

```
Decision Matrix:
┌──────────────────────────────────────────────────────────────────────┐
│                                                                       │
│  Document Size        Strategy                                       │
│  ────────────────────────────────────────────────────────────────    │
│  < 10K tokens         Full context (include entire document)         │
│  10K-50K tokens       Summary + relevant sections                    │
│  > 50K tokens         Summary + RAG retrieval                        │
│                                                                       │
│  Query Type           Context Strategy                               │
│  ────────────────────────────────────────────────────────────────    │
│  Specific question    RAG retrieval (precise chunks)                 │
│  Summary request      Document summary + section summaries           │
│  Analysis task        Full relevant sections                         │
│  Comparison           Multiple chunk retrieval                       │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

### 8.5 Preprocessing Depth vs. Latency

| Level | Processing | Latency | Storage | Use Case |
|---|---|---|---|---|
| **Minimal** | Store only, extract on-demand | ~1s upload | Low | Infrequent access |
| **Standard** | Extract text, basic chunking | 5-15s | Medium | Most documents |
| **Deep** | Extract + embed + summarize | 30-60s | High | Frequently queried docs |
| **Premium** | All above + multiple model analysis | 2-5min | Very high | Critical documents |

**Recommendation:** Standard processing by default, with option to trigger deep processing for important documents.

---

## 9. Failure Modes & Recovery

### 9.1 Upload Failures

| Failure | Detection | Recovery | Prevention |
|---|---|---|---|
| Network interruption | Client detects disconnect | Resume from last chunk | Chunked uploads with session persistence |
| Server timeout | 504 Gateway Timeout | Retry with exponential backoff | Async processing, proper timeouts |
| Storage failure | S3 returns 5xx | Retry to different region | Multi-region replication |
| Quota exceeded | 413 Payload Too Large | Inform user, suggest compression | Pre-flight quota check |

### 9.2 Processing Failures

| Failure | Detection | Recovery | Prevention |
|---|---|---|---|
| Extraction timeout | Worker timeout | Retry with simpler extraction | Timeout per file type, fallback extractors |
| OCR failure | Tesseract error | Try cloud OCR, then mark as image-only | Multiple OCR providers |
| Malformed file | Parser exception | Mark as unprocessable, store original | Validate before processing |
| AI API failure | API returns 5xx | Retry with backoff, use cached embeddings | Multiple API providers, local fallback |

### 9.3 System Failures

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Failure Recovery Matrix                            │
│                                                                          │
│  Component Failure       Impact                Recovery Time            │
│  ───────────────────────────────────────────────────────────────────    │
│  Upload Service          New uploads fail      Auto-heal: 30s-2min      │
│  Processing Workers      Queue builds up       Scale up: 1-5min         │
│  Message Queue           Processing stops      Failover: 30s            │
│  S3                      Uploads/downloads     Region failover: 1-5min  │
│  PostgreSQL              Metadata unavailable  Replica promotion: 30s   │
│  Vector DB               RAG retrieval fails   Fallback to summaries    │
│  Redis                   Sessions lost         Clients must re-init     │
│                                                                          │
│  Graceful Degradation Strategies:                                       │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 1. Processing backlog: Accept uploads, delay processing          │  │
│  │ 2. RAG unavailable: Use document summaries only                  │  │
│  │ 3. Embedding unavailable: Serve text without semantic search     │  │
│  │ 4. CDN unavailable: Serve directly from S3 (slower)             │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 9.4 Data Recovery

```
Backup Strategy:
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  Data Type              Backup Frequency    Retention    RTO    RPO    │
│  ────────────────────────────────────────────────────────────────────   │
│  Original files (S3)    Continuous (CRR)    90 days     1h     0       │
│  File metadata (PG)     Hourly snapshots    30 days     30min  1h      │
│  Extracted content      Daily backup        30 days     2h     24h     │
│  Embeddings (Vector)    Weekly backup       7 days      4h     7d      │
│  Upload sessions        No backup (Redis)   -           -      -       │
│                                                                          │
│  Recovery procedures documented in runbook                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Interview Discussion Points

### 10.1 Clarifying Questions to Ask

1. **Scale**: How many concurrent users? Expected file sizes?
2. **File types**: Which formats must be supported? Video/audio?
3. **Processing requirements**: Real-time or batch? Accuracy vs. speed?
4. **AI model**: Which LLM? Context window size?
5. **Security**: Compliance requirements (HIPAA, GDPR)?
6. **Multi-tenancy**: Shared infrastructure or isolated?

### 10.2 Key Design Decisions to Justify

| Decision | Why | Alternative Considered |
|---|---|---|
| Chunked uploads | Reliability for large files | Simple POST (fails for >10MB) |
| Presigned URLs | Offload bandwidth from servers | Proxy through server (bottleneck) |
| Async processing | Non-blocking UX | Sync (timeout issues) |
| RAG for large docs | Handle unlimited document size | Full context (token limits) |
| S3 + CDN | Scale and global delivery | Local storage (single point of failure) |

### 10.3 Deep Dive Topics

- **Chunking strategies**: Semantic vs. fixed-size, overlap handling
- **OCR pipeline**: When to use local vs. cloud, accuracy tradeoffs
- **Security**: Defense in depth, malware scanning pipeline
- **Cost optimization**: Caching strategies, embedding model selection
- **Real-time updates**: WebSocket vs. polling, connection management

### 10.4 Red Flags to Avoid

- ❌ Storing files on application servers
- ❌ Synchronous processing for all files
- ❌ No malware scanning
- ❌ Trusting client-side validation
- ❌ No rate limiting or quotas
- ❌ Blocking on AI API calls

---

## 11. Extensions for v2

### 11.1 Planned Enhancements

| Feature | Description | Complexity |
|---|---|---|
| **Video/Audio transcription** | Whisper API integration for media files | High |
| **Collaborative annotations** | Multiple users annotating same document | High |
| **Version history** | Track file versions and changes | Medium |
| **Cross-conversation files** | Share files across conversations | Medium |
| **Advanced OCR** | Handwriting recognition, form extraction | High |
| **E2E encryption** | Client-side encryption for sensitive files | High |

### 11.2 Multi-Region Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Multi-Region File Upload (v2)                         │
│                                                                          │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐              │
│  │  US-East    │      │  EU-West    │      │  AP-South   │              │
│  │  Region     │      │  Region     │      │  Region     │              │
│  └──────┬──────┘      └──────┬──────┘      └──────┬──────┘              │
│         │                    │                    │                      │
│         └────────────────────┼────────────────────┘                      │
│                              │                                           │
│                    ┌─────────▼─────────┐                                │
│                    │  Global Router    │                                │
│                    │  (Route53/CF)     │                                │
│                    └───────────────────┘                                │
│                                                                          │
│  Features:                                                              │
│  • Geo-based routing to nearest region                                  │
│  • Cross-region replication for disaster recovery                       │
│  • Data residency compliance (keep EU data in EU)                       │
│  • Global CDN for file delivery                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 12. Real-World Implementations

### 12.1 Reference Architectures

| Product | Approach | Notable Features |
|---|---|---|
| **ChatGPT** | Integrated file upload | Code interpreter, image analysis |
| **Claude** | Direct file processing | Large context window (200K) |
| **Google Workspace** | Chunked uploads | Resumable uploads API |
| **Dropbox** | Block-level dedup | Delta sync, content hashing |
| **Notion AI** | Workspace-integrated | Embedded in documents |

### 12.2 Open Source References

- **tus.io**: Resumable upload protocol
- **Uppy**: File uploader with plugins
- **Minio**: S3-compatible object storage
- **Apache Tika**: Content extraction
- **LangChain**: RAG implementation patterns

### 12.3 Relevant AWS Services

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    AWS Service Mapping                                   │
│                                                                          │
│  Component              AWS Service           Alternative               │
│  ────────────────────────────────────────────────────────────────────   │
│  Object Storage         S3                    GCS, Azure Blob           │
│  CDN                    CloudFront            Cloudflare, Akamai        │
│  Message Queue          SQS                   Kafka, RabbitMQ           │
│  Processing Workers     Lambda / ECS          Kubernetes                │
│  Metadata DB            RDS PostgreSQL        Aurora, CockroachDB       │
│  Vector DB              OpenSearch            Pinecone, Weaviate        │
│  Cache                  ElastiCache (Redis)   Memcached                 │
│  Malware Scanning       GuardDuty + Custom    ClamAV                    │
│  Monitoring             CloudWatch            Datadog, Prometheus       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

Designing file upload for AI chat applications requires balancing:

1. **User experience**: Fast uploads, real-time feedback, seamless AI integration
2. **Scalability**: Handling millions of files with varying sizes
3. **Security**: Protecting against malware and enforcing content policies
4. **Cost efficiency**: Optimizing storage, processing, and AI API costs
5. **AI integration**: Making file content accessible within context limits

The key architectural decisions are:
- **Chunked resumable uploads** for reliability
- **Direct-to-S3 with presigned URLs** for scale
- **Async processing pipeline** for non-blocking UX
- **Hierarchical RAG** for handling large documents
- **Defense-in-depth security** for protection

This design provides a production-ready foundation that can scale to millions of users while maintaining security and cost efficiency.
