# Deliverable 3 (D3) — System Costing & Financial Architecture Model (KAN-88)

**Milestone:** Deliverable 3 Financial Modeling (KAN-88)  
**Repository:** `C:\Users\cavlc\OneDrive\Desktop\AI\Campus-Duo-Qwen-Integration`  
**Date:** November 5, 2026  
**Auditor:** Infrastructure & Financial Planning  
**Status:** COMPLETE — PARAMETERIZED 3-TIER COST MODEL DOCUMENTED  

---

## 1. Cost Modeling Methodology & Assumptions

This costing document establishes a defensible financial model for hosting, running, and scaling **Campus Duo** for the IIT Kanpur student body (~9,000 active students). 

### Modeling Principles:
1. **Separation of Fixed and Variable Costs:** Distinguishes base infrastructure (compute, managed PostgreSQL, domain) from usage-dependent variable expenses (LLM inference tokens, outbound emails, bandwidth).
2. **Local Fallback Zero-Cost Ceiling:** Demonstrates that during AI provider disruptions or when operating purely on the deterministic recommendation engine (`TemplateLlmClient`), LLM inference costs drop to **$0.00**.
3. **Transparent Parameterization:** All estimates use published standard rates (AWS / Render / Supabase / Hugging Face Pro) as of late 2026.

---

## 2. Infrastructure Component Cost Baseline

| Component | Provider / Solution | Resource Specification | Pricing Unit | Monthly Rate |
|---|---|---|---|---|
| **API Server (Backend)** | Render / AWS App Runner | Node.js container (1 vCPU, 2 GB RAM, 24/7) | Fixed monthly | $7.00 – $15.00 |
| **Static Web App (Frontend)** | Vercel / Cloudflare Pages | Single Page Application (React build, Edge CDN) | Fixed free tier / Pro | $0.00 – $20.00 |
| **Relational Database** | Managed PostgreSQL 17 (Supabase / Neon) | 2 vCPU, 4 GB RAM, 20 GB NVMe storage, daily backups | Fixed monthly | $25.00 – $35.00 |
| **Email Delivery (OTP)** | IITK CC Relay (Institutional SMTP) or Resend | ~5,000 emails/month (100–200 daily active users) | Free on-campus / $0.0008/msg | $0.00 (Campus) / $5.00 |
| **AI Inference (Cloud LLM)** | Hugging Face Dedicated Endpoint / Pro Subscription | Qwen-3-4B-Instruct or serverless token tier | Variable token / $9 Pro sub | $9.00 – $50.00 |
| **Domain & SSL** | IITK Institutional Subdomain (`campusduo.iitk.ac.in`) | Academic intranet hosting + Let's Encrypt SSL | Fixed institutional | $0.00 |

---

## 3. Usage-Tiered Financial Estimates (3 Scenarios)

### Scenario A: Free Academic / Demo Tier (Course Project Baseline)
*Assumptions:* Operated on IITK internal infrastructure or free cloud tiers; AI assistant runs in local deterministic template fallback mode (zero cloud inference fees).
- Frontend: Vercel Free ($0.00)
- Backend: Local campus VM / Render Free tier ($0.00)
- Database: Self-hosted PostgreSQL 17 on campus server ($0.00)
- Email: IITK CC SMTP Relay ($0.00)
- AI Inference: Local deterministic template fallback ($0.00)
- **Total Monthly Cost: $0.00 / month (₹0)**
- **Cost per Booking: $0.00**

---

### Scenario B: MVP Production Tier (Campus Pilot — 500 Active Users)
*Assumptions:* 500 registered students; ~100 daily active users; ~50 bookings/day; ~150 AI recommendation queries/day (~45,000 tokens/day via Hugging Face Serverless / Pro).
- Frontend: Cloudflare Pages / Vercel Pro: **$20.00 / mo**
- Backend: Render Starter Web Service (1 vCPU, 2 GB RAM): **$7.00 / mo**
- Database: Supabase Pro Managed PostgreSQL 17 (8 GB storage): **$25.00 / mo**
- Email: Resend / SendGrid (3,000 verification emails/mo): **$0.00** (Within free 3,000 tier)
- AI Hosted Inference: Hugging Face Pro Account / Pay-per-token: **$9.00 / mo**
- **Total Monthly Cost: $61.00 / month (~₹5,100 / mo)**
- **Cost per Active Student: ~$0.12 / student / month**
- **Cost per Booking Transaction: ~$0.04 / booking**

---

### Scenario C: Campus-Wide Scale Tier (All 9,000 IITK Students)
*Assumptions:* 9,000 registered students; ~2,000 daily active users; ~1,200 bookings/day; ~3,000 AI recommendation queries/day (~900,000 tokens/day).
- Frontend: Cloudflare Pages / AWS CloudFront: **$20.00 / mo**
- Backend: AWS App Runner / ECS (2 instances with auto-scaling): **$50.00 / mo**
- Database: AWS RDS PostgreSQL 17 (db.t4g.medium, Multi-AZ, 100 GB storage): **$85.00 / mo**
- Email: AWS SES (~30,000 verification & notification emails/mo): **$3.00 / mo**
- AI Hosted Inference: Dedicated Hugging Face Inference Endpoint (1x Nvidia T4 GPU, 16 GB VRAM) for low-latency Qwen-3-4B inference: **$120.00 / mo**
- Sentry / Datadog Monitoring: Team tier: **$25.00 / mo**
- **Total Monthly Cost: $303.00 / month (~₹25,500 / mo)**
- **Cost per Active Student: ~$0.033 / student / month (~₹2.80 / student)**
- **Cost per Booking Transaction: ~$0.008 / booking (~₹0.70 / booking)**

---

## 4. Cost Optimization & Risk Mitigation Strategies

1. **Deterministic Caching of Recommendation Prompts:** Profile similarity scores ($S(u, v)$) are cached in Redis or PostgreSQL for 6 hours unless a student updates their enrolled courses, cutting LLM token demand by ~65%.
2. **Zero-Inference Fallback Mode:** When cloud budget thresholds are reached (e.g. $50 cap), the backend automatically engages `TemplateLlmClient`, providing full student match functionality with zero additional spend.
3. **Institutional Infrastructure Utilization:** Deploying the backend and PostgreSQL on IITK Computer Centre virtual machines completely eliminates cloud hosting fees.
