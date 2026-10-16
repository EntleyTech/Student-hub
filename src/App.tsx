import React, { useState, useEffect, useRef } from 'react';
import { SusuGroup, SusuError } from './susu/SusuGroup.ts';
import { formatGHS, formatPesewas, CurrencyError } from './susu/currency.ts';
import { runPromptExample, runValidationSuite } from './susu/demo.ts';
import {
  Terminal,
  Send,
  Play,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Server,
  DollarSign,
  Users,
  Calendar,
  ArrowRight,
  Plus,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  ChevronRight,
  Clock,
  Award,
  Wallet
} from 'lucide-react';

// Avatars generated for the prompt members
const AVATAR_MAP: Record<string, string> = {
  ama: '/src/assets/images/avatar_ama_ghana_1792178877188.jpg',
  kofi: '/src/assets/images/avatar_kofi_ghana_1792178877950.jpg',
  esi: '/src/assets/images/avatar_esi_ghana_1792178877954.jpg',
};

interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'success' | 'system' | 'header';
  text: string;
}

export default function App() {
  // Initialize with prompt scenario group
  const [group, setGroup] = useState<SusuGroup>(() => {
    const initial = new SusuGroup('Accra Central Traders Susu', '50.00');
    initial.addMember('Ama');
    initial.addMember('Kofi');
    initial.addMember('Esi');
    return initial;
  });

  const [activeTab, setActiveTab] = useState<'dashboard' | 'terminal' | 'api' | 'assumptions'>('dashboard');
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Modals
  const [showPayModal, setShowPayModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);

  // Form states
  const [selectedMemberName, setSelectedMemberName] = useState('Ama');
  const [payAmount, setPayAmount] = useState('50.00');
  const [payWeek, setPayWeek] = useState(1);
  const [newMemberName, setNewMemberName] = useState('');
  const [newGroupName, setNewGroupName] = useState('Osu Merchants Susu');
  const [newGroupWeekly, setNewGroupWeekly] = useState('50.00');

  // Terminal state
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [terminalInput, setTerminalInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const terminalBottomRef = useRef<HTMLDivElement>(null);
  const terminalInputRef = useRef<HTMLInputElement>(null);

  // Copied curl state
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);

  // Auto-dismiss notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Terminal boot lines
  useEffect(() => {
    setTerminalLines([
      { id: '1', type: 'header', text: '╔════════════════════════════════════════════════════════════════════════════════════╗' },
      { id: '2', type: 'header', text: '║                    SUSU ROTATING SAVINGS GROUP CONSOLE                             ║' },
      { id: '3', type: 'header', text: '║             Ghanaian Cedi (GHS) Exact Integer Pesewas Financial Ledger             ║' },
      { id: '4', type: 'header', text: '╚════════════════════════════════════════════════════════════════════════════════════╝' },
      { id: '5', type: 'system', text: 'Group: "Accra Central Traders Susu" | Weekly: GHS 50.00 | Members: Ama (#1), Kofi (#2), Esi (#3)' },
      { id: '6', type: 'system', text: 'Type "help", "report", "example", or "test". Commands execute against the exact engine.' },
      { id: '7', type: 'output', text: '────────────────────────────────────────────────────────────────────────────────────' },
    ]);
  }, []);

  useEffect(() => {
    terminalBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLines]);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
  };

  const addTerminalLine = (type: TerminalLine['type'], text: string) => {
    setTerminalLines((prev) => [...prev, { id: `${Date.now()}_${Math.random()}`, type, text }]);
  };

  const executeCommand = (cmdStr: string) => {
    const cmd = cmdStr.trim();
    if (!cmd) return;

    addTerminalLine('input', `susu> ${cmd}`);
    setHistory((prev) => [...prev, cmd]);
    setHistoryIdx(-1);

    const parts = cmd.split(/\s+/);
    const action = parts[0].toLowerCase();

    try {
      switch (action) {
        case 'help': {
          addTerminalLine('system', 'AVAILABLE COMMANDS:');
          addTerminalLine('output', '  report                       Print current week status and payout history');
          addTerminalLine('output', '  pay <member> <week> <amount> Record contribution (e.g., pay Ama 1 50.00)');
          addTerminalLine('output', '  close [week]                 Attempt to close week & disburse pot (e.g., close 1)');
          addTerminalLine('output', '  add <name>                   Add a member before contributions begin');
          addTerminalLine('output', '  create <name> <amount>       Create a new group (e.g., create AccraGroup 50.00)');
          addTerminalLine('output', '  example                      Execute the prompt scenario (Ama, Kofi, Esi @ 50.00)');
          addTerminalLine('output', '  test                         Run the automated validation suite');
          addTerminalLine('output', '  clear                        Clear terminal output');
          break;
        }

        case 'clear': {
          setTerminalLines([]);
          break;
        }

        case 'report': {
          const reportText = group.getFormattedReport();
          reportText.split('\n').forEach((l) => addTerminalLine('output', l));
          break;
        }

        case 'pay':
        case 'contribute': {
          if (parts.length < 4) {
            throw new SusuError('Usage: pay <MemberName> <WeekNumber> <AmountGHS> (e.g. pay Ama 1 50.00)');
          }
          const memberName = parts[1];
          const week = parseInt(parts[2], 10);
          const amount = parts[3];
          const res = group.recordContribution(memberName, week, amount);
          addTerminalLine('success', `✓ ${res.member.name} paid ${formatGHS(res.amountPaidPesewas)} for Week ${res.week}.`);
          showToast('success', `${res.member.name} paid ${formatGHS(res.amountPaidPesewas)} for Week ${res.week}.`);
          // Force React re-render
          setGroup(Object.assign(Object.create(Object.getPrototypeOf(group)), group));
          break;
        }

        case 'close': {
          const targetWk = parts[1] ? parseInt(parts[1], 10) : group.getCurrentWeek();
          const res = group.closeWeek(targetWk);
          if (res.success) {
            addTerminalLine('success', `★ ${res.message}`);
            showToast('success', res.message);
          } else {
            addTerminalLine('error', `✗ ${res.message}`);
            showToast('error', res.message);
          }
          setGroup(Object.assign(Object.create(Object.getPrototypeOf(group)), group));
          break;
        }

        case 'add': {
          if (parts.length < 2) {
            throw new SusuError('Usage: add <MemberName> (e.g. add Kwame)');
          }
          const mName = parts.slice(1).join(' ');
          const member = group.addMember(mName);
          addTerminalLine('success', `✓ Member "${member.name}" added (Rotation Order #${member.joinOrder}).`);
          showToast('success', `Member "${member.name}" registered (Order #${member.joinOrder}).`);
          setGroup(Object.assign(Object.create(Object.getPrototypeOf(group)), group));
          break;
        }

        case 'create': {
          if (parts.length < 3) {
            throw new SusuError('Usage: create <GroupName> <WeeklyAmount> (e.g. create TemaMerchants 50.00)');
          }
          const gName = parts[1];
          const wAmount = parts[2];
          const newG = new SusuGroup(gName, wAmount);
          setGroup(newG);
          addTerminalLine('success', `✓ Group "${newG.name}" created with weekly contribution of ${formatGHS(newG.weeklyContributionPesewas)}.`);
          showToast('success', `Group "${newG.name}" initialized.`);
          break;
        }

        case 'example': {
          handleRunExample();
          break;
        }

        case 'test': {
          addTerminalLine('system', 'Running test suite...');
          const results = runValidationSuite();
          let passed = 0;
          results.forEach((t) => {
            if (t.passed) {
              passed++;
              addTerminalLine('success', `✓ PASS: ${t.testName}`);
            } else {
              addTerminalLine('error', `✗ FAIL: ${t.testName} -> ${t.message}`);
            }
          });
          addTerminalLine('system', `Completed: ${passed}/${results.length} tests passed.`);
          showToast('info', `Validation suite: ${passed}/${results.length} tests passed.`);
          break;
        }

        default:
          addTerminalLine('error', `Unknown command "${cmd}". Type "help" for valid commands.`);
          break;
      }
    } catch (err: any) {
      const msg = err.message || String(err);
      addTerminalLine('error', `[ERROR] ${msg}`);
      showToast('error', msg);
    }
  };

  const handleRunExample = () => {
    addTerminalLine('system', 'Executing prompt scenario (Ama, Kofi, Esi @ 50.00 GHS)...');
    const outcome = runPromptExample();
    outcome.logs.forEach((line) => {
      if (line.startsWith('[ERROR]')) addTerminalLine('error', line);
      else if (line.startsWith('>>>') || line.includes('PASSED')) addTerminalLine('success', line);
      else addTerminalLine('output', line);
    });

    // Reset group to week 1 scenario state
    const exampleGroup = new SusuGroup('Accra Central Traders Susu', '50.00');
    exampleGroup.addMember('Ama');
    exampleGroup.addMember('Kofi');
    exampleGroup.addMember('Esi');
    exampleGroup.recordContribution('Ama', 1, '50.00');
    exampleGroup.recordContribution('Kofi', 1, '50.00');
    exampleGroup.recordContribution('Esi', 1, '30.00');
    setGroup(exampleGroup);
    showToast('info', 'Loaded prompt example: Ama (50), Kofi (50), Esi (30). Esi owes 20.00 GHS.');
  };

  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = group.recordContribution(selectedMemberName, payWeek, payAmount);
      showToast('success', `Payment of ${formatGHS(res.amountPaidPesewas)} recorded for ${res.member.name}.`);
      addTerminalLine('success', `✓ ${res.member.name} contributed ${formatGHS(res.amountPaidPesewas)} for Week ${res.week}.`);
      setGroup(Object.assign(Object.create(Object.getPrototypeOf(group)), group));
      setShowPayModal(false);
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleAddMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const member = group.addMember(newMemberName);
      showToast('success', `Member "${member.name}" added to rotation (Order #${member.joinOrder}).`);
      addTerminalLine('success', `✓ Member "${member.name}" added (Order #${member.joinOrder}).`);
      setGroup(Object.assign(Object.create(Object.getPrototypeOf(group)), group));
      setNewMemberName('');
      setShowAddMemberModal(false);
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleCreateGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newG = new SusuGroup(newGroupName, newGroupWeekly);
      setGroup(newG);
      showToast('success', `Group "${newG.name}" created with ${formatGHS(newG.weeklyContributionPesewas)} weekly contribution.`);
      addTerminalLine('success', `✓ Group "${newG.name}" created.`);
      setShowCreateGroupModal(false);
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleCloseWeek = () => {
    try {
      const res = group.closeWeek();
      if (res.success) {
        showToast('success', res.message);
        addTerminalLine('success', `★ ${res.message}`);
      } else {
        showToast('error', res.message);
        addTerminalLine('error', `✗ ${res.message}`);
      }
      setGroup(Object.assign(Object.create(Object.getPrototypeOf(group)), group));
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const copyToClipboard = (text: string, endpointKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(endpointKey);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  const report = group.getReport();
  const potProgressPercent = report.expectedPotPesewas > 0
    ? Math.min(100, Math.round((report.collectedPesewas / report.expectedPotPesewas) * 100))
    : 0;

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 max-w-md transition-all transform animate-in fade-in slide-in-from-top-4">
          <div
            className={`px-4 py-3 rounded-lg shadow-xl border text-sm flex items-start gap-3 ${
              notification.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                : notification.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
                : 'bg-slate-900/90 border-slate-700 text-slate-200'
            }`}
          >
            {notification.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
            {notification.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
            {notification.type === 'info' && <HelpCircle className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />}
            <div className="flex-1 text-xs md:text-sm font-medium">{notification.message}</div>
            <button
              onClick={() => setNotification(null)}
              className="text-neutral-400 hover:text-white text-xs ml-2"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Top Bar Contract: [Brand title, 1-line] — [4-5 clean nav links, whitespace-nowrap] — [1 primary action] */}
      <header className="border-b border-slate-800/80 bg-[#0d1320]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
                SUSU
              </span>
              <span className="text-xs text-slate-400 block -mt-1 font-normal">
                Rotating Savings &amp; Credit Group
              </span>
            </div>
          </div>

          {/* Zone 2: Navigation Links (single-line, clean text hover) */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`whitespace-nowrap transition pb-1 border-b-2 ${
                activeTab === 'dashboard'
                  ? 'border-emerald-400 text-emerald-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Ledger &amp; Dashboard
            </button>
            <button
              onClick={() => setActiveTab('terminal')}
              className={`whitespace-nowrap transition pb-1 border-b-2 ${
                activeTab === 'terminal'
                  ? 'border-emerald-400 text-emerald-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Interactive Console &amp; CLI
            </button>
            <button
              onClick={() => setActiveTab('api')}
              className={`whitespace-nowrap transition pb-1 border-b-2 ${
                activeTab === 'api'
                  ? 'border-emerald-400 text-emerald-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              REST API Explorer
            </button>
            <button
              onClick={() => setActiveTab('assumptions')}
              className={`whitespace-nowrap transition pb-1 border-b-2 ${
                activeTab === 'assumptions'
                  ? 'border-emerald-400 text-emerald-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Rules &amp; Assumptions
            </button>
          </nav>

          {/* Zone 3: Primary Action Button */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleRunExample}
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-lg transition whitespace-nowrap"
              title="Loads the 3-member scenario (Ama, Kofi, Esi)"
            >
              <Play className="w-3.5 h-3.5 text-emerald-400" />
              Run Prompt Scenario
            </button>
            <button
              onClick={() => {
                const firstUnpaid = report.unpaidList[0]?.memberName || report.members[0]?.name || 'Ama';
                const memberStatus = report.membersStatus.find((m) => m.memberName === firstUnpaid);
                setSelectedMemberName(firstUnpaid);
                setPayAmount(memberStatus ? formatPesewas(memberStatus.owedPesewas) : '50.00');
                setPayWeek(report.currentWeek);
                setShowPayModal(true);
              }}
              disabled={report.cycleCompleted}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
              Record Contribution
            </button>
          </div>
        </div>
      </header>

      {/* Main Viewport Container */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col gap-6">
        {/* Mobile Navigation Bar */}
        <div className="md:hidden flex overflow-x-auto gap-2 pb-2 border-b border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1.5 rounded-md whitespace-nowrap ${
              activeTab === 'dashboard' ? 'bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30' : 'text-slate-400 bg-slate-900'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('terminal')}
            className={`px-3 py-1.5 rounded-md whitespace-nowrap ${
              activeTab === 'terminal' ? 'bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30' : 'text-slate-400 bg-slate-900'
            }`}
          >
            Terminal / CLI
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`px-3 py-1.5 rounded-md whitespace-nowrap ${
              activeTab === 'api' ? 'bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30' : 'text-slate-400 bg-slate-900'
            }`}
          >
            REST API
          </button>
          <button
            onClick={() => setActiveTab('assumptions')}
            className={`px-3 py-1.5 rounded-md whitespace-nowrap ${
              activeTab === 'assumptions' ? 'bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30' : 'text-slate-400 bg-slate-900'
            }`}
          >
            Assumptions
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: LEDGER & DASHBOARD VIEW                                */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Top Key Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Active Cycle & Week */}
              <div className="bg-[#111726] border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>ACTIVE TIMELINE</span>
                  <Calendar className="w-4 h-4 text-slate-500" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-white font-mono tabular-nums">
                    Week {report.currentWeek}
                  </span>
                  <span className="text-xs font-medium text-emerald-400">
                    {report.cycleCompleted ? 'Cycle Completed' : 'In Progress'}
                  </span>
                </div>
                <div className="mt-3 text-xs text-slate-400 flex items-center justify-between">
                  <span>Group: {report.groupName}</span>
                  <button
                    onClick={() => setShowCreateGroupModal(true)}
                    className="text-emerald-400 hover:text-emerald-300 font-medium"
                  >
                    Change
                  </button>
                </div>
              </div>

              {/* Card 2: Fixed Weekly Contribution */}
              <div className="bg-[#111726] border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>WEEKLY DUES PER MEMBER</span>
                  <DollarSign className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <span className="text-2xl font-bold tracking-tight text-white font-mono tabular-nums">
                    {formatGHS(report.weeklyContributionPesewas)}
                  </span>
                </div>
                <div className="mt-3 text-xs text-slate-400">
                  Exact integer calculation · 0.00 rounding error
                </div>
              </div>

              {/* Card 3: Expected Weekly Pot */}
              <div className="bg-[#111726] border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>WEEK {report.currentWeek} POT STATUS</span>
                  <Wallet className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold tracking-tight text-white font-mono tabular-nums">
                      {formatGHS(report.collectedPesewas)}
                    </span>
                    <span className="text-xs text-slate-400 font-mono tabular-nums">
                      of {formatGHS(report.expectedPotPesewas)}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-800/80 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        potProgressPercent === 100 ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                      style={{ width: `${potProgressPercent}%` }}
                    />
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-400 flex justify-between">
                  <span>Progress: {potProgressPercent}%</span>
                  <span className={report.allMembersPaidInFull ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                    {report.allMembersPaidInFull ? 'Fully Funded' : `Owing ${formatPesewas(report.expectedPotPesewas - report.collectedPesewas)} GHS`}
                  </span>
                </div>
              </div>

              {/* Card 4: Next Recipient */}
              <div className="bg-[#111726] border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>NEXT POT RECIPIENT</span>
                  <Award className="w-4 h-4 text-amber-400" />
                </div>
                <div className="flex items-center gap-3">
                  {report.nextRecipientInOrder ? (
                    <>
                      <div className="relative w-10 h-10 rounded-full overflow-hidden border border-amber-400/40 bg-slate-800 shrink-0">
                        {AVATAR_MAP[report.nextRecipientInOrder.toLowerCase()] ? (
                          <img
                            src={AVATAR_MAP[report.nextRecipientInOrder.toLowerCase()]}
                            alt={report.nextRecipientInOrder}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-amber-400 text-sm">
                            {report.nextRecipientInOrder.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-lg font-bold text-white tracking-tight">
                          {report.nextRecipientInOrder}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          Payout pot: {formatGHS(report.expectedPotPesewas)}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-slate-400">All members paid out!</div>
                  )}
                </div>
                <div className="mt-3 text-xs text-slate-400">
                  Rotation follows strict join order sequence
                </div>
              </div>
            </div>

            {/* Week Closure Control Bar */}
            <div className={`rounded-xl p-5 border transition-all ${
              report.allMembersPaidInFull
                ? 'bg-emerald-950/20 border-emerald-500/30'
                : 'bg-amber-950/15 border-amber-500/30'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className={`p-2.5 rounded-lg shrink-0 ${
                    report.allMembersPaidInFull ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {report.allMembersPaidInFull ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      <AlertCircle className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {report.allMembersPaidInFull
                        ? `Week ${report.currentWeek} Ready to Close & Disburse`
                        : `Week ${report.currentWeek} Unpaid Balance Notice`}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {report.allMembersPaidInFull
                        ? `All ${report.totalMembers} members have paid their ${formatGHS(report.weeklyContributionPesewas)} contribution in full. Pot of ${formatGHS(report.expectedPotPesewas)} is ready for ${report.nextRecipientInOrder}.`
                        : report.unpaidList.length > 0
                        ? `Closure held: ${report.unpaidList.map((u) => `${u.memberName} owes ${formatPesewas(u.owesPesewas)} GHS`).join(', ')}. No payout will occur until all debts are cleared.`
                        : 'Please add members and collect dues to close this week.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleCloseWeek}
                    disabled={report.cycleCompleted}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 whitespace-nowrap shadow-sm ${
                      report.allMembersPaidInFull
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Close Week {report.currentWeek} &amp; Disburse
                  </button>
                </div>
              </div>
            </div>

            {/* Member Roster & Payout Rotation Section */}
            <div className="bg-[#111726] border border-slate-800/80 rounded-xl overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Member Roster &amp; Week {report.currentWeek} Ledger
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Order of joining determines weekly payout order. Partial payments permitted.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddMemberModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Member
                  </button>
                </div>
              </div>

              {/* Members Grid / List */}
              <div className="divide-y divide-slate-800/80">
                {report.membersStatus.map((m) => {
                  const avatarSrc = AVATAR_MAP[m.memberName.toLowerCase()];
                  const isCurrentRecipient = report.nextRecipientInOrder === m.memberName;

                  return (
                    <div
                      key={m.memberId}
                      className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/20 transition"
                    >
                      {/* Left: Avatar + Identity */}
                      <div className="flex items-center gap-3.5">
                        <div className="relative w-11 h-11 rounded-full overflow-hidden border border-slate-700 bg-slate-800 shrink-0">
                          {avatarSrc ? (
                            <img
                              src={avatarSrc}
                              alt={m.memberName}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-bold text-slate-300 text-sm">
                              {m.memberName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="absolute bottom-0 right-0 bg-slate-900/90 text-[10px] font-mono px-1 rounded-tl text-slate-400 font-bold border-t border-l border-slate-700">
                            #{m.joinOrder}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">
                              {m.memberName}
                            </span>
                            {isCurrentRecipient && (
                              <span className="text-[11px] font-medium text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                                Next in Line
                              </span>
                            )}
                            {m.hasReceivedPayout && (
                              <span className="text-[11px] font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                                Received Pot (Week {m.payoutWeekReceived})
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                            <span>Payout Order #{m.joinOrder}</span>
                            <span>·</span>
                            <span className="font-mono tabular-nums">
                              Contribution: {formatPesewas(m.paidPesewas)} / {formatPesewas(report.weeklyContributionPesewas)} GHS
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Payment Status & Pay Action */}
                      <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                        <div className="text-left sm:text-right">
                          <div className={`text-xs font-bold font-mono tabular-nums ${
                            m.isPaidInFull ? 'text-emerald-400' : 'text-amber-400'
                          }`}>
                            {m.isPaidInFull ? 'PAID IN FULL' : `OWES ${formatPesewas(m.owedPesewas)} GHS`}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {m.isPaidInFull ? 'Zero balance remaining' : `Paid ${formatPesewas(m.paidPesewas)} GHS so far`}
                          </div>
                        </div>

                        {!m.isPaidInFull && !report.cycleCompleted && (
                          <button
                            onClick={() => {
                              setSelectedMemberName(m.memberName);
                              setPayAmount(formatPesewas(m.owedPesewas));
                              setPayWeek(report.currentWeek);
                              setShowPayModal(true);
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition"
                          >
                            Pay Dues
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {report.membersStatus.length === 0 && (
                  <div className="p-8 text-center text-slate-500 text-sm">
                    No members enrolled yet. Click "Add Member" to register members.
                  </div>
                )}
              </div>
            </div>

            {/* Historical Payout Ledger */}
            <div className="bg-[#111726] border border-slate-800/80 rounded-xl overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-800/80">
                <h2 className="text-base font-semibold text-white">
                  Historical Payout Ledger
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Permanent record of disbursed weekly pots with exact integer amounts and recipient order.
                </p>
              </div>

              {report.payoutHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Week</th>
                        <th className="px-5 py-3 font-semibold">Recipient Member</th>
                        <th className="px-5 py-3 font-semibold">Join Order</th>
                        <th className="px-5 py-3 font-semibold text-right">Pot Disbursed</th>
                        <th className="px-5 py-3 font-semibold text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
                      {report.payoutHistory.map((p) => (
                        <tr key={p.week} className="hover:bg-slate-800/30 transition">
                          <td className="px-5 py-3.5 font-bold text-white">
                            Week {p.week}
                          </td>
                          <td className="px-5 py-3.5 font-sans font-medium text-white flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-800 border border-slate-700 shrink-0">
                              {AVATAR_MAP[p.recipientName.toLowerCase()] ? (
                                <img
                                  src={AVATAR_MAP[p.recipientName.toLowerCase()]}
                                  alt={p.recipientName}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-400">
                                  {p.recipientName.charAt(0)}
                                </div>
                              )}
                            </div>
                            <span>{p.recipientName}</span>
                          </td>
                          <td className="px-5 py-3.5 text-slate-400">
                            #{p.recipientOrder} in rotation
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-emerald-400 tabular-nums">
                            {formatGHS(p.potAmountPesewas)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-sans">
                            <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              Disbursed &amp; Closed
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No weekly pots have been disbursed yet. Once Week 1 is fully paid and closed, payouts appear here.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: INTERACTIVE TERMINAL & CLI REPL                        */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'terminal' && (
          <div className="flex-1 flex flex-col bg-[#050811] border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            {/* Terminal Window Header */}
            <div className="bg-[#0b101d] border-b border-slate-800 px-4 py-2.5 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
                <span className="ml-2 font-mono text-slate-300">susu-cli (Node.js engine)</span>
              </div>
              <div className="flex items-center gap-2 font-mono">
                <button
                  onClick={() => executeCommand('example')}
                  className="px-2 py-0.5 border border-slate-700 rounded text-slate-300 hover:text-emerald-400 text-[11px]"
                >
                  run example
                </button>
                <button
                  onClick={() => executeCommand('test')}
                  className="px-2 py-0.5 border border-slate-700 rounded text-slate-300 hover:text-amber-400 text-[11px]"
                >
                  run test
                </button>
                <button
                  onClick={() => executeCommand('report')}
                  className="px-2 py-0.5 border border-slate-700 rounded text-slate-300 hover:text-sky-400 text-[11px]"
                >
                  report
                </button>
                <button
                  onClick={() => setTerminalLines([])}
                  className="px-2 py-0.5 text-slate-500 hover:text-slate-300 text-[11px]"
                >
                  clear
                </button>
              </div>
            </div>

            {/* Terminal Output Body */}
            <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-1 font-mono text-xs md:text-sm min-h-[480px] max-h-[65vh]">
              {terminalLines.map((line) => {
                if (line.type === 'input') {
                  return <div key={line.id} className="text-emerald-400 font-semibold">{line.text}</div>;
                }
                if (line.type === 'error') {
                  return <div key={line.id} className="text-rose-400 font-semibold bg-rose-950/20 px-2 py-1 rounded border-l-2 border-rose-500">{line.text}</div>;
                }
                if (line.type === 'success') {
                  return <div key={line.id} className="text-emerald-300 bg-emerald-950/20 px-2 py-0.5 rounded">{line.text}</div>;
                }
                if (line.type === 'system') {
                  return <div key={line.id} className="text-amber-300 font-medium">{line.text}</div>;
                }
                if (line.type === 'header') {
                  return <div key={line.id} className="text-slate-500 select-none">{line.text}</div>;
                }
                return <div key={line.id} className="text-slate-300 whitespace-pre">{line.text}</div>;
              })}
              <div ref={terminalBottomRef} />
            </div>

            {/* Terminal Input Bar */}
            <div className="bg-[#0b101d] border-t border-slate-800 p-2.5 flex items-center gap-2">
              <span className="text-emerald-400 font-mono font-bold text-sm pl-2">susu&gt;</span>
              <input
                ref={terminalInputRef}
                type="text"
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    executeCommand(terminalInput);
                    setTerminalInput('');
                  } else if (e.key === 'ArrowUp' && history.length > 0) {
                    const nextIdx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
                    setHistoryIdx(nextIdx);
                    setTerminalInput(history[nextIdx]);
                  } else if (e.key === 'ArrowDown' && history.length > 0 && historyIdx !== -1) {
                    const nextIdx = historyIdx + 1;
                    if (nextIdx >= history.length) {
                      setHistoryIdx(-1);
                      setTerminalInput('');
                    } else {
                      setHistoryIdx(nextIdx);
                      setTerminalInput(history[nextIdx]);
                    }
                  }
                }}
                placeholder="Type command (e.g. 'help', 'report', 'pay Ama 1 50.00', 'close 1')..."
                className="flex-1 bg-transparent border-0 text-white font-mono text-sm focus:outline-none placeholder-slate-600"
                autoFocus
              />
              <button
                onClick={() => {
                  executeCommand(terminalInput);
                  setTerminalInput('');
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded text-xs flex items-center gap-1 font-mono transition"
              >
                <Send className="w-3.5 h-3.5" />
                run
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: REST API EXPLORER & CURL SAMPLES                       */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'api' && (
          <div className="space-y-4">
            <div className="bg-[#111726] border border-slate-800/80 rounded-xl p-5">
              <div className="flex items-center gap-2.5 mb-2">
                <Server className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-semibold text-white">
                  Susu REST API Interface
                </h2>
              </div>
              <p className="text-xs text-slate-400">
                The Express backend runs on port 3000. All endpoints accept and return exact JSON, validate zero/negative amounts, enforce roster locks, and handle payments in integer pesewas.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {/* Endpoint 1: Report */}
              <div className="bg-[#111726] border border-slate-800/80 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800/60 font-mono">
                      GET
                    </span>
                    <span className="text-xs font-mono font-bold text-white">/api/group/report</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard('curl -s http://localhost:3000/api/group/report', 'report')}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedEndpoint === 'report' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy cURL
                  </button>
                </div>
                <p className="text-xs text-slate-400 mb-2">Returns complete current group state, member payment statuses, expected pot, and payout history.</p>
                <pre className="bg-black/60 p-3 rounded-lg text-slate-300 font-mono text-xs overflow-x-auto border border-slate-800">
                  curl -s http://localhost:3000/api/group/report
                </pre>
              </div>

              {/* Endpoint 2: Record Contribution */}
              <div className="bg-[#111726] border border-slate-800/80 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-mono">
                      POST
                    </span>
                    <span className="text-xs font-mono font-bold text-white">/api/group/contribute</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(`curl -s -X POST http://localhost:3000/api/group/contribute -H "Content-Type: application/json" -d '{"memberName":"Ama","week":1,"amountGhs":"50.00"}'`, 'contribute')}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedEndpoint === 'contribute' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy cURL
                  </button>
                </div>
                <p className="text-xs text-slate-400 mb-2">Records contribution for a member. Validates active week, rejects unknown members, and rejects overpayments.</p>
                <pre className="bg-black/60 p-3 rounded-lg text-slate-300 font-mono text-xs overflow-x-auto border border-slate-800">
                  {`curl -s -X POST http://localhost:3000/api/group/contribute \\
  -H "Content-Type: application/json" \\
  -d '{"memberName":"Ama", "week":1, "amountGhs":"50.00"}'`}
                </pre>
              </div>

              {/* Endpoint 3: Close Week */}
              <div className="bg-[#111726] border border-slate-800/80 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800/60 font-mono">
                      POST
                    </span>
                    <span className="text-xs font-mono font-bold text-white">/api/group/close-week</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(`curl -s -X POST http://localhost:3000/api/group/close-week -H "Content-Type: application/json" -d '{"week":1}'`, 'close')}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedEndpoint === 'close' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy cURL
                  </button>
                </div>
                <p className="text-xs text-slate-400 mb-2">Attempts to close week. If any member owes, rejects and returns debtor list. If fully paid, disburses pot to next in order.</p>
                <pre className="bg-black/60 p-3 rounded-lg text-slate-300 font-mono text-xs overflow-x-auto border border-slate-800">
                  {`curl -s -X POST http://localhost:3000/api/group/close-week \\
  -H "Content-Type: application/json" \\
  -d '{"week":1}'`}
                </pre>
              </div>

              {/* Endpoint 4: Create Group */}
              <div className="bg-[#111726] border border-slate-800/80 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800/60 font-mono">
                      POST
                    </span>
                    <span className="text-xs font-mono font-bold text-white">/api/group/create</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(`curl -s -X POST http://localhost:3000/api/group/create -H "Content-Type: application/json" -d '{"name":"AccraTraders","weeklyContributionGhs":"50.00"}'`, 'create')}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedEndpoint === 'create' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy cURL
                  </button>
                </div>
                <pre className="bg-black/60 p-3 rounded-lg text-slate-300 font-mono text-xs overflow-x-auto border border-slate-800">
                  {`curl -s -X POST http://localhost:3000/api/group/create \\
  -H "Content-Type: application/json" \\
  -d '{"name":"AccraTraders", "weeklyContributionGhs":"50.00"}'`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 4: RULES & WRITTEN ASSUMPTIONS                            */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'assumptions' && (
          <div className="space-y-4">
            <div className="bg-[#111726] border border-slate-800/80 rounded-xl p-5">
              <div className="flex items-center gap-2.5 mb-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-semibold text-white">
                  System Rules, Mathematics &amp; Assumptions
                </h2>
              </div>
              <p className="text-xs text-slate-400">
                Documentation of design decisions, mathematical guarantees, and enforced business rules as mandated by the instructions.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#111726] border border-slate-800/80 rounded-xl p-5 space-y-2">
                <h3 className="text-sm font-semibold text-emerald-400">
                  1. Exact Currency Handling &amp; Zero Rounding Errors
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  All money is stored and computed internally in integer <strong>Pesewas</strong> (1 GHS = 100 Pesewas). String inputs are split into integer and 2-decimal fractional parts, completely eliminating binary floating-point anomalies (such as <code className="font-mono text-slate-200">0.1 + 0.2 !== 0.3</code> or <code className="font-mono text-slate-200">50.29 * 100 = 5028.999999999999</code>).
                </p>
              </div>

              <div className="bg-[#111726] border border-slate-800/80 rounded-xl p-5 space-y-2">
                <h3 className="text-sm font-semibold text-emerald-400">
                  2. Mid-Cycle Member Additions (Enforced Roster Lock)
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  In a rotating savings group, the total weekly pot (<code className="font-mono text-slate-200">N Members × Weekly Dues</code>) and cycle length (<code className="font-mono text-slate-200">N Weeks</code>) depend on a fixed roster. Members may be freely enrolled during the initial group setup, but once contributions begin for Week 1, the roster is locked to ensure fixed pot sizes and rotation integrity.
                </p>
              </div>

              <div className="bg-[#111726] border border-slate-800/80 rounded-xl p-5 space-y-2">
                <h3 className="text-sm font-semibold text-emerald-400">
                  3. Validation &amp; Overpayment Prevention
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  • <strong>Duplicate Members:</strong> Case-insensitive name uniqueness is enforced.<br />
                  • <strong>Unknown Members:</strong> Payments from unregistered members are rejected.<br />
                  • <strong>Zero or Negative:</strong> Amounts ≤ 0.00 GHS are rejected.<br />
                  • <strong>Overpayments:</strong> A member cannot pay more than their remaining owed balance for that week (e.g. if owing 20.00 GHS, paying 25.00 GHS is rejected).
                </p>
              </div>

              <div className="bg-[#111726] border border-slate-800/80 rounded-xl p-5 space-y-2">
                <h3 className="text-sm font-semibold text-emerald-400">
                  4. Week Closure &amp; Payout Sequence
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  A week can only close if 100% of registered members have paid in full. If anyone has an outstanding balance, the pot is held and a detailed list of debtors and remaining amounts is reported. When all have paid, the entire pot is disbursed to the next member in join order, and the cycle moves to the next week.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: RECORD CONTRIBUTION                                    */}
      {/* ------------------------------------------------------------- */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111726] border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                Record Member Contribution
              </h3>
              <button
                onClick={() => setShowPayModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePaySubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Select Member:</label>
                <select
                  value={selectedMemberName}
                  onChange={(e) => {
                    setSelectedMemberName(e.target.value);
                    const memberStatus = report.membersStatus.find((m) => m.memberName === e.target.value);
                    if (memberStatus) {
                      setPayAmount(formatPesewas(memberStatus.owedPesewas));
                    }
                  }}
                  className="w-full bg-[#0b0f17] border border-slate-800 rounded-lg p-2.5 text-white font-medium focus:border-emerald-500 focus:outline-none"
                >
                  {report.members.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name} (Order #{m.joinOrder})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1.5 font-medium">Week Number:</label>
                  <input
                    type="number"
                    min="1"
                    value={payWeek}
                    onChange={(e) => setPayWeek(parseInt(e.target.value, 10))}
                    className="w-full bg-[#0b0f17] border border-slate-800 rounded-lg p-2.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1.5 font-medium">Amount in GHS:</label>
                  <input
                    type="text"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="50.00"
                    className="w-full bg-[#0b0f17] border border-slate-800 rounded-lg p-2.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Balance helper text */}
              {(() => {
                const cur = report.membersStatus.find((m) => m.memberName === selectedMemberName);
                if (!cur) return null;
                return (
                  <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800 text-[11px] text-slate-400">
                    <span className="font-semibold text-white">{selectedMemberName}</span> currently owes{' '}
                    <strong className="text-amber-400 font-mono">{formatPesewas(cur.owedPesewas)} GHS</strong> (Paid {formatPesewas(cur.paidPesewas)} of {formatPesewas(report.weeklyContributionPesewas)} GHS).
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="px-3.5 py-2 text-slate-400 hover:text-white rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-semibold rounded-lg transition"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: ADD MEMBER                                             */}
      {/* ------------------------------------------------------------- */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111726] border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                Add Member to Group
              </h3>
              <button
                onClick={() => setShowAddMemberModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMemberSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Member Name or Unique ID:</label>
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="e.g., Kwame, Akosua, or ID-104"
                  className="w-full bg-[#0b0f17] border border-slate-800 rounded-lg p-2.5 text-white font-medium focus:border-emerald-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <p className="text-[11px] text-slate-400">
                Members receive weekly pots in the order they join (Next assigned position: <strong>Order #{report.totalMembers + 1}</strong>).
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="px-3.5 py-2 text-slate-400 hover:text-white rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-semibold rounded-lg transition"
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: CREATE NEW GROUP                                       */}
      {/* ------------------------------------------------------------- */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111726] border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-400" />
                Initialize New Susu Group
              </h3>
              <button
                onClick={() => setShowCreateGroupModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGroupSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Group Name:</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Accra Central Traders Susu"
                  className="w-full bg-[#0b0f17] border border-slate-800 rounded-lg p-2.5 text-white font-medium focus:border-emerald-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Fixed Weekly Contribution in GHS:</label>
                <input
                  type="text"
                  value={newGroupWeekly}
                  onChange={(e) => setNewGroupWeekly(e.target.value)}
                  placeholder="50.00"
                  className="w-full bg-[#0b0f17] border border-slate-800 rounded-lg p-2.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="px-3.5 py-2 text-slate-400 hover:text-white rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-semibold rounded-lg transition"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#0b0f17] py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            Ghanaian Cedi (GHS) Rotating Savings Group Engine · Exact Integer Pesewas
          </div>
          <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
            <span>CLI: <code className="text-slate-300">npm run cli</code></span>
            <span>·</span>
            <span>Test: <code className="text-slate-300">npm test</code></span>
            <span>·</span>
            <span>Example: <code className="text-slate-300">npm run example</code></span>
          </div>
        </div>
      </footer>
    </div>
  );
}
