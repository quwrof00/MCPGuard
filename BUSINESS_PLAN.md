# MCP Guard — Business Plan & Financial Model (cfo.ai Submission)

> **Prepared for neatHack 2026 / cfo.ai Track**  
> **Product**: MCP Guard (`mcpguard.com`)  
> **Category**: Developer Tooling / AI Agent Infrastructure / CI/CD Observability  

---

## 1. Executive Summary

**MCP Guard** is the automated contract testing, regression detection, and auto-remediation guardrail for autonomous AI agents that rely on Model Context Protocol (MCP) servers.

As the AI agent ecosystem standardizes on MCP, companies face a catastrophic new failure mode: **Silent Tool Drift**. When tool APIs evolve (parameter renames, type mutations, deprecations), agents fail silently at runtime during multi-step execution. MCP Guard acts as the **"Sentry + Playwright for MCP"**, catching breaking schema changes in CI/CD, simulating chained agent replays, and synthesizing validated fixes before broken tools reach production.

---

## 2. Market Opportunity & ICP

### Target Customers
1. **AI Agent Platform Developers** (CrewAI, LangChain, AutoGen, Mastra, Cursor/Copilot plugin ecosystems).
2. **Enterprise AI Engineering Teams** deploying autonomous internal agents (Fintech, Customer Support, DevOps).
3. **MCP Server Providers & API Vendors** (SaaS tools publishing official MCP servers needing contract validation).

### Market Size
- **Total Addressable Market (TAM)**: $4.8B (AI Developer Tools & Agent Observability by 2028).
- **Serviceable Available Market (SAM)**: $650M (MCP & Tool Call Testing Infrastructure).
- **Serviceable Obtainable Market (SOM)**: $24M (Early-adopter enterprise agent platforms in Years 1–2).

---

## 3. Product & Pricing Architecture

| Tier | Price | Target Audience | Features & Limits |
| :--- | :--- | :--- | :--- |
| **Developer (Free / Open Core)** | **$0 / mo** | Solo developers & open-source projects | Up to 3 MCP servers, 50 workflow replays/mo, CLI runner, heuristic fix suggestions, community support. |
| **Team (Pro)** | **$49 / mo** | Seed / Series A AI startups | Up to 15 MCP servers, 2,500 workflow replays/mo, AI-powered fix synthesis (Groq Llama 3), GitHub Actions CI/CD integration, neatlogs telemetry traces. |
| **Enterprise** | **$299 / mo** (Base) + Usage | Enterprise engineering orgs | Unlimited servers, dedicated in-memory sandboxes, custom SLA, single-tenant hosting, SAML SSO, team collaboration with Entire checkpoints. |

*Usage overage*: $0.02 per additional workflow replay run; $0.05 per AI-synthesized fix verification.

---

## 4. Cost of Goods Sold (COGS) & Unit Economics

### Per-Analysis Cost Breakdown
- **In-Memory Server Replay**: Near zero CPU overhead (sub-100ms in-process execution).
- **AI Fix Synthesis (Groq Llama 3-70B/8B)**: ~$0.00015 per fix generation (1,000 prompt tokens + 250 completion tokens on Groq).
- **Telemetry & Tracing (neatlogs)**: $0.00005 per trace envelope.
- **Serverless Hosting (Vercel / AWS Lambda)**: $0.00010 per analysis request.
- **Total Blended COGS per Analysis**: **~$0.00030**

### Gross Margins
- Average Team tier customer executes ~500 analyses/month = **$0.15 COGS** against **$49.00 ARR/MRR**.
- **Gross Margin**: **> 92%** (software-native gross margins with high inference efficiency on Groq).

---

## 5. 18-Month Financial Projections & Runway Model

| Metric | Q1 2027 | Q2 2027 | Q3 2027 | Q4 2027 | Q1 2028 | Q2 2028 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Active Free Users** | 450 | 1,800 | 4,200 | 8,500 | 14,000 | 22,000 |
| **Paying Teams ($49/mo)** | 18 | 65 | 180 | 420 | 850 | 1,450 |
| **Enterprise Accounts ($299/mo)** | 2 | 8 | 22 | 55 | 110 | 190 |
| **Monthly Recurring Revenue (MRR)** | **$1,480** | **$5,577** | **$15,398** | **$37,025** | **$74,540** | **$127,860** |
| **Annualized Run Rate (ARR)** | $17.8K | $66.9K | $184.8K | $444.3K | $894.5K | **$1.53M** |
| **Total Monthly Burn** | $12,500 | $16,000 | $22,000 | $35,000 | $48,000 | $65,000 |
| **Net Cash Flow** | -$11,020 | -$10,423 | -$6,602 | +$2,025 | +$26,540 | +$62,860 |

### Runway & Capital Efficiency
- **Initial Seed / Angel Round Needed**: **$200,000**
- **Break-Even Point**: Month 11 (at ~420 Pro teams and 55 Enterprise logos, reaching ~$37K MRR).
- **Runway without further funding**: **18+ Months**; cash-flow positive by Q4 2027.

---

## 6. Go-To-Market (GTM) Strategy

1. **Bottom-Up Open-Source Developer Adoption**:
   - Release free CLI runner `mcp-guard check` into developer workflows.
   - MCP Server directory listings and badges: *"Verified Compatible with MCP Guard"*.
2. **GitHub Actions Marketplace Integration**:
   - Pre-commit & CI action that fails PRs when tool schemas introduce breaking contract changes.
3. **Observability Ecosystem Partnerships**:
   - Partner with **neatlogs** for turnkey trace dashboards.
   - Partner with **Entire** for checkpoint-based fix auditing and repo dependency mapping.

---

## 7. cfo.ai Integration Checklist

- [x] Input pricing tiers ($0, $49, $299) into cfo.ai model builder.
- [x] Assign COGS categories (Groq inference, hosting, neatlogs observability).
- [x] Set customer acquisition channels (organic GitHub stars, developer advocacy, enterprise sales).
- [x] Verify 18-month runway calculation with $200k initial funding and Month 11 break-even.
- [x] Export finalized cfo.ai scenario PDF/link into submission package.
