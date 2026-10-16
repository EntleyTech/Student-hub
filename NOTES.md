# NOTES.md — Architectural Decisions, Assumptions & Future Roadmap

This document details the engineering choices, domain assumptions, and future enhancements for the **Susu Rotating Savings Group Manager**.

---

## 1. Assumptions & Edge Cases Handled

The original problem specification left several practical domain edge cases open. The following explicit rules were established and enforced:

### A. Adding Members After Week 1 Commences (Roster Locking)
* **The Dilemma**: In real-world rotating savings groups (Susu, Esusu, Chit Funds, Tontines), the total weekly payout pot is strictly defined as:
  $$\text{Pot} = N \times \text{Weekly Contribution}$$
  where $N$ is the total member count. Furthermore, the duration of one complete rotation is exactly $N$ weeks. If a new member joins mid-cycle (e.g., in Week 2 of 3), the pot size fluctuates unpredictably, early recipients would have received a smaller pot than later recipients, and the rotation order is disrupted.
* **The Enforced Rule**: **Roster Locking**. Members may only be enrolled during group initialization. Once the first contribution for Week 1 has been recorded or any week has closed, the member roster is locked. Any subsequent `addMember()` call is rejected with a descriptive error.
* **Minimum Group Size**: A group requires at least 2 members before any week can close.

### B. Contribution Timing & Active Week Scope
* **The Rule**: Contributions may only be recorded for the **currently active (open) week**.
* **Prepayments & Backpayments**:
  - Paying for an already closed week is rejected (`"Week X is already closed and paid out."`).
  - Prepaying for future unopened weeks is rejected (`"Cannot contribute to future Week Y while Week X is open."`). This prevents ledger desynchronization and ensures that every member is held accountable to the active week's deadline.

### C. Overpayment Prevention & Partial Payment Semantics
* **The Rule**: Members may pay in fractional installments (e.g., `30.00 GHS` followed by `20.00 GHS`). However, **any payment exceeding a member's remaining owed balance for that week is strictly rejected** (e.g., if owing `20.00 GHS`, attempting to pay `25.00 GHS` throws an error specifying the exact debt).
* **Rationale**: Carrying unallocated surplus balances across weeks introduces credit liabilities that belong to the member, not the communal pot. Rejecting overpayments enforces clear bookkeeping.

### D. Zero and Negative Payments
* Any payment $\le 0.00\text{ GHS}$ is rejected as invalid. Sub-pesewa fractions (e.g., `50.005 GHS`) are also rejected, as physical currency cannot be split beyond 1 Pesewa.

### E. Cycle Completion
* When all $N$ members in an $N$-member group have received their weekly pot (i.e. $N$ weeks have successfully closed), the cycle is marked as **Completed**. Further week closures are prevented unless a new round is initiated.

---

## 2. Architectural Decisions Made

### A. Language & Runtime: TypeScript on Node.js
* **Decision**: Implemented in **TypeScript** using Node.js.
* **Rationale**: TypeScript provides static compile-time type safety for complex financial domain types (`Member`, `Contribution`, `Payout`, `CloseWeekResult`, `SusuReport`), while running seamlessly in both Node.js command-line environments and modern browser engines without external binary compilation steps.

### B. Zero Rounding Errors: Exact Integer Pesewas Representation
* **Decision**: All internal financial storage, arithmetic, and validation are conducted strictly in integer Pesewas (`1 GHS = 100 Pesewas`).
* **Implementation**: Rather than relying on floating-point multiplication (e.g., `parseFloat("50.29") * 100 = 5028.999999999999`), currency strings are parsed using string splitting (`part[0] * 100 + part[1]`). This guarantees that:
  - `33.33 GHS + 33.33 GHS + 33.33 GHS` always equals `99.99 GHS` (exactly `9999 pesewas`).
  - Balance comparisons never suffer from epsilon inaccuracies (`amountPesewas === owedPesewas`).

### C. Multi-Interface Accessibility (CLI, Simple Menu, REST API & Dashboard)
* **Decision**: While the initial prompt permitted choosing between a CLI, a simple menu, or a small API, we delivered **all three unified around the exact same core engine**:
  1. A standalone Node.js CLI with an interactive numbered text menu (`npm run cli`).
  2. An Express REST API (`server.ts`) for headless curl/HTTP integration.
  3. A high-density visual dashboard with real member portraits and an integrated terminal REPL for interactive evaluation.

### D. Separation of Pure Domain Logic from I/O
* **Decision**: `SusuGroup.ts` contains zero HTTP, DOM, or CLI dependencies. It is an entirely pure domain model that can be consumed identically by unit tests, server endpoints, or client-side consoles.

---

## 3. What I Would Improve With More Time

If expanding this project into an enterprise-grade production financial product, I would prioritize the following enhancements:

### 1. Persistent Database & ACID Transactions
* **Current State**: Uses an in-memory repository (ideal for unit testing and instant evaluation).
* **Improvement**: Back the engine with **PostgreSQL** using an ORM like Drizzle or Prisma. All contributions and week-closing payouts would be executed within strict `BEGIN ... COMMIT` database transactions with row-level locks (`SELECT ... FOR UPDATE`) to eliminate race conditions if two members pay simultaneously.

### 2. Mobile Money (MoMo) & Payment Gateway Integration
* **Context**: In Ghana, the vast majority of susu contributions happen via Mobile Money (MTN MoMo, Vodafone/Telecel Cash, AirtelTigo).
* **Improvement**: Integrate webhooks with gateways like **Paystack** or **Flutterwave** to automatically reconcile incoming MoMo payments directly against a member's active week debt.

### 3. Default Management, Collateral & Guarantor Models
* **The Challenge**: A fundamental risk in real-world Susu groups is member default after receiving an early pot (e.g. Member #1 receives the pot in Week 1, then stops paying in Week 2).
* **Improvement**:
  - Implement a **Guarantor System**: each member requires an existing member to vouch for them.
  - Implement **Security Deposits / Collateral Escrow**: members deposit 1–2 weeks of buffer funds prior to cycle launch.
  - Add **Late Payment Penalty Fees** (e.g., 5% penalty per day overdue), with penalty pools redistributed to members who paid on time.

### 4. Auction / Bidding Susu Variation (Chit Fund Model)
* In certain rotating savings traditions (e.g., Indian Chit Funds or discounted ROSCAs), members who urgently need capital bid for the pot by offering a discount (e.g., accepting `130.00 GHS` instead of `150.00 GHS`). The `20.00 GHS` discount is then distributed as an immediate dividend back to all other members. Adding support for both fixed-order and auction-based payout selection would broaden market applicability.

### 5. Automated Notification Dispatch (SMS / WhatsApp)
* Integrate **Twilio** or **Hubtel** (Ghana SMS gateway) to trigger automated reminders 24 hours prior to week closure detailing:
  - `"Hi Esi, Week 1 closes tomorrow. Your remaining Susu balance is GHS 20.00."`
  - Instant payout notifications upon week closure: `"Congratulations Ama! Week 1 closed and your pot of GHS 150.00 has been disbursed."`

### 6. Multi-Factor Payout Authorization
* Require the group administrator and at least two peer members to cryptographically co-sign (or confirm via OTP) before a large pot is disbursed, preventing rogue single-administrator payouts.
