import { SusuGroup, SusuError } from './SusuGroup.ts';
import { formatGHS, formatPesewas, CurrencyError } from './currency.ts';

interface TestCase {
  name: string;
  fn: () => void;
}

export const testSuite: TestCase[] = [
  // 1. Partial payment test
  {
    name: '1. Partial Payments: Correctly records partial payment and tracks exact remaining owed balance',
    fn: () => {
      const group = new SusuGroup('Partial Pay Test', '50.00');
      group.addMember('Ama');
      group.addMember('Kofi');

      // Ama pays 30.00 GHS (partial payment)
      const res1 = group.recordContribution('Ama', 1, '30.00');
      if (res1.amountPaidPesewas !== 3000) {
        throw new Error(`Expected paid pesewas to be 3000, got ${res1.amountPaidPesewas}`);
      }
      if (res1.totalPaidThisWeekPesewas !== 3000) {
        throw new Error(`Expected total paid to be 3000, got ${res1.totalPaidThisWeekPesewas}`);
      }
      if (res1.remainingOwedPesewas !== 2000) {
        throw new Error(`Expected remaining owed to be 2000, got ${res1.remainingOwedPesewas}`);
      }

      // Check report reflects partial payment status
      const report1 = group.getReport();
      const amaStatus1 = report1.membersStatus.find((m) => m.memberName === 'Ama');
      if (!amaStatus1 || amaStatus1.isPaidInFull || amaStatus1.owedPesewas !== 2000) {
        throw new Error(`Report did not reflect Ama owing 2000 pesewas: ${JSON.stringify(amaStatus1)}`);
      }

      // Ama pays the second installment of 20.00 GHS
      const res2 = group.recordContribution('Ama', 1, '20.00');
      if (res2.amountPaidPesewas !== 2000) {
        throw new Error(`Expected paid pesewas to be 2000, got ${res2.amountPaidPesewas}`);
      }
      if (res2.totalPaidThisWeekPesewas !== 5000) {
        throw new Error(`Expected total paid to be 5000, got ${res2.totalPaidThisWeekPesewas}`);
      }
      if (res2.remainingOwedPesewas !== 0) {
        throw new Error(`Expected remaining owed to be 0, got ${res2.remainingOwedPesewas}`);
      }

      const report2 = group.getReport();
      const amaStatus2 = report2.membersStatus.find((m) => m.memberName === 'Ama');
      if (!amaStatus2 || !amaStatus2.isPaidInFull || amaStatus2.owedPesewas !== 0) {
        throw new Error(`Report did not reflect Ama as paid in full: ${JSON.stringify(amaStatus2)}`);
      }
    },
  },

  // 2. "Week cannot close" case
  {
    name: '2. Week Cannot Close: Rejects week closure and withholds pot when any member owes dues',
    fn: () => {
      const group = new SusuGroup('Unpaid Close Test', '50.00');
      group.addMember('Ama');
      group.addMember('Kofi');
      group.addMember('Esi');

      // Ama & Kofi pay full 50.00; Esi pays partial 30.00 (owes 20.00)
      group.recordContribution('Ama', 1, '50.00');
      group.recordContribution('Kofi', 1, '50.00');
      group.recordContribution('Esi', 1, '30.00');

      // Attempt to close Week 1
      const closeResult = group.closeWeek(1);

      // Verify closure failed
      if (closeResult.success !== false) {
        throw new Error('Expected closeWeek to return success = false when member owes dues');
      }

      // Verify pot is NOT paid out
      if (closeResult.payout !== undefined) {
        throw new Error('Payout must NOT be generated when week closure fails');
      }

      // Verify current week has NOT advanced
      if (group.getCurrentWeek() !== 1) {
        throw new Error(`Current week must remain 1, found: ${group.getCurrentWeek()}`);
      }

      // Verify debtors are properly reported
      if (!closeResult.unpaidMembers || closeResult.unpaidMembers.length !== 1) {
        throw new Error(`Expected exactly 1 unpaid member, found: ${JSON.stringify(closeResult.unpaidMembers)}`);
      }
      const debtor = closeResult.unpaidMembers[0];
      if (debtor.memberName !== 'Esi' || debtor.owesPesewas !== 2000) {
        throw new Error(`Expected Esi to owe 2000 pesewas, got: ${JSON.stringify(debtor)}`);
      }

      // Verify error message formatting
      if (!closeResult.message.includes('Esi owes 20.00 GHS')) {
        throw new Error(`Expected message to state "Esi owes 20.00 GHS", got: "${closeResult.message}"`);
      }
    },
  },

  // 3. Week closure & pot disbursement
  {
    name: '3. Week Closure & Pot Disbursement: Pays full pot to next member in join order when 100% paid',
    fn: () => {
      const group = new SusuGroup('Payout Test', '50.00');
      group.addMember('Ama');
      group.addMember('Kofi');
      group.addMember('Esi');

      // Everyone pays in full for Week 1
      group.recordContribution('Ama', 1, '50.00');
      group.recordContribution('Kofi', 1, '50.00');
      group.recordContribution('Esi', 1, '50.00');

      const closeResult = group.closeWeek(1);

      if (!closeResult.success) {
        throw new Error(`Expected week 1 close to succeed: ${closeResult.message}`);
      }

      // Payout goes to Ama (Order #1)
      if (!closeResult.payout || closeResult.payout.recipientName !== 'Ama') {
        throw new Error(`Expected recipient to be Ama, got: ${closeResult.payout?.recipientName}`);
      }

      // Pot is 3 members * 50.00 GHS = 150.00 GHS (15000 pesewas)
      if (closeResult.payout.potAmountPesewas !== 15000) {
        throw new Error(`Expected pot of 15000 pesewas, got: ${closeResult.payout.potAmountPesewas}`);
      }

      // Next active week is now Week 2
      if (group.getCurrentWeek() !== 2) {
        throw new Error(`Expected active week to advance to 2, got: ${group.getCurrentWeek()}`);
      }

      // Next recipient in line is Kofi (Order #2)
      const report = group.getReport();
      if (report.nextRecipientInOrder !== 'Kofi') {
        throw new Error(`Expected next recipient to be Kofi, got: ${report.nextRecipientInOrder}`);
      }

      // Payout is in history
      if (report.payoutHistory.length !== 1 || report.payoutHistory[0].recipientName !== 'Ama') {
        throw new Error('Payout history not updated correctly');
      }
    },
  },

  // 4. Overpayment rejection
  {
    name: '4. Validation: Strictly rejects payments above what a member owes for that week',
    fn: () => {
      const group = new SusuGroup('Overpay Test', '50.00');
      group.addMember('Ama');
      group.addMember('Kofi');

      group.recordContribution('Ama', 1, '30.00'); // Ama owes 20.00

      let rejected = false;
      try {
        group.recordContribution('Ama', 1, '25.00'); // Tries to pay 25.00 > 20.00
      } catch (err: any) {
        rejected = true;
        if (!err.message.includes('exceeds remaining amount owed')) {
          throw new Error(`Unexpected error message: ${err.message}`);
        }
      }

      if (!rejected) {
        throw new Error('Failed to reject overpayment of 25.00 GHS when member only owes 20.00 GHS');
      }

      // Paying exact owed 20.00 GHS succeeds
      group.recordContribution('Ama', 1, '20.00');

      // Attempting any further payment after full payment is rejected
      let rejectedFurther = false;
      try {
        group.recordContribution('Ama', 1, '5.00');
      } catch (err: any) {
        rejectedFurther = true;
      }
      if (!rejectedFurther) {
        throw new Error('Failed to reject payment when member has already paid in full');
      }
    },
  },

  // 5. Unknown member rejection
  {
    name: '5. Validation: Rejects contributions from unknown/unregistered members',
    fn: () => {
      const group = new SusuGroup('Unknown Member Test', '50.00');
      group.addMember('Ama');
      group.addMember('Kofi');

      let rejected = false;
      try {
        group.recordContribution('Stranger', 1, '50.00');
      } catch (err: any) {
        rejected = true;
        if (!err.message.includes('Unknown member')) {
          throw new Error(`Unexpected error message: ${err.message}`);
        }
      }

      if (!rejected) {
        throw new Error('Failed to reject contribution from unknown member');
      }
    },
  },

  // 6. Duplicate member rejection
  {
    name: '6. Validation: Rejects duplicate member enrollments (case-insensitive)',
    fn: () => {
      const group = new SusuGroup('Duplicate Member Test', '50.00');
      group.addMember('Kwame');

      let rejected = false;
      try {
        group.addMember('kwame'); // Lowercase duplicate
      } catch (err: any) {
        rejected = true;
        if (!err.message.includes('Duplicate member')) {
          throw new Error(`Unexpected error message: ${err.message}`);
        }
      }

      if (!rejected) {
        throw new Error('Failed to reject duplicate member enrollment');
      }

      if (group.getMembers().length !== 1) {
        throw new Error(`Expected exactly 1 member, got: ${group.getMembers().length}`);
      }
    },
  },

  // 7. Zero and negative amount rejection
  {
    name: '7. Validation: Rejects zero, negative, and invalid currency amounts',
    fn: () => {
      const group = new SusuGroup('Zero Negative Test', '50.00');
      group.addMember('Ama');
      group.addMember('Kofi');

      // Zero amount
      let zeroRejected = false;
      try {
        group.recordContribution('Ama', 1, '0.00');
      } catch (err: any) {
        zeroRejected = true;
      }
      if (!zeroRejected) throw new Error('Failed to reject zero payment');

      // Negative amount
      let negativeRejected = false;
      try {
        group.recordContribution('Ama', 1, '-25.00');
      } catch (err: any) {
        negativeRejected = true;
      }
      if (!negativeRejected) throw new Error('Failed to reject negative payment');

      // Fractional pesewas (> 2 decimal places)
      let fractionalRejected = false;
      try {
        group.recordContribution('Ama', 1, '25.005');
      } catch (err: any) {
        fractionalRejected = true;
      }
      if (!fractionalRejected) throw new Error('Failed to reject sub-pesewa fraction');
    },
  },

  // 8. Exact money calculation (No floating point errors)
  {
    name: '8. Exact Money Handling: Guarantees zero floating-point rounding errors',
    fn: () => {
      // 33.33 * 3 in floating point is 99.99000000000001
      const group = new SusuGroup('Precision Test', '33.33');
      group.addMember('A');
      group.addMember('B');
      group.addMember('C');

      // Partial payments with tricky decimals
      group.recordContribution('A', 1, '10.10');
      group.recordContribution('A', 1, '23.23'); // 10.10 + 23.23 = 33.33 exactly

      const statusA = group.getReport().membersStatus.find((m) => m.memberName === 'A');
      if (!statusA || statusA.paidPesewas !== 3333 || statusA.owedPesewas !== 0) {
        throw new Error(`Exact money failed: paid=${statusA?.paidPesewas}, owed=${statusA?.owedPesewas}`);
      }

      group.recordContribution('B', 1, '33.33');
      group.recordContribution('C', 1, '33.33');

      const res = group.closeWeek(1);
      if (!res.success) throw new Error('Week 1 close failed');

      // Expected pot: 33.33 * 3 = 99.99 GHS (9999 pesewas)
      if (res.payout?.potAmountPesewas !== 9999) {
        throw new Error(`Expected pot of 9999 pesewas, got: ${res.payout?.potAmountPesewas}`);
      }
      if (formatGHS(res.payout.potAmountPesewas) !== 'GHS 99.99') {
        throw new Error(`Expected format "GHS 99.99", got: "${formatGHS(res.payout.potAmountPesewas)}"`);
      }
    },
  },

  // 9. Roster locking assumption
  {
    name: '9. Assumption: Locks roster once contributions commence to preserve pot and cycle integrity',
    fn: () => {
      const group = new SusuGroup('Lock Roster Test', '50.00');
      group.addMember('Ama');
      group.addMember('Kofi');

      // Week 1 contribution starts
      group.recordContribution('Ama', 1, '50.00');

      let rejected = false;
      try {
        group.addMember('Latecomer');
      } catch (err: any) {
        rejected = true;
        if (!err.message.includes('locked')) {
          throw new Error(`Unexpected error message: ${err.message}`);
        }
      }

      if (!rejected) {
        throw new Error('Failed to reject adding a member after contributions started');
      }
    },
  },

  // 10. Full cycle rotation
  {
    name: '10. Full Rotation Cycle: Every member receives the pot exactly once across N weeks',
    fn: () => {
      const group = new SusuGroup('Full Rotation Test', '100.00');
      group.addMember('Ama');
      group.addMember('Kofi');
      group.addMember('Esi');

      // Week 1 -> Ama receives 300
      group.recordContribution('Ama', 1, '100.00');
      group.recordContribution('Kofi', 1, '100.00');
      group.recordContribution('Esi', 1, '100.00');
      const w1 = group.closeWeek(1);
      if (!w1.success || w1.payout?.recipientName !== 'Ama' || w1.payout.potAmountPesewas !== 30000) {
        throw new Error('Week 1 payout to Ama failed');
      }

      // Week 2 -> Kofi receives 300
      group.recordContribution('Ama', 2, '100.00');
      group.recordContribution('Kofi', 2, '100.00');
      group.recordContribution('Esi', 2, '100.00');
      const w2 = group.closeWeek(2);
      if (!w2.success || w2.payout?.recipientName !== 'Kofi' || w2.payout.potAmountPesewas !== 30000) {
        throw new Error('Week 2 payout to Kofi failed');
      }

      // Week 3 -> Esi receives 300 and completes cycle
      group.recordContribution('Ama', 3, '100.00');
      group.recordContribution('Kofi', 3, '100.00');
      group.recordContribution('Esi', 3, '100.00');
      const w3 = group.closeWeek(3);
      if (!w3.success || w3.payout?.recipientName !== 'Esi' || !w3.cycleCompleted) {
        throw new Error('Week 3 payout to Esi or cycle completion failed');
      }

      // All 3 members have received their payout
      const rep = group.getReport();
      if (!rep.cycleCompleted) throw new Error('Expected cycleCompleted to be true');
      if (rep.payoutHistory.length !== 3) throw new Error('Expected 3 historical payouts');
    },
  },
];

export function runAllTests(): { passed: number; total: number; allPassed: boolean } {
  console.log('================================================================');
  console.log('       SUSU ROTATING SAVINGS GROUP — AUTOMATED TEST SUITE        ');
  console.log('================================================================');

  let passed = 0;
  for (const test of testSuite) {
    try {
      test.fn();
      console.log(`  ✓ PASS: ${test.name}`);
      passed++;
    } catch (err: any) {
      console.log(`  ✗ FAIL: ${test.name}`);
      console.log(`          ${err.message}`);
    }
  }

  console.log('────────────────────────────────────────────────────────────────');
  console.log(`Total: ${passed}/${testSuite.length} tests passed.`);
  console.log('================================================================\n');

  return { passed, total: testSuite.length, allPassed: passed === testSuite.length };
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runAllTests();
  process.exit(result.allPassed ? 0 : 1);
}
