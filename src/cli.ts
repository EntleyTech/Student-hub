#!/usr/bin/env node
import * as readline from 'readline';
import { SusuGroup, SusuError } from './susu/SusuGroup.ts';
import { formatGHS, formatPesewas, CurrencyError } from './susu/currency.ts';
import { runPromptExample, runValidationSuite } from './susu/demo.ts';

// Active global group instance for CLI interactive session
let activeGroup: SusuGroup | null = null;

function clearScreen() {
  process.stdout.write('\x1Bc');
}

function printHeader() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║               SUSU ROTATING SAVINGS MANAGER                    ║');
  console.log('║        Ghanaian Cedi (GHS) Exact Integer Pesewas Engine        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  if (activeGroup) {
    const report = activeGroup.getReport();
    console.log(` Active Group: ${report.groupName} | Weekly: ${formatGHS(report.weeklyContributionPesewas)} | Week: ${report.currentWeek} | Members: ${report.totalMembers}`);
  } else {
    console.log(' [No active group loaded. Please create one (Option 1) or run Example (Option 6)]');
  }
  console.log('────────────────────────────────────────────────────────────────');
}

function printMenu() {
  console.log('\nMAIN MENU:');
  console.log('  1) Create New Susu Group (Fixed weekly contribution)');
  console.log('  2) Add Member (Unique name/ID, in payout rotation order)');
  console.log('  3) Record Contribution (Member, week, amount — partial allowed)');
  console.log('  4) Close Week (Verifies full payment, pays out pot in order)');
  console.log('  5) Show Status Report (Current week, balances, payout history)');
  console.log('  6) Run Example from Prompt (Ama, Kofi, Esi @ 50.00 GHS)');
  console.log('  7) Run Full Rules & Validation Test Suite');
  console.log('  8) Display System Rules & Assumptions');
  console.log('  0) Exit');
}

