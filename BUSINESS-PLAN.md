

# Business Plan: Statement Reader

## Elevator Pitch

Statement Reader turns any bank statement (PDF or CSV) into actionable financial intelligence. Users upload a statement, and within seconds they get categorised spending breakdowns, AI-powered insights, cash-flow forecasts, and practical review actions.

For business users, the product is not just a spending dashboard. It becomes a **Business Spend Review** tool that helps owners and finance managers spot waste, duplicated services, unclear stakeholder spending, suspicious-looking personal expenses, excessive fees, cash-flow risks, and control gaps.

The core positioning:

> Instant financial health check from a bank statement, no bank connection required.

---

## 1. Problem

Most people and small businesses do not understand what is really happening inside their bank statements.

Existing solutions have friction:

- **Open Banking apps** require live bank connections, which can create trust and privacy concerns.
- **Spreadsheets** require manual work and financial literacy.
- **Bank apps** show transactions but rarely explain risk, waste, or useful actions.
- **Accountants and financial advisors** are expensive and usually review information after the fact.
- **Business owners with multiple stakeholders or cardholders** often cannot easily see who is spending what, whether subscriptions are duplicated, or whether company money is being used for personal or unclear expenses.

The result: businesses may be paying for old subscriptions, duplicated tools, unnecessary vendors, avoidable fees, personal expenses, unclear transfers, and hidden recurring commitments without noticing.

---

## 2. Solution

**Statement Reader** is a web app that:

1. Parses bank statements from PDF or CSV.
2. Normalises transactions into clean merchant, date, amount, direction, category, and optional cardholder fields.
3. Detects patterns using deterministic rules first.
4. Sends suspicious groups and transaction evidence to an AI model.
5. Produces concise, transaction-backed insights.
6. Shows each finding as an interactive card with drill-down evidence.
7. Requires no bank connection for the basic flow.

For businesses, the key product is:

## Business Spend Review

A practical review report that helps a business owner answer:

- What needs attention?
- Which transactions caused the concern?
- Why does it matter?
- What should I check next?
- Which vendor, stakeholder, or payment pattern may be wasting money?
- What is the estimated monthly or annual impact?

The insight is the product. Users do not just see what they spent, they learn what to do about it.

---

## 3. Important Product Correction

The app must not produce generic AI output such as:

> 289 recurring payment patterns detected. Review recurring payments.

That is not an insight. That is only a statistic.

A useful insight must be specific and transaction-backed, for example:

> American Express 3773 includes a £59,105.90 outgoing payment. This may be legitimate, but the bank statement does not show the underlying card transactions. Match it to the Amex statement and review the largest charges, recurring subscriptions, personal-looking merchants, and cardholder allocation.

The app should follow this rule:

> No insight should appear unless it is linked to specific transactions, merchants, amounts, dates, and a clear recommended action.

---

## 4. Business Spend Review Architecture

The AI model should not be asked to analyse thousands of raw transactions without preparation.

The correct architecture is:

### Pass 1: Deterministic Detection Engine

The application code detects candidate patterns first:

- recurring groups
- duplicate vendors
- same-amount payments
- high-value unclear payments
- personal-looking merchants
- weekend or late-night spend
- payment processors
- SaaS overlap
- card repayments
- transfers to individuals
- tax and payroll patterns
- refunds and failed payments
- FX and bank fees
- revenue concentration
- cash-flow risks

### Pass 2: AI Insight Writer

The AI receives only the most relevant suspicious groups and supporting transactions. Its job is to turn those candidates into concise, practical, business-owner-friendly findings.

### Pass 3: Interactive UI

Each insight becomes a clickable card. Clicking the card opens a drawer or modal with the full evidence, actions, and transaction table.

---

## 5. Runtime Input Shape for AI

The AI should receive structured data like this:

```json
{
  "transactions": [],
  "candidate_findings": [],
  "recurring_groups": [],
  "merchant_groups": [],
  "same_amount_groups": [],
  "weekend_transactions": [],
  "late_night_transactions": [],
  "large_transactions": [],
  "opaque_transactions": [],
  "personal_like_merchants": [],
  "software_vendor_groups": [],
  "income_groups": [],
  "cash_flow_summary": {},
  "business_context": {}
}
```

This is important because the AI should reason over evidence, not guess from summary statistics.

---

## 6. Master Prompt: Business Spend Review

Use this as the master prompt for the AI insight layer.

