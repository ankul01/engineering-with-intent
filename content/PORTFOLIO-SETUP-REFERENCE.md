# Portfolio Website Reference

## Overview

Personal portfolio website for **Ankul Choudhry** — Engineering Leader.

- **Live URL**: https://portfolio.ankul.co.in/
- **Repository**: https://github.com/ankul01/portfolio
- **Deploy Branch**: `gh-pages`

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Next.js 16 (App Router) | React framework with static export |
| Tailwind CSS | Styling |
| TypeScript | Type safety |
| GitHub Pages | Hosting |
| GitHub Actions | CI/CD deployment |
| Google Analytics 4 | Analytics (Measurement ID in GitHub Secrets) |

---

## Project Structure

```
personal-website/
├── app/
│   ├── layout.tsx              # Root layout with Header & GA
│   ├── page.tsx                # Home (redirects to /about/)
│   ├── about/page.tsx          # About Me page
│   ├── leadership-principles/page.tsx
│   ├── architecture-decisions/page.tsx
│   ├── system-designs/page.tsx # Redirect to /architecture-decisions/
│   └── case-studies/page.tsx   # Redirect to /architecture-decisions/
├── components/
│   ├── Header.tsx              # Sticky top navigation
│   ├── Sidebar.tsx             # Left sidebar navigation
│   ├── Layout.tsx              # Page wrapper with sidebar
│   └── GoogleAnalytics.tsx     # GA4 integration
├── config/
│   └── navigation.ts           # Header & sidebar nav config
├── public/
│   ├── CNAME                   # Custom domain: portfolio.ankul.co.in
│   └── .nojekyll               # Disable Jekyll processing
├── .github/workflows/
│   └── deploy.yml              # GitHub Actions deployment
├── next.config.ts              # Next.js configuration
└── docs/
    ├── about-me.md             # Source content
    ├── leadership-principles.md
    └── architecture-decisions.md
```

---

## Domain Configuration

### Custom Domain Setup (GoDaddy)

**DNS Record:**
| Type | Host | Value |
|------|------|-------|
| CNAME | portfolio | ankul01.github.io |

### GitHub Pages Settings

1. Go to: https://github.com/ankul01/portfolio/settings/pages
2. **Source**: GitHub Actions
3. **Custom domain**: portfolio.ankul.co.in
4. **Enforce HTTPS**: Enabled

### CNAME File

Located at `public/CNAME`:
```
portfolio.ankul.co.in
```

---

## Next.js Configuration

`next.config.ts`:
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',        // Static HTML export
  images: {
    unoptimized: true,     // Required for static export
  },
  trailingSlash: true,     // URLs end with /
};

export default nextConfig;
```

**Note**: No `basePath` needed since using custom subdomain.

---

## Deployment

### GitHub Actions Workflow

Deploys from `gh-pages` branch on push.

**Trigger deployment manually:**
1. Go to: https://github.com/ankul01/portfolio/actions
2. Select "Deploy to GitHub Pages"
3. Click "Run workflow" → Select `gh-pages` → Run

### Local Build & Test

```bash
# Build
NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1 npm run build

# Serve locally (test static export)
npx serve out -p 3001

# Open http://localhost:3001/
```

### Deploy Commands

```bash
# Commit and push to gh-pages
git add .
git commit -m "your message"
git push origin gh-pages
```

---

## Google Analytics

### Setup

1. GA Measurement ID stored in GitHub Secrets: `NEXT_PUBLIC_GA_MEASUREMENT_ID`
2. Component: `components/GoogleAnalytics.tsx`
3. Integrated in: `app/layout.tsx`

### Access Analytics

- Dashboard: https://analytics.google.com/

---

## Content Pages

### About Me (`/about/`)
- Employment history with role progressions
- Technical depth table
- Leadership impact section

**Role Progressions:**
- **Acko**: Senior Engineering Manager (Oct 2025–Present), Engineering Manager (Dec 2022–Sep 2025)
- **Snapdeal**: Lead Software Engineer → Engineering Manager (Jan 2018–Nov 2022)
- **Nagarro**: Software Developer → Senior Developer → Technical Lead (2011–2017)

### Leadership Principles (`/leadership-principles/`)
- 5 core principles with real examples
- FraudShield: Third-party AI integration (resistant.ai), pluggable architecture

### Architecture Decisions (`/architecture-decisions/`)
- 6 case studies: Embedded Insurance, Partnership-One, Ackcelerator, Credit Life, Payments, SureOS Migration
- Guiding principles section

---

## Troubleshooting

### Blank Page / Redirect Issues

The home page uses an inline script redirect:
```jsx
<script dangerouslySetInnerHTML={{ __html: `window.location.replace('/about/');` }} />
```

This is necessary because Next.js `redirect()` doesn't work in static export mode.

### 404 After Deploy

1. Check GitHub Pages source is set to "GitHub Actions" (not "Deploy from branch")
2. Verify CNAME file exists in `public/CNAME`
3. Check DNS propagation: https://dnschecker.org/#CNAME/portfolio.ankul.co.in

### Deployment Not Updating

1. Check Actions tab for failed workflows
2. Hard refresh browser: Cmd+Shift+R
3. Try incognito mode to bypass cache

### Custom Domain Stopped Working

When adding/changing custom domain in GitHub Pages settings, it may reset source to "Deploy from branch". Change it back to "GitHub Actions".

---

## Useful Links

| Resource | URL |
|----------|-----|
| Live Site | https://portfolio.ankul.co.in/ |
| GitHub Repo | https://github.com/ankul01/portfolio |
| GitHub Actions | https://github.com/ankul01/portfolio/actions |
| GitHub Pages Settings | https://github.com/ankul01/portfolio/settings/pages |
| DNS Checker | https://dnschecker.org/#CNAME/portfolio.ankul.co.in |
| Google Analytics | https://analytics.google.com/ |

---

## Compliance Notes

Content has been reviewed to remove:
- Specific revenue numbers (GWP figures)
- Internal system names
- Specific partner names
- Sensitive insurance domain metrics

All business metrics are genericized while preserving technical depth.

---

*Last updated: February 2026*
