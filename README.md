# Susu Rotating Savings Group Manager

A precision financial tracking and payout automation program that manages a rotating savings and credit association (**Susu / ROSCA**) in Ghanaian Cedi (`GHS`).

Members contribute a fixed sum each week into a communal pot. Each week, the accumulated pot is paid out to one member in the exact sequence in which they joined the group, provided that every member has paid their dues in full.


## Prerequisites

- **Node.js** (v18 or higher recommended)
- **npm** (comes with Node.js)

---

## Quick Start: Running the Program and Tests

### 1. Run the Automated Tests (10 Test Specs)
The project includes 10 automated test specs (exceeding the 6-test requirement), with dedicated test cases for **partial payments**, **"week cannot close" debtor withholding**, **overpayment rejection**, **payout rotations**, and **exact integer pesewas arithmetic**.

```bash
npm test
```

#### What the tests verify:
1. **Partial Payments**: Correctly records partial payment (e.g. paying `30.00 GHS` out of `50.00 GHS`), tracks remaining debt (`20.00 GHS`), and updates balance to `0.00 GHS` upon paying the remainder.
2. **Week Cannot Close**: Verifies that when any member owes dues, `closeWeek()` returns `success: false`, withholds the pot, keeps the week open, and returns the debtor list (`"Esi owes 20.00 GHS"`).
3. **Week Closure & Pot Disbursement**: Verifies that when 100% of members have paid, the pot (`Members × Weekly Amount = 150.00 GHS`) is paid to the next recipient in join order (Ama), logged in payout history, and the system advances to Week 2.
4. **Overpayment Rejection**: Rejects payments exceeding what a member currently owes for that week (e.g. attempting to pay `25.00 GHS` when owing `20.00 GHS`).
5. **Unknown Member Rejection**: Rejects contributions from unregistered names/IDs.
6. **Duplicate Member Rejection**: Enforces case-insensitive member uniqueness upon enrollment.
7. **Zero & Negative Amount Rejection**: Rejects payments $\le 0.00\text{ GHS}$ and sub-pesewa fractions ($> 2$ decimal places).
8. **Exact Money Handling**: Proves that string splitting and integer pesewas math avoid floating-point representation anomalies (`33.33 * 3 = 99.99 GHS = 9999 pesewas`).
9. **Roster Locking Assumption**: Proves that new members cannot be enrolled once Week 1 contributions begin.
10. **Full Cycle Rotation**: Simulates an entire $N$-week cycle where every member receives the pot exactly once.

---

### 2. Run the Interactive CLI & Simple Menu
To launch the interactive command-line interface with a simple numbered menu:

```bash
npm run cli
```

Menu options:
```text
╔════════════════════════════════════════════════════════════════╗
║               SUSU ROTATING SAVINGS MANAGER                    ║
║        Ghanaian Cedi (GHS) Exact Integer Pesewas Engine        ║
╚════════════════════════════════════════════════════════════════╝

MAIN MENU:
  1) Create New Susu Group (Fixed weekly contribution)
  2) Add Member (Unique name/ID, in payout rotation order)
  3) Record Contribution (Member, week, amount — partial allowed)
  4) Close Week (Verifies full payment, pays out pot in order)
  5) Show Status Report (Current week, balances, payout history)
  6) Run Example from Prompt (Ama, Kofi, Esi @ 50.00 GHS)
  7) Run Full Rules & Validation Test Suite
  8) Display System Rules & Assumptions
  0) Exit
```

---

### 3. Run the Exact Prompt Scenario Directly
To execute the prompt's reference scenario (Ama, Kofi, and Esi contributing `50.00 GHS/week`, closing failure on debt, debt settlement, and Week 1 pot disbursement):

```bash
npm run example
```

---

### 4. Run the Full Application (Web Console + REST API Server)
To start the Express server and Vite development frontend:

```bash
npm run dev
```

The app will be available on **http://localhost:3000** (or your assigned cloud preview URL).

---

## Using the Small REST API

The application exposes a lightweight REST API running on port 3000:

| Method | Endpoint | Description | Example Payload / cURL |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/group/report` | Returns full JSON state & ASCII report | `curl -s http://localhost:3000/api/group/report` |
| **POST** | `/api/group/create` | Initializes a new group | `curl -s -X POST http://localhost:3000/api/group/create -H "Content-Type: application/json" -d '{"name":"AccraTraders","weeklyContributionGhs":"50.00"}'` |
| **POST** | `/api/group/members` | Adds a member in join order | `curl -s -X POST http://localhost:3000/api/group/members -H "Content-Type: application/json" -d '{"name":"Kwame"}'` |
| **POST** | `/api/group/contribute` | Records a payment (partial allowed) | `curl -s -X POST http://localhost:3000/api/group/contribute -H "Content-Type: application/json" -d '{"memberName":"Ama","week":1,"amountGhs":"50.00"}'` |
| **POST** | `/api/group/close-week`| Closes week & disburses pot if paid | `curl -s -X POST http://localhost:3000/api/group/close-week -H "Content-Type: application/json" -d '{"week":1}'` |
| **POST** | `/api/demo/run-example`| Runs prompt example and returns log | `curl -s -X POST http://localhost:3000/api/demo/run-example` |
| **GET** | `/api/demo/run-tests`  | Runs the validation suite | `curl -s http://localhost:3000/api/demo/run-tests` |

---

## Project Structure

```text
├── README.md                 # Setup, usage, and test documentation
├── NOTES.md                  # Assumptions, design decisions & future roadmap
├── ASSUMPTIONS.md            # Detailed business rules and mathematical specs
├── server.ts                 # Express REST API server & Vite dev integration
├── package.json              # Scripts: dev, start, test, cli, example, lint
├── src/
│   ├── cli.ts                # Standalone Node.js interactive menu CLI
│   ├── App.tsx               # Web Dashboard, Interactive REPL & API Explorer
│   └── susu/
│       ├── currency.ts       # Exact integer pesewas parser & arithmetic
│       ├── types.ts          # TypeScript type definitions
│       ├── SusuGroup.ts      # Core Susu business logic & validation
│       ├── demo.ts           # Prompt scenario runner & test helper
│       └── susu.test.ts      # Automated test suite (10 test cases)
```