```text
You are a senior business spend analyst, forensic finance reviewer, and cash-flow control advisor.

You are analysing parsed business bank statement transactions.

Your job is to find useful, specific, transaction-backed red flags and money-saving opportunities.

Do not produce generic questions.
Do not produce generic advice.
Do not simply say “review recurring payments”.
Do not create an insight unless it is supported by specific transactions, merchant patterns, timing patterns, amounts, or category behaviour.

Every insight must teach the business owner something they could not easily see from a normal bank statement.

Your output will be used in an interactive dashboard, so every finding must be concise, clickable, and linked to the exact transactions that caused the finding.

Important safety and wording rules:
- Do not accuse anyone of fraud, theft, or misuse.
- Use careful wording: “possible”, “may indicate”, “worth reviewing”, “requires confirmation”, “could be legitimate”.
- Do not provide legal, tax, investment, credit, or regulated financial advice.
- Do not invent missing context.
- If a transaction may be legitimate, say so clearly.
- Focus on business control, cash-flow visibility, cost optimisation, and owner review.

Core rule:
A finding is only valid if it answers at least one of these:
1. What exactly looks unusual?
2. Which transaction or merchant caused the concern?
3. Why does it matter?
4. What should the owner check next?
5. What is the possible monthly or annual impact?

If you cannot answer those questions, do not create the finding.
```

---

## 7. Input Contract

```text
Input data will include:

TRANSACTIONS_JSON:
Each transaction may include:
- id
- date
- description
- merchant
- amount
- direction: income | expense
- balance_after
- category
- subcategory
- payment_method
- cardholder
- stakeholder
- reference
- source_file
- page_number
- confidence

BUSINESS_CONTEXT, optional:
- business name
- industry
- country
- business size
- known stakeholders
- known cardholders
- expected vendors
- approved categories
- normal operating days
- normal business hours
- previous period summary
- known clients
- known payroll dates
- known tax/VAT pattern

If fields are missing, work with what is available, but clearly mention missing data only in the “missing_data” section.
```

---

## 8. Detection Logic

```text
Analyse the transactions across these 50 red-flag and opportunity cases.

For each case:
- Look for exact merchants, patterns, timings, repeated amounts, unusual amounts, and unclear descriptions.
- Do not return all cases.
- Return only cases where there is evidence in the transactions.
- Prioritise materiality: high amount, repeated pattern, high risk, or clear control weakness.
- Prefer 5 strong findings over 30 weak findings.
```

---

## 9. 50 Business Detection Cases

### 1. Personal streaming subscriptions

Detect Netflix, Disney+, Spotify, Amazon Prime Video, Apple TV, YouTube Premium, Audible, gaming subscriptions, and similar services.

Return only if the charge looks recurring, material, stakeholder-specific, or unrelated to business context.

### 2. Amazon Prime, Amazon Marketplace, Amazon Digital, Kindle, Audible

Do not simply flag all Amazon.

Split Amazon into patterns:

- recurring Prime or digital subscriptions
- repeated low-value marketplace purchases
- high-value unclear Amazon purchases
- weekend or late-night Amazon spend
- multiple Amazon charges in short periods

Explain why each pattern matters.

### 3. Food delivery outside normal business context

Detect Deliveroo, Uber Eats, Just Eat, restaurants, cafes, takeaways.

Flag late-night, weekend, repeated, high-value, or cardholder-specific spending.

Distinguish possible team meals from personal meals.

### 4. Supermarket spend

Detect Tesco, Sainsbury’s, Waitrose, Lidl, Aldi, M&S Food, Co-op, Morrisons.

Flag repeated grocery-like spend, weekend spend, or large household-style baskets.

Do not flag if clearly office supplies unless the pattern is excessive.

### 5. Fashion, clothing, and retail

Detect ASOS, Zara, H&M, Nike, Adidas, Selfridges, department stores, luxury retail.

Flag unless business context suggests uniforms, workwear, costume, or resale inventory.

### 6. Beauty, wellness, gym, and personal care

Detect gyms, spas, salons, cosmetics, wellness apps, health clubs.

Flag as policy-review items, not misconduct.

### 7. Travel that does not match business pattern

Review flights, hotels, trains, taxis, parking, car hire, travel agencies.

Flag holiday destinations, weekends, luxury hotels, family-sized bookings, and travel with no matching client/project context.

### 8. Leisure and entertainment

Detect cinemas, theatres, Ticketmaster, sports clubs, gaming platforms, theme parks, bars, clubs, event venues.

Flag if repeated, high-value, or outside normal business context.

### 9. Gambling, betting, crypto, or speculative trading

Detect betting sites, casinos, crypto exchanges, trading apps.