function promptLine(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function handleInteractiveMenu() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  printHeader();

  let running = true;
  while (running) {
    printMenu();
    const choice = await promptLine(rl, '\nEnter choice [0-8]: ');

    console.log('\n' + '─'.repeat(60));
    try {
      switch (choice) {
        case '1': {
          const name = await promptLine(rl, 'Enter Group Name (e.g., Accra Traders Susu): ');
          const amount = await promptLine(rl, 'Enter Fixed Weekly Contribution in GHS (e.g., 50.00): ');
          activeGroup = new SusuGroup(name, amount);
          console.log(`\n✓ Success: Group "${activeGroup.name}" created with ${formatGHS(activeGroup.weeklyContributionPesewas)} weekly contribution.`);
          break;
        }

        case '2': {
          if (!activeGroup) {
            console.log('Please create a Susu group first (Option 1).');
            break;
          }
          const memberName = await promptLine(rl, 'Enter Member Name or ID: ');
          const member = activeGroup.addMember(memberName);
          console.log(`\n✓ Added member: "${member.name}" (Assigned Payout Order #${member.joinOrder}).`);
          break;
        }

        case '3': {
          if (!activeGroup) {
            console.log('Please create a Susu group first (Option 1).');
            break;
          }
          const memberName = await promptLine(rl, 'Enter Member Name: ');
          const currentWk = activeGroup.getCurrentWeek();
          const weekStr = await promptLine(rl, `Enter Week Number [Default: ${currentWk}]: `);
          const week = weekStr ? parseInt(weekStr, 10) : currentWk;
          const amount = await promptLine(rl, 'Enter Contribution Amount in GHS (e.g., 50.00 or 30.00): ');

          const result = activeGroup.recordContribution(memberName, week, amount);
          console.log(`\n✓ Contribution Recorded:`);
          console.log(`  Member    : ${result.member.name}`);
          console.log(`  Week      : Week ${result.week}`);
          console.log(`  Paid Now  : ${formatGHS(result.amountPaidPesewas)}`);
          console.log(`  Total Paid: ${formatGHS(result.totalPaidThisWeekPesewas)} / ${formatGHS(activeGroup.weeklyContributionPesewas)}`);
          if (result.remainingOwedPesewas === 0) {
            console.log(`  Status    : [PAID IN FULL FOR WEEK ${result.week}]`);
          } else {
            console.log(`  Remaining : Owes ${formatGHS(result.remainingOwedPesewas)}`);
          }
          break;
        }

        case '4': {
          if (!activeGroup) {
            console.log('Please create a Susu group first (Option 1).');
            break;
          }
          const currentWk = activeGroup.getCurrentWeek();
          const weekStr = await promptLine(rl, `Close which week? [Default: ${currentWk}]: `);
          const week = weekStr ? parseInt(weekStr, 10) : currentWk;

          const res = activeGroup.closeWeek(week);
          if (res.success) {
            console.log('\n★ WEEK CLOSED & POT DISBURSED ★');
            console.log(res.message);
            if (res.payout) {
              console.log(`  Recipient  : ${res.payout.recipientName} (Member #${res.payout.recipientOrder})`);
              console.log(`  Pot Amount : ${formatGHS(res.payout.potAmountPesewas)}`);
            }
          } else {
            console.log('\n✗ WEEK CLOSURE FAILED (Pot not paid out):');
            console.log(`  ${res.message}`);
            if (res.unpaidMembers && res.unpaidMembers.length > 0) {
              console.log('  Outstanding Balances:');
              for (const u of res.unpaidMembers) {
                console.log(`   - ${u.memberName}: Owes ${formatGHS(u.owesPesewas)} (has paid ${formatGHS(u.paidPesewas)})`);
              }
            }
          }
          break;
        }

        case '5': {
          if (!activeGroup) {
            console.log('Please create a Susu group first (Option 1).');
            break;
          }
          console.log('\n' + activeGroup.getFormattedReport());
          break;
        }

        case '6': {
          console.log('\nExecuting prompt example...');
          const result = runPromptExample();
          console.log(result.logs.join('\n'));
          // Set active group to this example group so user can continue playing with it
          activeGroup = new SusuGroup('Accra Central Traders Susu', '50.00');
          activeGroup.addMember('Ama');
          activeGroup.addMember('Kofi');
          activeGroup.addMember('Esi');
          activeGroup.recordContribution('Ama', 1, '50.00');
          activeGroup.recordContribution('Kofi', 1, '50.00');
          activeGroup.recordContribution('Esi', 1, '30.00');
          console.log('\n[Loaded prompt state into active group: Ama(50), Kofi(50), Esi(30), Week 1 open]');
          break;
        }

        case '7': {
          console.log('\nRunning automated test & validation suite...');
          const testResults = runValidationSuite();
          let passCount = 0;
          for (const t of testResults) {
            if (t.passed) {
              console.log(`  ✓ PASS: ${t.testName}`);
              passCount++;
            } else {
              console.log(`  ✗ FAIL: ${t.testName} -> ${t.message}`);
            }
          }
          console.log(`\nTests finished: ${passCount}/${testResults.length} passed.`);
          break;
        }

        case '8': {
          console.log('\nRULES & ASSUMPTIONS:');
          console.log('1. Exact Money: All calculations use integer Pesewas (100 Pesewas = 1 GHS). Zero floating-point rounding.');
          console.log('2. Roster Lock: Member roster is locked once Week 1 contributions begin to guarantee fixed pot size & rotation.');
          console.log('3. Partial Payments: Allowed anytime during active week. Overpayments above owed balance are rejected.');
          console.log('4. Zero/Negative: Zero and negative contributions are strictly rejected.');
          console.log('5. Week Closure: Requires 100% full payment from all members. Next in join order receives full pot.');
          console.log('6. Cycle Completion: When all members have received their pot, the cycle completes.');
          break;
        }

        case '0':
        case 'q':
        case 'exit': {
          console.log('Exiting Susu Manager. Goodbye!');
          running = false;
          break;
        }

        default:
          console.log('Invalid option. Please enter 0-8.');
          break;
      }
    } catch (err: any) {
      if (err instanceof SusuError || err instanceof CurrencyError) {
        console.log(`\n[VALIDATION ERROR] ${err.message}`);
      } else {
        console.log(`\n[ERROR] ${err.message}`);
      }
    }
    console.log('─'.repeat(60));
  }

  rl.close();
}

// Check if running from CLI directly with args or piped input
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    await handleInteractiveMenu();
    return;
  }

  const cmd = args[0].toLowerCase();
  switch (cmd) {
    case 'example': {
      const res = runPromptExample();
      console.log(res.logs.join('\n'));
      process.exit(res.success ? 0 : 1);
      break;
    }
    case 'test': {
      const results = runValidationSuite();
      let allPassed = true;
      for (const t of results) {
        if (t.passed) {
          console.log(`✓ ${t.testName}`);
        } else {
          console.log(`✗ ${t.testName}: ${t.message}`);
          allPassed = false;
        }
      }
      process.exit(allPassed ? 0 : 1);
      break;
    }
    case 'help':
    case '--help':
    case '-h': {
      console.log('Usage:');
      console.log('  tsx src/cli.ts             Launch interactive menu');
      console.log('  tsx src/cli.ts example     Run the prompt example');
      console.log('  tsx src/cli.ts test        Run test & validation suite');
      process.exit(0);
      break;
    }
    default: {
      console.log(`Unknown command "${cmd}". Run "tsx src/cli.ts" for interactive menu or "tsx src/cli.ts example".`);
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
