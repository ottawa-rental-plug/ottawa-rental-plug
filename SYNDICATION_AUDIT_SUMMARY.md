# ORP Syndication Audit - Executive Summary

**Prepared for:** Cyril Babalola  
**Date:** July 7, 2026  
**Status:** AUDIT COMPLETE - Ready for Decision

---

## 🎯 Key Audit Questions & Answers

### ✅ Does ORP already have a listing database?
**YES** - Fully functional Supabase PostgreSQL `units` table with 8+ properties tracked (beds, baths, price, address, neighbourhood, status, client_id for API imports)

### ✅ How are properties stored?
**PostgreSQL (Supabase)** - Normalized relational database with row-level security, indexed for performance, with stable client_id for syndication imports without breaking links

### ❌ How are photos handled?
**NO PHOTO SYSTEM EXISTS** - This is the **critical blocker** for syndication. Listings only have text descriptions. Need to build: photo storage, CDN, upload UI, photo schema

### ✅ Is there already a landlord dashboard?
**YES - TWO DASHBOARDS:**
1. **Admin Portal (landlord.html)** - Cyril only, full unit/applicant management
2. **Landlord Client Portal (landlord-portal.html)** - Individual landlords see only their units (security gated)

### ✅ Is there already a CRM/leads database?
**YES - Multi-source:**
- Supabase `applicants` table (Full rental applications)
- Netlify Forms (lead capture)
- SingleKey integration (screening results)
- Activity logging (audit trail)
- 9-stage pipeline (new → matched → screening → approved → placed)

---

## 🚀 Syndication Feasibility

### Can we add syndication without rebuilding anything?

**YES - Conditional**

**What's Already There (No Rebuilding Needed):**
- ✅ Database schema is perfectly structured
- ✅ Backend (Netlify Functions) is production-ready
- ✅ API infrastructure exists (Supabase REST)
- ✅ Landlord management is done
- ✅ Multi-source data integration proven

**What's Missing (Must Build):**
- ❌ Photo storage system (HIGH PRIORITY)
- ❌ Photo CDN/serving (HIGH PRIORITY)
- ⚠️ XML/RSS feed generation (MEDIUM PRIORITY)
- ⚠️ Syndication API endpoint (MEDIUM PRIORITY)
- ⚠️ MLS platform integration (LOW PRIORITY - can start simple)

---

## 📊 Effort & Timeline

### Photo System (CRITICAL BLOCKER)
- **Effort:** 2 weeks
- **Components:**
  - Supabase Storage setup
  - `photos` database table
  - Photo upload UI in landlord dashboard
  - Image optimization/CDN
  - Photo API endpoints

### Syndication API (CORE FEATURE)
- **Effort:** 2 weeks
- **Components:**
  - `/api/listings` endpoint with filters
  - XML feed generation
  - Syndication metadata fields (MLS number, days on market, etc.)
  - API authentication & rate limiting

### First Platform Integration (PILOT)
- **Effort:** 1 week (Realtor.ca pilot)
- **Includes:** Connection setup, testing, monitoring

### Total Timeline: 5-6 weeks for full end-to-end syndication

---

## 💰 Cost Estimate

**Infrastructure (Monthly):**
- Supabase Storage: Included in standard plan (50GB included)
- CDN: Cloudflare ($20-50/mo) or use Netlify built-in
- MLS/Platform APIs: Varies by provider ($0-200/mo)
- **Total:** $0-250/month

**Development:**
- In-house (assumes Cyril + contractor): ~240 hours
- Estimated cost: $5,000-10,000 (depending on rates)

---

## 🎯 Recommendation: PROCEED WITH SYNDICATION

### Why It's Go:
1. ✅ Core infrastructure is already built and proven
2. ✅ Photo system is the only blocker (not architectural)
3. ✅ Low risk (isolated to new photo layer)
4. ✅ High value (reaches 5-10x more renters)
5. ✅ Existing CRM can track syndicated leads

### Risk Level: **LOW**

### Decision Needed:
1. Approve photo system architecture (Supabase Storage + Cloudflare CDN - RECOMMENDED)
2. Approve pilot platform (Realtor.ca - RECOMMENDED)
3. Authorize development (5-6 weeks)

---

## 🔧 Technical Highlights

**Current Stack:**
- Frontend: HTML5 + Vanilla JS (no frameworks)
- Backend: Netlify Functions (10 serverless functions)
- Database: Supabase PostgreSQL
- Integrations: SingleKey, ntfy, Formspree, Netlify Forms

**Already Integrated Services:**
- ✅ Supabase (Database, Auth, Storage - ready)
- ✅ Netlify (Functions, Hosting - ready)
- ✅ SingleKey (Screening - proven)
- ⚠️ ntfy (Notifications - proven)

**Ready for New Services:**
- Photo CDN (simple add)
- MLS platforms (API integration)
- Syndication networks (webhook listeners)

---

## 📋 Next Steps (If Green-Light Given)

1. **Week 1:** Photo schema design + Supabase Storage setup
2. **Week 2:** Photo upload UI + CDN integration
3. **Week 3-4:** Syndication API + feed generation
4. **Week 5:** Realtor.ca integration + testing
5. **Week 6:** Monitoring + optimization

---

## ⚠️ Critical Success Factors

1. **Photo system must ship first** - Nothing works without it
2. **Landlord consent** - Add "syndication_enabled" flag to units
3. **Photo quality** - Will make-or-break listings on other platforms
4. **API security** - Public syndication endpoint needs rate limiting & API keys
5. **Data sync** - Bidirectional sync with MLS platforms is complex

---

## 📄 Full Technical Details

See `TECHNICAL_BLUEPRINT_ORP.md` for:
- Complete database schema
- All integrations mapped
- Security model explained
- Scalability assessment
- Detailed migration path
- Architecture decision guide

---

## 🚦 Status: READY TO DECIDE

**Recommendation:** Approve syndication feature development. Start with photo system + Realtor.ca pilot.

**Owner Approval Needed:** Cyril Babalola