Treat as High or Critical unless the business context explains it.

Use careful wording.

### 10. Personal finance payments

Detect Klarna, PayPal Pay in 3, personal credit card repayments, personal loans, mortgage, rent, school fees, personal insurance.

Flag as possible personal liability paid from business funds.

### 11. Multiple payments for same software category

Detect overlapping collaboration, storage, CRM, design, accounting, HR, meeting, password, analytics, or support tools.

Examples: Slack + Teams, Zoom + Google Meet, Dropbox + Google Drive, Notion + Confluence, Asana + Monday.

### 12. Same vendor charged multiple times in one billing cycle

Find same vendor repeated within 7, 14, or 31 days.

Group by merchant, amount similarity, and date spacing.

Explain if it looks like multiple seats, duplicate accounts, failed retries, or usage-based billing.

### 13. Different vendors providing similar services

Find vendors in the same functional category.

Examples: Mailchimp + Klaviyo + HubSpot, Xero + QuickBooks, Wix + Squarespace, Canva + Adobe + Figma.

### 14. Duplicate insurance policies

Detect multiple insurers or insurance-like payments.

Flag possible overlap across liability, professional indemnity, cyber, vehicle, or equipment insurance.

### 15. Duplicate telecom, phone, or internet payments

Detect BT, Virgin, Vodafone, EE, O2, Three, TalkTalk, Sky.

Flag old contracts, duplicated lines, or multiple stakeholder phone bills.

### 16. Duplicate cloud hosting or infrastructure

Detect AWS, Azure, Google Cloud, DigitalOcean, Heroku, Vercel, Netlify, Cloudflare, Firebase, Supabase, Render, Railway.

Flag overlapping infrastructure or old environments still billing.

### 17. Multiple payment processors charging fees

Detect Stripe, Square, SumUp, PayPal, GoCardless, Worldpay, Adyen, Checkout.com.

Flag if multiple processors charge materially, or if fees look high relative to income.

### 18. Multiple accounting, receipt, or bookkeeping tools

Detect Xero, QuickBooks, FreeAgent, Sage, Dext, Receipt Bank, Hubdoc, Expensify, Pleo.

Flag duplication or unclear tool ownership.

### 19. Repeated professional service retainers

Detect multiple accountants, lawyers, HR consultants, payroll bureaus, marketing agencies.

Flag overlapping retainers or unclear monthly advisory costs.

### 20. Same amount paid to different vendors

Detect repeated identical or near-identical monthly amounts to different vendors.

Use this to find hidden equivalent subscriptions or duplicate services.

### 21. One stakeholder or cardholder has unusually high spend

If cardholder/stakeholder data exists, compare spend by person.

Flag outliers in total spend, discretionary spend, weekend spend, or unclear spend.

### 22. Weekend spending by stakeholder/cardholder

Flag repeated weekend spending in food, travel, shopping, entertainment, cash, or leisure.

### 23. Late-night transactions

Flag transactions outside normal business hours, especially bars, restaurants, taxis, convenience stores, online shopping, entertainment.

### 24. Stakeholder recurring personal services

Detect recurring phone, gym, streaming, shopping memberships, leisure subscriptions, personal insurance, or travel linked to one person.

### 25. Sudden increase in one stakeholder’s spending

Compare with previous period if available.

Flag large increases by person, category, merchant, or card.

### 26. Payments to unknown individuals

Detect bank transfers, Faster Payments, standing orders, or references that look like personal names.

Flag as contractor/dividend/reimbursement/personal transfer review items.

### 27. Round-number transfers without clear references

Flag repeated £100, £250, £500, £1,000, £2,500, £5,000 transfers with vague references.

### 28. Possible director loan account activity

Detect repeated transfers to or from directors, owners, shareholders, or related parties.

Do not make tax conclusions.

Recommend bookkeeping review.

### 29. Reimbursements without matching expense pattern

Flag reimbursements where there are no visible matching travel, hotel, client, equipment, or project costs.

### 30. Opaque wallet, app store, or payment intermediary spend

Detect PayPal, Apple.com/Bill, Google services, Meta Pay, Curve, Revolut top-ups, Wise, Stripe links.

Flag because final merchant is unclear.

### 31. Revenue concentration risk

Calculate income concentration by payer.

Flag if one client/payer contributes a high percentage of income.

### 32. Income volatility

Compare income across weeks or periods.

Flag missing expected income, irregular receipt timing, or sharp drops.

### 33. Expense growth faster than income

If previous periods exist, compare expense growth against revenue growth.

