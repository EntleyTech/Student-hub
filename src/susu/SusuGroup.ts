import {
  parseGhsToPesewas,
  formatPesewas,
  formatGHS,
  CurrencyError,
} from './currency.ts';
import {
  Member,
  Contribution,
  Payout,
  MemberWeeklyStatus,
  CloseWeekResult,
  SusuReport,
} from './types.ts';

export class SusuError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SusuError';
  }
}

export class SusuGroup {
  public readonly id: string;
  public readonly name: string;
  public readonly weeklyContributionPesewas: number;
  private members: Member[] = [];
  private contributions: Contribution[] = [];
  private payouts: Payout[] = [];
  private currentWeekNumber: number = 1;
  private isCycleFinished: boolean = false;

  constructor(name: string, weeklyContributionGhs: string | number) {
    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      throw new SusuError('Group name cannot be blank.');
    }
    this.name = trimmedName;
    this.id = `susu_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.weeklyContributionPesewas = parseGhsToPesewas(weeklyContributionGhs);
  }

  /**
   * Adds a new member to the susu group.
   * Order of joining determines order of payout.
   */
  public addMember(name: string): Member {
    const trimmed = (name || '').trim();
    if (!trimmed) {
      throw new SusuError('Member name cannot be blank.');
    }

    // Assumption: Cannot add members after contributions have started or weeks have closed
    if (this.contributions.length > 0 || this.payouts.length > 0) {
      throw new SusuError(
        `Cannot add member "${trimmed}". The member roster is locked once contributions start or after Week 1 begins to preserve pot size and rotation integrity.`
      );
    }

    // Check for duplicate member (case-insensitive)
    const exists = this.members.some(
      (m) => m.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      throw new SusuError(`Duplicate member: "${trimmed}" is already in the group.`);
    }

    const newMember: Member = {
      id: `mem_${this.members.length + 1}_${trimmed.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      name: trimmed,
      joinOrder: this.members.length + 1,
      joinedAt: new Date().toISOString(),
    };

