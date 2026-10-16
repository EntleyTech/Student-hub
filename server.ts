import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { SusuGroup, SusuError } from './src/susu/SusuGroup.ts';
import { CurrencyError } from './src/susu/currency.ts';
import { runPromptExample, runValidationSuite } from './src/susu/demo.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory active group
let activeGroup = new SusuGroup('Accra Central Traders Susu', '50.00');
// Pre-populate with the initial members from the prompt for convenience
activeGroup.addMember('Ama');
activeGroup.addMember('Kofi');
activeGroup.addMember('Esi');

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // -------------------------------------------------------------
  // SMALL REST API ENDPOINTS
  // -------------------------------------------------------------

  // 1. Get current group report & state
  app.get('/api/group/report', (_req, res) => {
    try {
      if (!activeGroup) {
        return res.status(404).json({ error: 'No active Susu group found. Please create one.' });
      }
      return res.json({
        report: activeGroup.getReport(),
        formattedText: activeGroup.getFormattedReport(),
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 2. Create new group
  app.post('/api/group/create', (req, res) => {
    try {
      const { name, weeklyContributionGhs } = req.body;
      if (!name || weeklyContributionGhs === undefined) {
        return res.status(400).json({
          error: 'Missing required fields: "name" and "weeklyContributionGhs" (e.g. 50.00)',
        });
      }
      activeGroup = new SusuGroup(name, weeklyContributionGhs);
      return res.json({
        message: `Group "${activeGroup.name}" created successfully.`,
        report: activeGroup.getReport(),
      });
    } catch (err: any) {
      const status = err instanceof SusuError || err instanceof CurrencyError ? 400 : 500;
      return res.status(status).json({ error: err.message });
    }
  });

  // 3. Add member
  app.post('/api/group/members', (req, res) => {
    try {
      if (!activeGroup) {
        return res.status(404).json({ error: 'No active Susu group. Create a group first.' });
      }
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Missing required field: "name"' });
      }
      const member = activeGroup.addMember(name);
      return res.json({
        message: `Member "${member.name}" added successfully (Order #${member.joinOrder}).`,
        member,
        report: activeGroup.getReport(),
      });
    } catch (err: any) {
      const status = err instanceof SusuError || err instanceof CurrencyError ? 400 : 500;
      return res.status(status).json({ error: err.message });
    }
  });

  // 4. Record contribution
  app.post('/api/group/contribute', (req, res) => {
    try {
      if (!activeGroup) {
        return res.status(404).json({ error: 'No active Susu group. Create a group first.' });
      }
      const { memberName, week, amountGhs } = req.body;
      if (!memberName || week === undefined || amountGhs === undefined) {
        return res.status(400).json({
          error: 'Missing required fields: "memberName", "week", and "amountGhs"',
        });
      }

      const result = activeGroup.recordContribution(
        memberName,
        parseInt(week, 10),
        amountGhs
      );
      return res.json({
        message: `Contribution recorded: ${result.member.name} paid GHS ${amountGhs} for Week ${result.week}.`,
        result,
        report: activeGroup.getReport(),
      });
    } catch (err: any) {
      const status = err instanceof SusuError || err instanceof CurrencyError ? 400 : 500;
      return res.status(status).json({ error: err.message });
    }
  });

  // 5. Close week
  app.post('/api/group/close-week', (req, res) => {
    try {
      if (!activeGroup) {
        return res.status(404).json({ error: 'No active Susu group. Create a group first.' });
      }
      const { week } = req.body || {};
      const targetWeek = week !== undefined ? parseInt(week, 10) : undefined;
      const result = activeGroup.closeWeek(targetWeek);
      return res.json({
        result,
        report: activeGroup.getReport(),
      });
    } catch (err: any) {
      const status = err instanceof SusuError || err instanceof CurrencyError ? 400 : 500;
      return res.status(status).json({ error: err.message });
    }
  });

  // 6. Run prompt example
  app.post('/api/demo/run-example', (_req, res) => {
    const outcome = runPromptExample();
    return res.json(outcome);
  });

  // 7. Run validation tests
  app.get('/api/demo/run-tests', (_req, res) => {
    const tests = runValidationSuite();
    const passed = tests.filter((t) => t.passed).length;
    return res.json({
      total: tests.length,
      passed,
      failed: tests.length - passed,
      results: tests,
    });
  });

  // -------------------------------------------------------------
  // VITE DEV SERVER OR STATIC PRODUCTION BUILD
  // -------------------------------------------------------------
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Susu Server] Running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Susu Server Error]', err);
  process.exit(1);
});