### 34. Negative cash-flow trend

Use opening/closing balance and weekly movement.

Flag sustained decline, repeated negative weeks, or large cash drain.

### 35. Low cash buffer or runway risk

Estimate burn rate and runway if balance data exists.

Flag inability to cover upcoming payroll, rent, tax, debt, or supplier payments.

### 36. Payroll affordability warning

Detect payroll pattern.

Check whether current balance and expected income appear sufficient for next payroll cycle.

### 37. VAT, corporation tax, PAYE, or tax reserve review

Detect HMRC, VAT, PAYE, corporation tax.

If large revenue exists but no visible tax reserve or HMRC pattern, flag carefully as a review item.

### 38. Irregular client payment timing

Detect clients who usually pay on a schedule but are late, missing, smaller, or inconsistent.

### 39. Refund, reversal, dispute, or chargeback spike

Detect refunds, returned payments, chargebacks, reversals, failed payments.

Flag possible fulfilment, customer, quality, or cash-flow issue.

### 40. Increasing debt repayments or financing costs

Detect loans, asset finance, merchant cash advances, credit card repayments, interest, finance providers.

Flag rising debt servicing.

### 41. Bank charges and avoidable fees

Detect overdraft charges, unpaid item fees, monthly fees, cash deposit fees, card fees, transfer fees.

Estimate annualised cost.

### 42. Foreign exchange and international payment leakage

Detect FX fees, international transfer fees, currency conversion, foreign vendors.

Flag repeated FX leakage.

### 43. Unused or unclear subscription risk

Detect recurring subscriptions with unclear business purpose.

Prioritise small recurring charges that repeat silently.

### 44. Free trial converted into paid subscription

Detect first-time small charge followed by repeated paid charge.

Flag as possible forgotten trial.

### 45. Annual renewal shock

Detect large annual renewals, insurance, software, domains, licences, memberships.

Surface future renewal risk.

### 46. Too many small recurring payments

Detect subscription creep from many £5-£30 charges.

Do not return this unless you list the merchants and total monthly value.

### 47. Delivery, courier, postage, fulfilment overspend

Detect Royal Mail, DPD, DHL, Evri, Uber Direct, couriers, shipping platforms.

Flag excessive fragmentation or high fulfilment cost.

### 48. Excessive taxi, ride-hailing, or parking spend

Detect Uber, Bolt, Addison Lee, parking apps, train/taxi combinations.

Flag repeated or avoidable local transport cost.

### 49. Software seat bloat

For SaaS tools, recommend checking active users, old employees, duplicate workspaces, and plan level.

Only return if the spend is recurring or material.

### 50. Dormant vendor still being paid

Detect recurring vendors with no obvious current operational relevance.

Flag as possible legacy cost.

---

## 10. Scoring Rules

```text
Score every candidate finding before returning it.

Severity:
- Critical: possible serious control issue, gambling/crypto/personal liabilities, very high-value unclear transfer, severe cash-flow risk.
- High: material unexplained spend, duplicate major vendors, large recurring unknown payments, stakeholder/cardholder outlier.
- Medium: repeated but moderate-value issue, subscription creep, unclear operational cost, policy gap.
- Low: small issue, useful but not urgent.

Confidence:
- High: strong merchant match, repeated pattern, clear category, exact transaction support.
- Medium: pattern suggests issue but could be legitimate.
- Low: weak signal, missing context, ambiguous description.

Materiality:
- Always consider total amount, frequency, and business impact.
- A single £5 Spotify charge is low priority.
- A recurring £59,105.90 American Express payment is high priority even if the merchant is unclear.
- A repeated vendor with unclear purpose is more important than a one-off small transaction.

Return:
- Maximum 12 insights.
- Minimum 3 insights if enough evidence exists.
- Never return only one generic insight when there are thousands of transactions.
- If there are 4,102 transactions, you must search for multiple patterns before concluding.
```

---

## 11. JSON Output Rules for Interactive UI

```text
Return valid JSON only.
No markdown.
No prose outside JSON.

Each insight must be clickable in the UI.

Every insight must include:
- id
- short_title
- one_line_summary
- severity
- confidence
- category
- detection_case_ids
- why_flagged
- evidence
- transaction_ids
- grouped_transactions
- estimated_impact
- recommended_action
- owner_question
- drilldown_sections
- ui_badges
```

---

## 12. JSON Output Schema

