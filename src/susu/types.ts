/**
 * Core type definitions for the Susu rotating savings manager.
 */

export interface Member {
  id: string;
  name: string;
  joinOrder: number; // 1-based index determining payout rotation
  joinedAt: string;
}

export interface Contribution {
  id: string;
  week: number;
  memberId: string;
  memberName: string;
  amountPesewas: number;
  timestamp: string;
}

export interface Payout {
  week: number;
  recipientId: string;
  recipientName: string;
  recipientOrder: number;
  potAmountPesewas: number;
  timestamp: string;
}

export interface MemberWeeklyStatus {
  memberId: string;
  memberName: string;
  joinOrder: number;
  paidPesewas: number;
  owedPesewas: number;
  isPaidInFull: boolean;
  hasReceivedPayout: boolean;
  payoutWeekReceived?: number;
}

export interface CloseWeekResult {
  success: boolean;
  week: number;
  payout?: Payout;
  nextWeek?: number;
  nextRecipientName?: string | null;
  cycleCompleted?: boolean;
  unpaidMembers?: {
    memberName: string;
    owesPesewas: number;
    paidPesewas: number;
  }[];
  message: string;
}

export interface SusuReport {
  groupName: string;
  currentWeek: number;
  weeklyContributionPesewas: number;
  totalMembers: number;
  members: Member[];
  expectedPotPesewas: number;
  collectedPesewas: number;
  allMembersPaidInFull: boolean;
  nextRecipientInOrder: string | null;
  membersStatus: MemberWeeklyStatus[];
  paidInFullList: string[];
  unpaidList: {
    memberName: string;
    owesPesewas: number;
    paidPesewas: number;
  }[];
  payoutHistory: Payout[];
  cycleCompleted: boolean;
}
