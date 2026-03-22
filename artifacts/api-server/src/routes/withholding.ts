import { Router, IRouter } from "express";
import { db } from "@workspace/db";
import { withholdingEntriesTable, engagementsTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { withAuth, AuthenticatedRequest } from "../lib/auth";

const router: IRouter = Router();

const WHT_RATES: Record<string, number> = {
  "153(1)(a)": 3.5,
  "153(1)(b)": 4.5,
  "153(1)(c)": 8.0,
  "149": 1.0,
  "154": 1.0,
  "155": 15.0,
  "156": 10.0,
  "152": 5.0,
  "161": 0,
};

router.get("/:engagementId", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { engagementId } = req.params;
    const entries = await db.select().from(withholdingEntriesTable)
      .where(eq(withholdingEntriesTable.engagementId, engagementId));

    const enriched = entries.map(e => {
      const expectedRate = WHT_RATES[e.sectionCode] ?? e.expectedRate ?? 0;
      const shortDeduction = Math.max(0, (e.grossAmount * expectedRate / 100) - (e.whtDeducted ?? 0));
      const overDeduction = Math.max(0, (e.whtDeducted ?? 0) - (e.grossAmount * expectedRate / 100));
      const isException = shortDeduction > 1000 || overDeduction > 1000;
      return { ...e, expectedRate, shortDeduction, overDeduction, isException };
    });

    const kpis = {
      totalPaymentsReviewed: entries.reduce((sum, e) => sum + (e.grossAmount ?? 0), 0),
      exceptionsCount: enriched.filter(e => e.isException).length,
      likelyShortDeductionExposure: enriched.reduce((sum, e) => sum + e.shortDeduction, 0),
      unresolvedHighRiskItems: enriched.filter(e => e.isException).length,
    };

    res.json({ entries: enriched, kpis });
  } catch (err) {
    req.log.error({ err }, "Get withholding error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