```json
{
  "analysis_type": "business_spend_review",
  "executive_summary": {
    "headline": "",
    "plain_english_summary": "",
    "total_transactions_reviewed": 0,
    "date_range": {
      "from": "",
      "to": ""
    },
    "total_income": 0,
    "total_expenses": 0,
    "net_cash_flow": 0,
    "items_to_review": 0,
    "estimated_monthly_savings": {
      "amount": 0,
      "confidence": "High | Medium | Low",
      "explanation": ""
    },
    "top_3_findings": [
      {
        "insight_id": "",
        "title": "",
        "why_it_matters": "",
        "amount_at_risk": 0
      }
    ]
  },
  "insights": [
    {
      "id": "insight_001",
      "short_title": "",
      "one_line_summary": "",
      "category": "Possible personal spend | Duplicate vendor | Subscription creep | Cash-flow risk | Stakeholder behaviour | Tax/bookkeeping review | Bank fees | Revenue risk | Opaque transfer | Other",
      "severity": "Critical | High | Medium | Low",
      "confidence": "High | Medium | Low",
      "detection_case_ids": [1, 2, 12],
      "amount_at_risk": 0,
      "estimated_monthly_impact": 0,
      "estimated_annual_impact": 0,
      "why_flagged": "",
      "why_it_matters": "",
      "possible_legitimate_explanation": "",
      "recommended_action": "",
      "owner_question": "",
      "transaction_ids": [],
      "evidence": {
        "merchant_names": [],
        "date_pattern": "",
        "frequency": "",
        "amount_pattern": "",
        "total_value": 0,
        "sample_transactions": [
          {
            "id": "",
            "date": "",
            "merchant": "",
            "description": "",
            "amount": 0,
            "direction": "income | expense",
            "cardholder": "",
            "category": ""
          }
        ]
      },
      "grouped_transactions": [
        {
          "group_title": "",
          "group_reason": "",
          "total_value": 0,
          "transaction_count": 0,
          "transactions": [
            {
              "id": "",
              "date": "",
              "merchant": "",
              "description": "",
              "amount": 0,
              "direction": "income | expense",
              "cardholder": "",
              "category": ""
            }
          ]
        }
      ],
      "drilldown_sections": [
        {
          "title": "What triggered this?",
          "content": ""
        },
        {
          "title": "Why this matters",
          "content": ""
        },
        {
          "title": "What to check",
          "content": ""
        },
        {
          "title": "Transactions involved",
          "content": ""
        }
      ],
      "ui_badges": [
        "Recurring",
        "Needs review",
        "High value"
      ],
      "suggested_filters": {
        "merchant": "",
        "category": "",
        "cardholder": "",
        "date_from": "",
        "date_to": ""
      }
    }
  ],
  "quick_actions": [
    {
      "label": "",
      "description": "",
      "related_insight_ids": []
    }
  ],
  "owner_review_pack": [
    {
      "priority": 1,
      "item": "",
      "amount": 0,
      "reason": "",
      "suggested_question": "",
      "related_insight_id": ""
    }
  ],
  "missing_data": [
    {
      "field": "",
      "why_it_would_help": ""
    }
  ]
}
```

---

## 13. Quality Gate

Add this at the end of the AI prompt.

```text
Before finalising the JSON, silently check:

1. Did I return specific transaction-backed findings?
2. Did I avoid generic questions?
3. Did I avoid saying “review recurring payments” without listing vendors and amounts?
4. Did every insight include transaction_ids?
5. Did every insight explain why the issue matters?
6. Did I avoid accusations?
7. Did I include only findings supported by evidence?
8. Did I prioritise material findings?
9. Did I produce clickable, drill-down-ready objects?
10. Would a business owner learn something useful in under 30 seconds?

If the answer to any of these is no, improve the output before responding.
```

---

## 14. Few-Shot Example: Bad vs Good

Few-shot examples are important because the model otherwise tends to produce generic, robotic findings.

### Bad Insight

```text
289 recurring payment patterns detected. Review recurring payments.
```

Why this is bad:

- Too generic.
- No merchant-level detail.
- No clear risk.
- No exact action.
- Not useful.

### Good Insight