    this.members.push(newMember);
    return newMember;
  }

  /**
   * Finds a member by name (case-insensitive) or by ID.
   */
  public findMember(identifier: string): Member | undefined {
    const clean = (identifier || '').trim().toLowerCase();
    return this.members.find(
      (m) => m.name.toLowerCase() === clean || m.id.toLowerCase() === clean
    );
  }

  /**
   * Record a contribution for a member for a given week.
   * Partial payments are allowed.
   * Overpayments above what the member currently owes for the week are rejected.
   */
  public recordContribution(
    memberIdentifier: string,
    week: number,
    amountGhs: string | number
  ): {
    member: Member;
    week: number;
    amountPaidPesewas: number;
    totalPaidThisWeekPesewas: number;
    remainingOwedPesewas: number;
  } {
    if (this.isCycleFinished) {
      throw new SusuError(
        'Susu cycle is already completed. All members have received their payout.'
      );
    }

    if (this.members.length === 0) {
      throw new SusuError('No members have joined the group yet.');
    }

    const member = this.findMember(memberIdentifier);
    if (!member) {
      throw new SusuError(`Unknown member: "${memberIdentifier}". Please verify the member name or ID.`);
    }

    // Week validation
    if (!Number.isInteger(week) || week < 1) {
      throw new SusuError(`Invalid week number: ${week}. Week must be an integer >= 1.`);
    }

    if (week < this.currentWeekNumber) {
      throw new SusuError(
        `Cannot contribute to Week ${week}. Week ${week} is already closed and paid out.`
      );
    }

    if (week > this.currentWeekNumber) {
      throw new SusuError(
        `Cannot contribute to future Week ${week}. The currently active open week is Week ${this.currentWeekNumber}.`
      );
    }

    // Parse amount strictly to pesewas (handles zero/negative rejection)
    const amountPesewas = parseGhsToPesewas(amountGhs);

    // Calculate how much this member has already contributed for this week
    const currentPaidPesewas = this.getMemberPaidPesewasForWeek(member.id, week);
    const remainingOwedPesewas = this.weeklyContributionPesewas - currentPaidPesewas;

    if (remainingOwedPesewas <= 0) {
      throw new SusuError(
        `Member ${member.name} has already paid the full weekly contribution (${formatGHS(
          this.weeklyContributionPesewas
        )}) for Week ${week}. No further payment is needed.`
      );
    }

    // Strict validation: Reject payments above what the member owes for that week
    if (amountPesewas > remainingOwedPesewas) {
      throw new SusuError(
        `Payment of ${formatGHS(
          amountPesewas
        )} exceeds remaining amount owed for Week ${week}. ${member.name} currently owes ${formatGHS(
          remainingOwedPesewas
        )} (paid ${formatGHS(currentPaidPesewas)} of ${formatGHS(
          this.weeklyContributionPesewas
        )}).`
      );
    }

    const contribution: Contribution = {
      id: `contrib_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      week,
      memberId: member.id,
      memberName: member.name,
      amountPesewas,
      timestamp: new Date().toISOString(),
    };

    this.contributions.push(contribution);

    const newTotalPaid = currentPaidPesewas + amountPesewas;
    const newRemaining = this.weeklyContributionPesewas - newTotalPaid;

    return {
      member,
      week,
      amountPaidPesewas: amountPesewas,
      totalPaidThisWeekPesewas: newTotalPaid,
      remainingOwedPesewas: newRemaining,
    };
  }

  /**
   * Closes a week.
   * If every member has paid in full, pays the pot to the next member in order and moves to the next week.
   * If not, does NOT pay out, and reports who still owes and how much.
   */
  public closeWeek(weekToClose?: number): CloseWeekResult {
    if (this.isCycleFinished) {
      return {
        success: false,
        week: this.currentWeekNumber,
        cycleCompleted: true,
        message: 'The Susu cycle is already complete. All members have received their payout.',
      };
    }

    const targetWeek = weekToClose !== undefined ? weekToClose : this.currentWeekNumber;

    if (targetWeek !== this.currentWeekNumber) {
      if (targetWeek < this.currentWeekNumber) {
        throw new SusuError(`Week ${targetWeek} is already closed.`);
      } else {
        throw new SusuError(
          `Cannot close future Week ${targetWeek}. Current active week is Week ${this.currentWeekNumber}.`
        );
      }
    }

    if (this.members.length < 2) {
      throw new SusuError(
        'A rotating savings group requires at least 2 members before closing a week.'
      );
    }

    // Check each member's contributions for this week
    const unpaidMembers: { memberName: string; owesPesewas: number; paidPesewas: number }[] = [];

    for (const member of this.members) {
      const paid = this.getMemberPaidPesewasForWeek(member.id, targetWeek);
      const owes = this.weeklyContributionPesewas - paid;
      if (owes > 0) {
        unpaidMembers.push({
          memberName: member.name,
          owesPesewas: owes,
          paidPesewas: paid,
        });
      }
    }

    // If any member owes, do not pay out!
    if (unpaidMembers.length > 0) {
      const debtDetails = unpaidMembers
        .map((u) => `${u.memberName} owes ${formatPesewas(u.owesPesewas)} GHS`)
        .join(', ');

      return {
        success: false,
        week: targetWeek,
        unpaidMembers,
        message: `Week ${targetWeek} cannot be closed: ${debtDetails}. Pot is not paid out.`,
      };
    }

    // Everyone has paid in full!
    // Total pot = number of members * weekly contribution
    const potAmountPesewas = this.members.length * this.weeklyContributionPesewas;

    // Recipient is the member corresponding to this payout order
    // In join order: 1st payout -> member 1, 2nd payout -> member 2, etc.
    const recipientIndex = this.payouts.length % this.members.length;
    const recipient = this.members[recipientIndex];

    const payout: Payout = {
      week: targetWeek,
      recipientId: recipient.id,
      recipientName: recipient.name,
      recipientOrder: recipient.joinOrder,
      potAmountPesewas,
      timestamp: new Date().toISOString(),
    };

    this.payouts.push(payout);

    // Check if the full cycle has completed
    const cycleCompleted = this.payouts.length === this.members.length;
    if (cycleCompleted) {
      this.isCycleFinished = true;
    } else {
      this.currentWeekNumber += 1;
    }

    const nextRecipient = cycleCompleted
      ? null
      : this.members[this.payouts.length % this.members.length].name;

    const message = cycleCompleted
      ? `Week ${targetWeek} closed successfully! ${recipient.name} received ${formatGHS(
          potAmountPesewas
        )}. Cycle completed! All ${this.members.length} members have received their pot.`
      : `Week ${targetWeek} closed successfully! ${recipient.name} received ${formatGHS(
          potAmountPesewas
        )}. Week ${this.currentWeekNumber} begins, and ${nextRecipient} is next in order.`;

    return {
      success: true,
      week: targetWeek,
      payout,
      nextWeek: cycleCompleted ? this.currentWeekNumber : this.currentWeekNumber,
      nextRecipientName: nextRecipient,
      cycleCompleted,
      message,
    };
  }

  /**
   * Total pesewas contributed by a member for a given week.
   */
  public getMemberPaidPesewasForWeek(memberId: string, week: number): number {
    return this.contributions
      .filter((c) => c.memberId === memberId && c.week === week)
      .reduce((sum, c) => sum + c.amountPesewas, 0);
  }

  /**
   * Generates a complete report of the current state of the Susu.
   */
  public getReport(): SusuReport {
    const expectedPotPesewas = this.members.length * this.weeklyContributionPesewas;
    const currentWeek = this.currentWeekNumber;

    let collectedPesewas = 0;
    const membersStatus: MemberWeeklyStatus[] = [];
    const paidInFullList: string[] = [];
    const unpaidList: { memberName: string; owesPesewas: number; paidPesewas: number }[] = [];

    for (const member of this.members) {
      const paidPesewas = this.getMemberPaidPesewasForWeek(member.id, currentWeek);
      collectedPesewas += paidPesewas;
      const owedPesewas = Math.max(0, this.weeklyContributionPesewas - paidPesewas);
      const isPaidInFull = owedPesewas === 0;

      const payoutRecord = this.payouts.find((p) => p.recipientId === member.id);

      const status: MemberWeeklyStatus = {
        memberId: member.id,
        memberName: member.name,
        joinOrder: member.joinOrder,
        paidPesewas,
        owedPesewas,
        isPaidInFull,
        hasReceivedPayout: !!payoutRecord,
        payoutWeekReceived: payoutRecord?.week,
      };

      membersStatus.push(status);

      if (isPaidInFull) {
        paidInFullList.push(member.name);
      } else {
        unpaidList.push({
          memberName: member.name,
          owesPesewas: owedPesewas,
          paidPesewas,
        });
      }
    }

    const nextRecipientInOrder =
      !this.isCycleFinished && this.members.length > 0
        ? this.members[this.payouts.length % this.members.length]?.name || null
        : null;

    return {
      groupName: this.name,
      currentWeek,
      weeklyContributionPesewas: this.weeklyContributionPesewas,
      totalMembers: this.members.length,
      members: [...this.members],
      expectedPotPesewas,
      collectedPesewas,
      allMembersPaidInFull: unpaidList.length === 0 && this.members.length > 0,
      nextRecipientInOrder,
      membersStatus,
      paidInFullList,
      unpaidList,
      payoutHistory: [...this.payouts],
      cycleCompleted: this.isCycleFinished,
    };
  }

  /**
   * Produces an exact text / CLI formatted report.
   */
  public getFormattedReport(): string {
    const report = this.getReport();
    const divider = '─'.repeat(60);
    const doubleDivider = '═'.repeat(60);

    const lines: string[] = [];
    lines.push(doubleDivider);
    lines.push(`  SUSU GROUP REPORT: ${report.groupName.toUpperCase()}`);
    lines.push(doubleDivider);
    lines.push(`• Current Status       : ${report.cycleCompleted ? 'CYCLE COMPLETED' : `Week ${report.currentWeek} (Active)`}`);
    lines.push(`• Weekly Contribution  : ${formatGHS(report.weeklyContributionPesewas)} per member`);
    lines.push(`• Total Members        : ${report.totalMembers}`);
    lines.push(`• Expected Weekly Pot  : ${formatGHS(report.expectedPotPesewas)}`);
    lines.push(`• Collected This Week  : ${formatGHS(report.collectedPesewas)} / ${formatGHS(report.expectedPotPesewas)}`);
    if (report.nextRecipientInOrder) {
      lines.push(`• Next Payout Recipient: ${report.nextRecipientInOrder} (Order #${this.payouts.length + 1})`);
    }
    lines.push(divider);

    lines.push(`CURRENT WEEK ${report.currentWeek} PAYMENT BREAKDOWN:`);
    if (report.membersStatus.length === 0) {
      lines.push('  (No members registered yet)');
    } else {
      for (const m of report.membersStatus) {
        const statusBadge = m.isPaidInFull ? '[PAID IN FULL]' : `[OWES ${formatPesewas(m.owedPesewas)} GHS]`;
        const payoutNote = m.hasReceivedPayout ? `(Received pot in Week ${m.payoutWeekReceived})` : '';
        lines.push(
          `  #${m.joinOrder} ${m.memberName.padEnd(12)} : Paid ${formatPesewas(m.paidPesewas).padStart(7)} GHS / ${formatPesewas(
            report.weeklyContributionPesewas
          )} GHS  ${statusBadge} ${payoutNote}`
        );
      }
    }

    lines.push(divider);
    lines.push('SUMMARY:');
    if (report.paidInFullList.length > 0) {
      lines.push(`• Paid in Full (${report.paidInFullList.length}) : ${report.paidInFullList.join(', ')}`);
    } else {
      lines.push('• Paid in Full (0) : None');
    }

    if (report.unpaidList.length > 0) {
      const oweDetails = report.unpaidList
        .map((u) => `${u.memberName} (owes ${formatPesewas(u.owesPesewas)} GHS)`)
        .join(', ');
      lines.push(`• Outstanding Dues (${report.unpaidList.length}) : ${oweDetails}`);
    } else if (report.totalMembers > 0) {
      lines.push('• Outstanding Dues : None! Ready to close week and pay out pot.');
    }

    lines.push(divider);
    lines.push(`PAYOUT HISTORY (${report.payoutHistory.length} completed):`);
    if (report.payoutHistory.length === 0) {
      lines.push('  (No payouts distributed yet)');
    } else {
      for (const p of report.payoutHistory) {
        lines.push(
          `  Week ${p.week} -> Recipient: ${p.recipientName} (Order #${p.recipientOrder}) | Pot Paid: ${formatGHS(
            p.potAmountPesewas
          )}`
        );
      }
    }
    lines.push(doubleDivider);

    return lines.join('\n');
  }

  public getMembers(): Member[] {
    return [...this.members];
  }

  public getCurrentWeek(): number {
    return this.currentWeekNumber;
  }

  public isCompleted(): boolean {
    return this.isCycleFinished;
  }
}
