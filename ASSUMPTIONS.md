# Susu (Rotating Savings & Credit Group) — Rules & Assumptions

This document outlines the rules, mathematical guarantees, and architectural assumptions implemented in the Susu Rotating Savings Manager.

---

## 1. Exact Currency Handling & Zero Rounding Errors
* **Currency**: Ghanaian Cedi (`GHS`).
* **Sub-unit**: Pesewas (`1 GHS = 100 Pesewas`).
* **Implementation**: All internal monetary storage and arithmetic are performed strictly in integer Pesewas.
* **Floating-Point Avoidance**: String inputs (e.g. `"50.00"`, `"30"`) are parsed using string splitting and integer conversion rather than `parseFloat() * 100`. This completely eliminates binary floating-point representation anomalies (e.g., `0.1 + 0.2 !== 0.3` or `50.29 * 100 = 5028.999999999999`).
* **Validation**:
  * Negative amounts and zero (`<= 0.00 GHS`) are strictly rejected.
  * Inputs with more than two decimal places (fractional pesewas) are rejected.

---

## 2. Member Identification & Join Order
* **Identifier**: Member names or IDs must be non-empty strings.
* **Uniqueness**: Names are matched case-insensitively for uniqueness check (e.g. `"Ama"` and `"ama"` are considered duplicates).
* **Payout Sequence**: Payout priority follows the strict sequential order in which members joined the group (`joinOrder`: 1, 2, 3, ...).

---

## 3. Adding Members Mid-Cycle (Uncovered by Prompt)
* **Rule Enforced**: **Roster Locking**.
* **Rationale**: In a traditional rotating savings group (susu/esusu/chit fund), the total weekly pot (`Members Count × Weekly Contribution`) and the duration of the cycle (`N Weeks for N Members`) depend directly on a fixed roster.
* **Policy**:
  * Members may be freely added prior to the recording of any contributions in Week 1.
  * Once the first contribution for Week 1 has been recorded or after any week has closed, the member roster is locked.
  * Attempting to add a member mid-cycle will be rejected with an informative error:
    `"Cannot add new members after contributions have started for the cycle. The roster is locked to ensure fixed pot size and rotation integrity."`
  * Minimum membership: A group must have at least 2 members before closing a week.

---

## 4. Weekly Contribution Rules & Partial Payments
* **Fixed Weekly Contribution**: Each group specifies a fixed weekly contribution amount in GHS at creation time (e.g., `50.00 GHS`).
* **Partial Payments**: Allowed. A member may make multiple partial payments throughout an open week until their balance is cleared.
* **Overpayment Prevention**: Payments exceeding a member's remaining owed balance for that week are strictly rejected.
  * *Example*: If weekly due is `50.00 GHS`, and Ama has already contributed `30.00 GHS`, she owes `20.00 GHS`. A payment attempt of `25.00 GHS` is rejected:
    `"Payment of 25.00 GHS exceeds remaining amount owed for week 1. Member Ama currently owes 20.00 GHS (paid: 30.00 GHS of 50.00 GHS)."`
* **Active Week Enforcement**: Contributions can only be recorded for the currently open week.
  * Paying for an already closed week is rejected (`"Week X is already closed."`).
  * Paying for future un-opened weeks is rejected (`"Cannot pay for future week Y; current active week is X."`).

---

## 5. Closing a Week & Payout Rules
* **Condition**: A week can only be closed and paid out if **every** registered member has contributed their weekly amount in full (`paid == weeklyAmount`).
* **If Not Fully Paid**:
  * Pot is **not** paid out.
  * The current week remains open.
  * The system generates a report listing every member with outstanding dues and the exact amount each owes.
* **If Fully Paid**:
  * The entire pot (`Member Count × Weekly Contribution`) is disbursed to the next member in join order.
  * The payout is permanently recorded in the payout history with timestamp, week number, recipient name, and pot amount.
  * The system transitions to the next week (`currentWeek = currentWeek + 1`).
  * Weekly contribution balances are reset for the new week.

---

## 6. Cycle Completion
* When all $N$ members in an $N$-member group have received their weekly pot payout, the cycle is marked as **Cycle Completed**.
* All members have both contributed $N \times \text{Weekly Amount}$ and exactly one member received the full pot each week.
* The system prevents further week closures for a completed cycle unless a new round is explicitly initialized.

---

## 7. Verification of Prompt Example
* **Group**: 3 members (`Ama`, `Kofi`, `Esi`), weekly amount `50.00 GHS`.
* **Step 1**: Ama pays `50.00`, Kofi pays `50.00`, Esi pays `30.00`.
* **Step 2**: Close week 1 $\rightarrow$ Rejects with `"Esi owes 20.00 GHS"`. No payout is made.
* **Step 3**: Esi pays `20.00 GHS`.
* **Step 4**: Close week 1 $\rightarrow$ Week 1 closes! Ama (Member 1) receives `150.00 GHS`.
* **Step 5**: Week 2 begins, and Kofi (Member 2) is next in line.