```json
{
  "id": "insight_recurring_amex_001",
  "short_title": "High-value recurring American Express payment needs review",
  "one_line_summary": "American Express 3773 appears as a recurring or repeated payment pattern, including a material £59,105.90 transaction.",
  "category": "Opaque transfer",
  "severity": "High",
  "confidence": "Medium",
  "detection_case_ids": [26, 27, 30, 40],
  "amount_at_risk": 59105.90,
  "estimated_monthly_impact": 0,
  "estimated_annual_impact": 0,
  "why_flagged": "The payment is high-value and the statement description does not explain what business cost it relates to.",
  "why_it_matters": "Large card or financing repayments can hide many smaller expenses. Without the underlying card statement, the business owner cannot see whether this relates to legitimate business spend, director expenses, financing, or personal costs.",
  "possible_legitimate_explanation": "This may be a company credit card repayment, director card settlement, or financing repayment.",
  "recommended_action": "Match this payment to the underlying American Express statement and review the top merchants included in that card bill.",
  "owner_question": "Can we confirm what costs make up the £59,105.90 American Express 3773 payment?",
  "transaction_ids": ["txn_123"],
  "evidence": {
    "merchant_names": ["AMERICAN EXP 3773"],
    "date_pattern": "Appears as a large outgoing payment",
    "frequency": "At least once in the analysed period",
    "amount_pattern": "High-value outgoing payment",
    "total_value": 59105.90,
    "sample_transactions": [
      {
        "id": "txn_123",
        "date": "2022-07-27",
        "merchant": "AMERICAN EXP 3773",
        "description": "AMERICAN EXP 3773",
        "amount": -59105.90,
        "direction": "expense",
        "cardholder": "",
        "category": "Card repayment"
      }
    ]
  },
  "grouped_transactions": [
    {
      "group_title": "American Express payments",
      "group_reason": "Large card repayments can hide underlying spend categories.",
      "total_value": 59105.90,
      "transaction_count": 1,
      "transactions": [
        {
          "id": "txn_123",
          "date": "2022-07-27",
          "merchant": "AMERICAN EXP 3773",
          "description": "AMERICAN EXP 3773",
          "amount": -59105.90,
          "direction": "expense",
          "cardholder": "",
          "category": "Card repayment"
        }
      ]
    }
  ],
  "drilldown_sections": [
    {
      "title": "What triggered this?",
      "content": "A high-value outgoing payment to American Express 3773 was found."
    },
    {
      "title": "Why this matters",
      "content": "Card repayments hide the underlying merchants, so the bank statement alone cannot confirm whether the spend was business-related."
    },
    {
      "title": "What to check",
      "content": "Open the matching Amex statement and review the largest charges, recurring subscriptions, personal-looking merchants, and cardholder allocation."
    },
    {
      "title": "Transactions involved",
      "content": "1 transaction, total £59,105.90."
    }
  ],
  "ui_badges": ["High value", "Card repayment", "Needs source statement"],
  "suggested_filters": {
    "merchant": "AMERICAN EXP 3773",
    "category": "Card repayment",
    "cardholder": "",
    "date_from": "2022-07-27",
    "date_to": "2022-07-27"
  }
}
```

---

## 15. Short Runtime Prompt

Use this shorter prompt after the application has already generated candidate findings.

```text
You are reviewing suspicious business spending patterns already detected by code.

Do not create generic insights.
Do not summarise the whole statement.
Turn each candidate into a concise, practical, transaction-backed business finding.

For each candidate:
- explain what triggered it
- explain why it matters
- include exact transactions
- include the amount at risk
- include what the owner should check next
- include one internal question
- include a possible legitimate explanation
- assign severity and confidence
- make it suitable for a clickable UI card and drill-down drawer

Return valid JSON only using the provided schema.

Candidates:
{{CANDIDATE_FINDINGS_JSON}}

Transactions:
{{RELEVANT_TRANSACTIONS_JSON}}

Business context:
{{BUSINESS_CONTEXT}}
```

---

## 16. UI Requirements: Interactive Insights

The Business Spend Review UI must be interactive.

### Current Problem

The current insights are too generic and not clickable. Users cannot easily understand what triggered the finding.

### Required Behaviour

1. Every insight card must be clickable.
2. Clicking an insight opens a right-side drawer or modal.
3. The drawer must show:
   - short summary
   - severity and confidence
   - detection case matched
   - why it was flagged
   - why it matters
   - possible legitimate explanation
   - recommended action
   - internal question to ask
   - estimated impact
   - transaction table
   - grouped transaction evidence
4. The transaction table must include:
   - date
   - merchant
   - description
   - amount
   - category
   - cardholder/stakeholder if available
5. Add filters inside the insight drawer:
   - show all involved transactions
   - same merchant
   - same category
   - same cardholder
   - same amount
   - same month
6. Add tabs:
   - Summary
   - Evidence
   - Transactions
   - Similar Payments
   - Action Plan
