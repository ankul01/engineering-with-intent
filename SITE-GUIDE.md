# Engineering with Intent - Site Guide

This document captures the site's positioning, structure, and conventions to guide future changes.

---

## Site Overview

| Property | Value |
|----------|-------|
| **Name** | Engineering with Intent |
| **Tagline** | Architecture decisions and operating practices that hold up in production |
| **URL** | https://ankul01.github.io/leadership-learning/ |
| **Tech Stack** | Next.js 16 + Nextra 4 + MDX |
| **Deployment** | GitHub Pages (static export via `gh-pages` branch) |
| **Search** | Pagefind (runs as postbuild script) |

---

## Audience

- **Staff engineers** navigating ambiguity and cross-team decisions
- **Tech leads** owning architecture and delivery end-to-end
- **Engineering managers** bridging technical depth with execution discipline

---

## Content Pillars

### Pillar 1: Decisions Under Constraints
How to make and defend architecture choices under real-world constraints: cost, compliance, latency, team topology, time.

### Pillar 2: Engineering Operating System
How teams deliver, operate, migrate, and sustain systems over time.

---

## Tone & Style

- **Practical** — Focus on what works in production
- **Opinionated** — Take a stance, explain the rationale
- **Production-first** — Real constraints, not theoretical ideals
- **Concise** — No fluff, get to the point
- **No interview framing** — This is not interview prep content
- **No generic definitions** — Assume reader knows the basics

---

## Navigation Structure

```
Engineering with Intent
├── Decisions Under Constraints
│   ├── Decision Templates
│   ├── System Design Decisions (cache, queues, rate limiting)
│   ├── Data & Storage Decisions
│   ├── Architecture Patterns
│   └── Case Studies
├── Engineering Operating System
│   ├── Delivery & Execution
│   ├── Reliability & Incidents
│   ├── Migrations & Rollouts
│   ├── Platform & Enablement
│   └── Metrics & Impact
├── System Design (existing HLD/LLD content)
├── Leadership
│   ├── Design Reviews & ADRs
│   ├── Stakeholder Alignment
│   ├── Conflict & Escalation
│   ├── Hiring & Team Building
│   └── Performance Management
├── Deep Dives (networking, reliability, observability)
├── Frameworks & Tools
├── Quick Reference
│   ├── Cheat Sheets
│   ├── System Design Summaries
│   ├── Revision Notes
│   ├── Coding Reference
│   └── Company-Specific Notes
└── Templates
```

---

## Key Files

| File | Purpose |
|------|---------|
| `app/layout.jsx` | Site title, meta description, navbar, footer |
| `content/_meta.js` | Top-level navigation order and visibility |
| `content/index.mdx` | Homepage content |
| `package.json` | Site name, description, build scripts |
| `next.config.mjs` | Base path (`/leadership-learning`), static export config |
| `mdx-components.jsx` | Custom MDX components (TopicCard, StatusBadge, etc.) |

---

## Content Migration Mapping

| Original Location | New Location | Status |
|-------------------|--------------|--------|
| `system-design/` | `system-design/` | Visible in nav |
| `deep-dives/` | `deep-dives/` | Visible in nav |
| `decisions/` | `decisions/` | Expanded with new subcategories |
| `operating-system/` | `operating-system/` | Expanded with new subcategories |
| `engineering-leadership/` | `leadership/` | Restructured |
| `behavioral/` | `behavioral/` | Accessible, hidden from main nav |
| `coding/` | `coding/` | Accessible, hidden from main nav |
| `company-specific/` | `company-specific/` | Accessible, hidden from main nav |
| `quick-revision/` | `quick-revision/` | Accessible, hidden from main nav |
| `frameworks/` | `frameworks/` | Visible in nav |
| `metrics-and-impact/` | Hidden | Content migrated to operating-system/metrics-impact |

---

## Page Templates

### Decision Page Template

Use for architecture decisions. Location: `/templates/decision-template`

```markdown
# [Decision Title]

## Context
## Constraints (table format)
## Options Considered (table format)
## Decision
## Trade-offs Accepted
## Second-order Effects
## Failure Modes (table format)
## Observability & SLOs
## Common Failure Modes
## When to Revisit
```

