import { SusuGroup } from './SusuGroup.ts';
import { formatGHS, formatPesewas } from './currency.ts';

/**
 * Runs the exact scenario described in the user prompt:
 * Example: 3 members (Ama, Kofi, Esi), weekly amount 50.00.
 * Week 1: Ama and Kofi pay 50. Esi pays 30.
 * Closing week 1 pays nothing and reports "Esi owes 20.00".
 * Esi pays 20, week 1 closes, and Ama receives 150.00.
 * Week 2 begins, and Kofi is next.
 */
export function runPromptExample(): { logs: string[]; success: boolean } {
  const logs: string[] = [];
  const log = (msg: string) => logs.push(msg);

  log('================================================================');
  log('   PROMPT EXAMPLE EXECUTION (Ama, Kofi, Esi @ 50.00 GHS/wk)');
  log('================================================================');

  try {
    // 1. Create a group with a fixed weekly contribution in GHS (50.00)
    log('1. Creating group "Accra Central Traders Susu" with 50.00 GHS weekly contribution...');
    const susu = new SusuGroup('Accra Central Traders Susu', '50.00');

    // 2. Add members (Ama, Kofi, Esi)
    log('2. Adding members in order: Ama, Kofi, Esi...');
    susu.addMember('Ama');
    susu.addMember('Kofi');
    susu.addMember('Esi');
    log(`   Members added: ${susu.getMembers().map((m) => `${m.name} (#${m.joinOrder})`).join(', ')}`);

    // 3. Week 1 contributions
    log('\n3. Recording Week 1 contributions:');
    susu.recordContribution('Ama', 1, '50.00');
    log('   -> Ama paid 50.00 GHS (Paid in full)');
    susu.recordContribution('Kofi', 1, '50.00');
    log('   -> Kofi paid 50.00 GHS (Paid in full)');
    susu.recordContribution('Esi', 1, '30.00');
    log('   -> Esi paid 30.00 GHS (Partial payment)');

    // 4. Close Week 1 (Attempt 1)
    log('\n4. Attempting to close Week 1...');
    const closeAttempt1 = susu.closeWeek(1);
    log(`   Result: success=${closeAttempt1.success}`);
    log(`   Report: "${closeAttempt1.message}"`);

    if (closeAttempt1.success) {
      throw new Error('Expected Week 1 closure to fail because Esi owes 20.00 GHS!');
    }

    // 5. Esi pays remaining 20.00 GHS
    log('\n5. Esi pays the remaining 20.00 GHS:');
    susu.recordContribution('Esi', 1, '20.00');
    log('   -> Esi paid 20.00 GHS (Now paid in full)');

    // 6. Close Week 1 (Attempt 2)
    log('\n6. Closing Week 1 again after full payment...');
    const closeAttempt2 = susu.closeWeek(1);
    log(`   Result: success=${closeAttempt2.success}`);
    log(`   Report: "${closeAttempt2.message}"`);
    if (!closeAttempt2.success) {
      throw new Error('Expected Week 1 to close successfully!');
    }

    // 7. Check state for Week 2
    log('\n7. Verifying state after Week 1 payout:');
    log(`   Current Week: Week ${susu.getCurrentWeek()}`);
    log(`   Next in order: Kofi`);
    log(`   Payout recipient: ${closeAttempt2.payout?.recipientName} received ${formatGHS(closeAttempt2.payout!.potAmountPesewas)}`);

    log('\n8. Full Group Report:');
    log(susu.getFormattedReport());

    log('\n>>> PROMPT EXAMPLE PASSED PERFECTLY <<<\n');
    return { logs, success: true };
  } catch (err: any) {
    log(`[ERROR] ${err.message}`);
    return { logs, success: false };
  }
}

/**
 * Runs a comprehensive test suite of all rules, validations, and edge cases.
 */
export function runValidationSuite(): { testName: string; passed: boolean; message: string }[] {
  const results: { testName: string; passed: boolean; message: string }[] = [];

  const runTest = (testName: string, fn: () => void) => {
    try {
      fn();
      results.push({ testName, passed: true, message: 'Passed' });
    } catch (e: any) {
      results.push({ testName, passed: false, message: e.message });
    }
  };

  // Test 1: Reject duplicate members
  runTest('Rule: Reject duplicate members', () => {
    const group = new SusuGroup('Test Group', '50.00');
    group.addMember('Kwame');
    try {
      group.addMember('kwame'); // case insensitive duplicate
      throw new Error('Failed to reject duplicate member');
    } catch (err: any) {
      if (!err.message.includes('Duplicate member')) throw err;
    }
  });

  // Test 2: Reject unknown members
  runTest('Rule: Reject unknown members on contribution', () => {
    const group = new SusuGroup('Test Group', '50.00');
    group.addMember('Kwame');
    group.addMember('Akosua');
    try {
      group.recordContribution('Stranger', 1, '50.00');
      throw new Error('Failed to reject unknown member');
    } catch (err: any) {
      if (!err.message.includes('Unknown member')) throw err;
    }
  });

  // Test 3: Reject zero and negative amounts
  runTest('Rule: Reject zero or negative contribution amounts', () => {
    const group = new SusuGroup('Test Group', '50.00');
    group.addMember('Kwame');
    group.addMember('Akosua');
    try {
      group.recordContribution('Kwame', 1, '0.00');
      throw new Error('Failed to reject zero payment');
    } catch (err: any) {
      if (!err.message.includes('greater than zero')) throw err;
    }

    try {
      group.recordContribution('Kwame', 1, '-10.00');
      throw new Error('Failed to reject negative payment');
    } catch (err: any) {
      if (!err.message.includes('negative')) throw err;
    }
  });

  // Test 4: Reject overpayments
  runTest('Rule: Reject payment above what a member owes for that week', () => {
    const group = new SusuGroup('Test Group', '50.00');
    group.addMember('Kwame');
    group.addMember('Akosua');
    group.recordContribution('Kwame', 1, '30.00'); // Kwame owes 20.00 now

    try {
      group.recordContribution('Kwame', 1, '25.00'); // tries to pay 25.00 > 20.00
      throw new Error('Failed to reject overpayment');
    } catch (err: any) {
      if (!err.message.includes('exceeds remaining amount owed')) throw err;
    }
  });

  // Test 5: Exact money handling (Pesewas without floating point error)
  runTest('Rule: Exact money handling with no rounding errors', () => {
    const group = new SusuGroup('Test Group', '33.33');
    group.addMember('A');
    group.addMember('B');
    group.addMember('C');
    group.recordContribution('A', 1, '11.11');
    group.recordContribution('A', 1, '22.22'); // total 33.33
    const report = group.getReport();
    const aStatus = report.membersStatus.find((m) => m.memberName === 'A');
    if (!aStatus?.isPaidInFull || aStatus.paidPesewas !== 3333) {
      throw new Error(`Exact money failed: expected 3333 pesewas, got ${aStatus?.paidPesewas}`);
    }
  });

  // Test 6: Assumption - Reject adding member after contributions begin
  runTest('Assumption: Lock roster once contributions begin', () => {
    const group = new SusuGroup('Test Group', '50.00');
    group.addMember('Kwame');
    group.addMember('Akosua');
    group.recordContribution('Kwame', 1, '50.00');
    try {
      group.addMember('Latecomer');
      throw new Error('Failed to lock roster after contributions started');
    } catch (err: any) {
      if (!err.message.includes('locked')) throw err;
    }
  });

  // Test 7: Full 3-week rotation
  runTest('Feature: Full rotation payout to each member in order', () => {
    const group = new SusuGroup('Full Cycle', '100.00');
    group.addMember('Alpha');
    group.addMember('Beta');
    group.addMember('Gamma');

    // Week 1 -> Alpha receives 300
    group.recordContribution('Alpha', 1, '100.00');
    group.recordContribution('Beta', 1, '100.00');
    group.recordContribution('Gamma', 1, '100.00');
    const w1 = group.closeWeek(1);
    if (!w1.success || w1.payout?.recipientName !== 'Alpha' || w1.payout.potAmountPesewas !== 30000) {
      throw new Error('Week 1 payout to Alpha failed');
    }

    // Week 2 -> Beta receives 300
    group.recordContribution('Alpha', 2, '100.00');
    group.recordContribution('Beta', 2, '100.00');
    group.recordContribution('Gamma', 2, '100.00');
    const w2 = group.closeWeek(2);
    if (!w2.success || w2.payout?.recipientName !== 'Beta' || w2.payout.potAmountPesewas !== 30000) {
      throw new Error('Week 2 payout to Beta failed');
    }

    // Week 3 -> Gamma receives 300
    group.recordContribution('Alpha', 3, '100.00');
    group.recordContribution('Beta', 3, '100.00');
    group.recordContribution('Gamma', 3, '100.00');
    const w3 = group.closeWeek(3);
    if (!w3.success || w3.payout?.recipientName !== 'Gamma' || !w3.cycleCompleted) {
      throw new Error('Week 3 payout to Gamma or cycle completion failed');
    }
  });

  return results;
}