7. Add an “Explain this” button that converts the finding into plain English.
8. Add a “Mark as reviewed” button.
9. Add a “Looks legitimate” button.
10. Add a “Needs follow-up” button.
11. Add a “Copy question” button for the internal owner/stakeholder question.
12. Add a “Download review pack” button.
13. In the main insights list, show:
   - severity
   - confidence
   - amount at risk
   - transaction count
   - merchant/vendor names
   - detection case label
14. Do not show generic follow-up questions unless linked to a specific insight.
15. Replace the current “Follow-up Questions” section with “Owner Review Pack”, showing specific items to check.

---

## 17. Better UI Copy Examples

Replace this:

```text
289 recurring payment patterns detected
```

With this:

```text
High-value card repayment needs source review
American Express 3773 includes a £59,105.90 outgoing payment. This may be legitimate, but the bank statement does not show the underlying card transactions.
Action: match this to the Amex statement and review the top charges.
```

Replace this:

```text
Are there any vendors in this statement that the business no longer uses?
```

With this:

```text
Check whether Lebara is still needed
Lebara appears as a recurring telecom payment. Confirm whether this line is still active and who uses it.
```

Replace this:

```text
Do all cardholders have clear spending policies?
```

With this:

```text
Create or confirm cardholder spend ownership
Several payments are opaque or card-based. Assign each recurring vendor and card repayment to an owner so future reviews are easier.
```

---

## 18. Frontend Insight Card Design

Each insight card should show:

```text
[Severity badge] [Confidence badge] [Detection case badge]

Short title
One-line summary

Amount at risk: £X
Transactions: N
Merchants: Vendor A, Vendor B, Vendor C

Primary action: Review / Match source / Cancel / Confirm owner / Check policy
```

The card should be clickable.

---

## 19. Insight Drawer Design

When a user clicks an insight, open a drawer with tabs.

### Tab 1: Summary

- What triggered this?
- Why it matters
- Possible legitimate explanation
- Recommended action
- Owner question

### Tab 2: Evidence

- Merchant names
- Date pattern
- Frequency
- Amount pattern
- Total value
- Detection cases matched

### Tab 3: Transactions

- Full transaction table
- Sort by date, amount, merchant, category, cardholder
- Export selected transactions

### Tab 4: Similar Payments

- Same merchant
- Same amount
- Same category
- Same cardholder
- Same month

### Tab 5: Action Plan

- Mark as reviewed
- Looks legitimate
- Needs follow-up
- Assign owner
- Copy internal question
- Add note

---

## 20. Owner Review Pack

Replace generic follow-up questions with an owner review pack.

Example:

```json
[
  {
    "priority": 1,
    "item": "Match American Express 3773 payment to source card statement",
    "amount": 59105.90,
    "reason": "Large card repayments hide the underlying merchants and cardholders.",
    "suggested_question": "Can we confirm what costs make up the £59,105.90 Amex payment?",
    "related_insight_id": "insight_recurring_amex_001"
  },
  {
    "priority": 2,
    "item": "Confirm whether Lebara line is still active",
    "amount": 135.06,
    "reason": "Recurring telecom payment may be an old contract or stakeholder phone bill.",
    "suggested_question": "Who owns this Lebara line and is it still required?",
    "related_insight_id": "insight_telecom_lebara_001"
  }
]
```

---

## 21. Product Rule: No Generic Questions

The product should not show broad questions like:

- Are there any vendors the business no longer uses?
- Do all cardholders have clear policies?
- When was the last time costs were benchmarked?

Those questions are not wrong, but they are too generic.

Instead, every question should be tied to an actual transaction or pattern:

- Who owns the £59,105.90 American Express 3773 payment?
- Is the Lebara line still active and who uses it?
- Why were there three design-tool subscriptions in the same month?
- Are these PayPal payments linked to business vendors or personal purchases?
- Why did one cardholder spend 3x more than the others this month?

---

## 22. Implementation Notes for AI Integration

If using DeepSeek JSON output, configure the API to return structured JSON and include the word `json` in the prompt. Also provide an example JSON object and use a sufficiently high `max_tokens` limit so the response is not cut off.

Recommended approach:

```json
{
  "response_format": {
    "type": "json_object"
  },
  "max_tokens": 12000
}
```

The app should validate the JSON before rendering it.

If JSON parsing fails:

1. Retry once with a repair prompt.
2. If still invalid, fall back to deterministic findings.
3. Never show broken or generic AI text to the user.

---

## 23. Business Model

### Freemium Subscription Model

