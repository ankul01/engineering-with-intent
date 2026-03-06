# Engineering with Intent

Architecture decisions and operating practices that hold up in production.

**Live site:** [ankul.co.in/engineering-with-intent/](https://ankul.co.in/engineering-with-intent/)

### Related Sites

- [ankul.co.in](https://ankul.co.in) — Main landing page
- [portfolio.ankul.co.in](https://portfolio.ankul.co.in) — Portfolio and case studies

## Who This Is For

- **Staff engineers** navigating ambiguity and cross-team decisions
- **Tech leads** owning architecture and delivery end-to-end
- **Engineering managers** bridging technical depth with execution discipline

## Content Pillars

### Decisions Under Constraints
How to make and defend architecture choices under real-world constraints: cost, compliance, latency, team topology, time.

### Engineering Operating System
How teams deliver, operate, migrate, and sustain systems over time.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) with App Router
- **Documentation Theme**: [Nextra 4](https://nextra.site/) Docs Theme
- **Content**: MDX (Markdown with JSX support)
- **Deployment**: GitHub Pages (Static Export)
- **Search**: Pagefind

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000/engineering-with-intent](http://localhost:3000/engineering-with-intent) to view the site.

### Build

```bash
npm run build
```

The static output will be in the `out/` directory.

## Content Structure

```
content/
├── decisions/           # Architecture decisions under constraints
│   ├── system-design/   # System design decisions
│   ├── data-storage/    # Data and storage decisions
│   └── architecture/    # Architecture patterns
├── operating-system/    # Engineering operating practices
│   ├── delivery/        # Delivery and execution
│   ├── reliability/     # Reliability and incidents
│   ├── migrations/      # Migrations and rollouts
│   └── metrics/         # Metrics and impact
├── leadership/          # Engineering leadership
├── frameworks/          # Frameworks and tools
├── reference/           # Quick reference materials
└── templates/           # Reusable templates
```

## License

MIT