### Playbook Template

Use for operating practices. Location: `/templates/playbook-template`

```markdown
# [Playbook Title]

## Goal
## Scope (in-scope, out-of-scope)
## Principles (2-3 max)
## How it Works (phases)
## Rituals & Cadence (table format)
## Artifacts
## Metrics (table format)
## Guardrails
## Incident Handling
## Common Failure Modes
## Change Management
```

---

## Starter Pages Created

### Decisions Under Constraints
1. `decisions/system-design/cache-invalidation-compliance.mdx`
2. `decisions/system-design/async-processing-retries-dlq.mdx`
3. `decisions/system-design/rate-limiting-fairness.mdx`

### Engineering Operating System
4. `operating-system/migrations-rollouts/monolith-to-services.mdx`
5. `leadership/design-reviews/reviews-that-decide.mdx`
6. `operating-system/reliability-incidents/incident-practices.mdx`

---

## Build & Deploy

```bash
# Development
npm run dev
# Access at http://localhost:3000/leadership-learning/

# Production build
npm run build
# Output in /out directory
# Pagefind search index generated automatically

# Local testing of built site
mkdir -p serve-local/leadership-learning
cp -r out/* serve-local/leadership-learning/
npx serve serve-local -p 3000
# Access at http://localhost:3000/leadership-learning/

# Deploy
git push origin gh-pages
```

---

## Navigation Configuration

Each folder can have a `_meta.js` file to control navigation order and labels.

```javascript
// Example: content/decisions/_meta.js
export default {
  index: 'Overview',
  'decision-templates': 'Decision Templates',
  'system-design': 'System Design Decisions',
  'data-storage': 'Data & Storage Decisions',
  // Hidden items
  'old-section': {
    title: 'Old Section',
    display: 'hidden'
  }
}
```

---

## Custom Components

Available in MDX files (defined in `mdx-components.jsx`):

- `<TopicGrid>` — Grid container for topic cards
- `<TopicCard>` — Card with title, description, href, status, topics
- `<StatusBadge>` — Shows complete/in-progress/planned status
- `<ComingSoon>` — Placeholder for upcoming content

---

## URL Conventions

- **Base path**: `/leadership-learning/` (configured in `next.config.mjs`)
- **Trailing slashes**: Enabled
- **Internal links**: Use relative paths without base path (e.g., `/decisions/` not `/leadership-learning/decisions/`)

---

## Common Tasks

### Add a new decision page
1. Create MDX file in appropriate `decisions/` subfolder
2. Copy structure from `/templates/decision-template`
3. Update the folder's `_meta.js` to include the new page

### Add a new playbook
1. Create MDX file in appropriate `operating-system/` subfolder
2. Copy structure from `/templates/playbook-template`
3. Update the folder's `_meta.js` to include the new page

### Add a new navigation section
1. Create folder in `content/`
2. Add `index.mdx` for the section overview
3. Add `_meta.js` to control sub-navigation
4. Update `content/_meta.js` to include the new section

### Hide a section from navigation
```javascript
// In _meta.js
'section-name': {
  title: 'Section Name',
  display: 'hidden'
}
```

---

## Git Configuration

| Repo | Branch | Remote |
|------|--------|--------|
| leadership-learning | gh-pages | https://github.com/ankul01/leadership-learning |

```bash
git push origin gh-pages
```

---

## Known Issues

1. **Nextra git timestamp warnings**: Files not tracked by git show "Failed to get last modified timestamp" warnings. These are harmless.

2. **Base path for local dev**: Dev server requires accessing `http://localhost:3000/leadership-learning/`, not `http://localhost:3000/`.

3. **Search only works on built site**: Pagefind indexes the built output, so search doesn't work in dev mode.

---

## Future Improvements

- [ ] Add more case studies to `decisions/case-studies/`
- [ ] Migrate behavioral content relevant to leadership into `leadership/`
- [ ] Add more playbooks for common operating practices
- [ ] Consider custom domain setup
- [ ] Add contribution guidelines for external contributors