| Tier | Price | Features |
|------|-------|----------|
| Free | £0 | 2 statements/month, basic categorisation, limited insights |
| Pro | £7.99/month | Unlimited statements, full AI insights, cash-flow forecasts, export to CSV/PDF |
| Family | £12.99/month | Pro features for up to 4 household members, shared insights, joint account support |
| Business Review | £19.99/report | One-off business spend review, downloadable report, owner review pack |
| Business Pro | £29.99/month | Monthly business reviews, vendor tracking, recurring payment monitoring, exportable reports |

### Additional Revenue Streams

- White-label licensing for accountants, mortgage brokers, financial coaches, and consultants.
- Per-report B2B pricing.
- Referral partnerships, where appropriate and compliant.
- Premium downloadable financial health reports.

---

## 24. Roadmap

### Phase 1: Launch

- PDF and CSV parsing for major UK banks
- Basic transaction categorisation
- Business Spend Review prompt
- Deterministic candidate detection engine
- AI insight writer
- Interactive insight cards and drawer
- Downloadable review pack

### Phase 2: Better Evidence

- Multi-statement comparison
- Recurring vendor tracking
- Duplicate subscription detection
- Cardholder/stakeholder tagging
- Manual category corrections
- Merchant clean-up
- Confidence scoring

### Phase 3: Monetisation

- One-off business reports
- Business Pro subscription
- White-label API
- Accountant/coach dashboard
- Exportable PDF reports

### Phase 4: Intelligence

- Predictive cash-flow analysis
- Vendor benchmarking
- Anomaly detection
- Policy-gap detection
- Natural language questions over transactions

---

## 25. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| AI produces generic insights | Use deterministic detectors first, strict JSON schema, few-shot examples, quality gate |
| AI hallucinates | Require transaction IDs and evidence for every insight |
| User loses trust | Use careful language and show exact evidence |
| PDF parsing errors | Add confidence scoring, manual correction, and source transaction links |
| Privacy concerns | Do not persist raw statements by default, minimise data sent to AI |
| Regulatory risk | Avoid financial advice wording and present outputs as business review guidance |
| Too many weak findings | Limit to strongest 12 findings and prioritise materiality |
| UI feels static | Make every insight clickable with drill-down evidence and actions |

---

## 26. Key Metrics

- Number of statements uploaded
- Percentage of uploads producing at least 3 useful transaction-backed findings
- Insight click-through rate
- Marked-as-reviewed rate
- Findings exported or copied
- Monthly recurring vendors detected
- Estimated savings identified
- User return rate within 30 days
- Conversion from free report to paid report
- B2B report volume

---

## 27. Definition of a Useful Insight

An insight is useful only if it is:

- specific
- tied to transactions
- easy to understand
- actionable
- prioritised by severity
- supported by evidence
- careful with accusations
- clear about possible legitimate explanations
- visible in the UI as a clickable object

The user should be able to learn something useful in under 30 seconds.

---

## 28. Ask

Initial funding requirement: £150,000-£250,000.

Use of funds:

- 40% engineering: parsing, detection engine, AI integration, interactive UI
- 25% marketing: SEO, paid acquisition, business-owner content
- 20% AI and infrastructure: structured outputs, evaluation, model fallback, data minimisation
- 10% legal/compliance: privacy policy, disclaimers, data processing, financial advice boundaries
- 5% design and UX research

Team needed:

- 1 full-stack engineer
- 1 product-minded AI engineer or data engineer
- 1 marketing/growth lead
- part-time designer
- part-time legal/compliance advisor

---

## 29. Appendix: Comparison with RiseUp

| Dimension | RiseUp | Statement Reader |
|-----------|--------|------------------|
| Primary use case | Ongoing money coaching | Instant statement-based financial health check |
| Data source | Open Banking connection | PDF/CSV upload first, Open Banking optional later |
| Onboarding | Bank connection required | Upload file and analyse |
| Business use case | Financial wellbeing | Business spend review and control analysis |
| AI role | Coaching and insights | Transaction-backed red-flag detection and review actions |
| Privacy positioning | Connected data model | Session-first, upload-based, data minimisation |
| Best user moment | Ongoing budgeting | One-off clarity, business review, affordability, cost control |
| Output | App dashboard | Interactive findings, evidence drawer, owner review pack |

---

## 30. Summary

Statement Reader should not be a generic spending dashboard.

The winning product is a practical, evidence-backed review tool that finds the financial issues a business owner does not have time to spot manually.

The product must move from:

> Here are your categories.

To:

> Here are the 7 things you should review this month, why they matter, the transactions behind them, and the exact question to ask internally.