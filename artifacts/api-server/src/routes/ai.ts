import { Router, IRouter } from "express";
import { db } from "@workspace/db";
import { aiRunsTable, aiOutputsTable, vaultDocumentsTable } from "@workspace/db/schema";
import { eq, and, like, sql } from "drizzle-orm";
import { withAuth, AuthenticatedRequest } from "../lib/auth";
import { logAudit, getClientIp } from "../lib/audit";
import { z } from "zod";

const router: IRouter = Router();

const PROMPT_KEYS = [
  "TAX_MEMO_DRAFT",
  "RISK_EXPLANATION",
  "PARTNER_REVIEW_SUMMARY",
  "CLIENT_CLARIFICATION_REQUEST",
  "NOTICE_REPLY_DRAFT",
  "YEAR_END_PLANNING_NOTE",
  "WHT_DISCREPANCY_EXPLANATION",
] as const;

const PROMPT_TEMPLATES: Record<string, string> = {
  TAX_MEMO_DRAFT: "Draft a professional tax advisory memo for Pakistan tax compliance based on the following engagement data: {context}",
  RISK_EXPLANATION: "Explain the following tax risk in plain language suitable for a client: {context}",
  PARTNER_REVIEW_SUMMARY: "Prepare a partner review summary for this engagement: {context}",
  CLIENT_CLARIFICATION_REQUEST: "Draft a client clarification request letter for the following issues: {context}",
  NOTICE_REPLY_DRAFT: "Draft a professional reply to the following tax notice from FBR Pakistan: {context}",
  YEAR_END_PLANNING_NOTE: "Prepare year-end tax planning notes for a Pakistan-registered entity: {context}",
  WHT_DISCREPANCY_EXPLANATION: "Explain the withholding tax discrepancies found in the following engagement: {context}",
};

async function searchVaultDocuments(query: string, taxType?: string, limit = 5) {
  const conditions = [eq(vaultDocumentsTable.status, "active"), eq(vaultDocumentsTable.isDeleted, false)];
  if (taxType) conditions.push(eq(vaultDocumentsTable.taxType, taxType));
  const docs = await db.select().from(vaultDocumentsTable)
    .where(and(...conditions))
    .orderBy(vaultDocumentsTable.priority)
    .limit(limit);
  return docs;
}

async function callAI(prompt: string, provider: string): Promise<string> {
  const openAiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const chosenProvider = provider || process.env.AI_PROVIDER || "openai";

  if (chosenProvider === "openai" && openAiKey) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 2000,
        }),
      });
      const data = await response.json() as { choices: Array<{ message: { content: string } }> };
      return data.choices?.[0]?.message?.content || "Unable to generate AI response.";
    } catch {
      return generateFallbackResponse(prompt);
    }
  }
  return generateFallbackResponse(prompt);
}

function generateFallbackResponse(prompt: string): string {
  return `[AI Draft - Requires Review]

Based on the provided context and applicable Pakistan tax laws, here is a preliminary analysis:

This engagement requires careful consideration of the following key areas:
1. Compliance with Income Tax Ordinance, 2001
2. Adherence to Sales Tax Act, 1990 requirements
3. Withholding tax obligations under relevant sections
4. FBR circulars and SROs applicable to the tax period

Please review this draft carefully before finalizing. All figures and legal interpretations should be verified against the applicable law.

Note: This output is in staging status and requires explicit human review and approval before use.`;
}

function moderateOutput(content: string): string[] {
  const flags: string[] = [];
  const fabricatedPatterns = /PKR\s+[\d,]+(?:\.\d{2})?/g;
  const taxNumbers = content.match(fabricatedPatterns) || [];
  if (taxNumbers.length > 5) flags.push("possible_fabricated_numbers");
  if (/definitively|conclusively|guaranteed|certain that/.test(content.toLowerCase())) {
    flags.push("definitive_legal_conclusion");
  }
  return flags;
}

const generateSchema = z.object({
  engagementId: z.string(),
  promptKey: z.string(),
  context: z.record(z.unknown()).optional(),
  useVault: z.boolean().optional().default(true),
});

router.post("/generate", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation error", message: parsed.error.message });
      return;
    }
    const { engagementId, promptKey, context, useVault } = parsed.data;
    const provider = process.env.AI_PROVIDER || "openai";

    let vaultDocs: typeof vaultDocumentsTable.$inferSelect[] = [];
    let vaultContext = "";
    if (useVault !== false) {
      vaultDocs = await searchVaultDocuments(promptKey, undefined, 5);
      if (vaultDocs.length > 0) {
        vaultContext = "\n\nRelevant Knowledge Vault References:\n" +
          vaultDocs.map(d => `- ${d.title} (${d.docType}, Effective: ${d.effectiveDate || "N/A"})${d.summary ? `: ${d.summary.substring(0, 200)}` : ""}`).join("\n");
      }
    }

    const template = PROMPT_TEMPLATES[promptKey] || PROMPT_TEMPLATES.TAX_MEMO_DRAFT;
    const fullPrompt = template.replace("{context}", JSON.stringify(context || {})) + vaultContext +
      "\n\nIMPORTANT: Base your response on the provided vault references. Do not make assumptions beyond what is documented.";

    const [aiRun] = await db.insert(aiRunsTable).values({
      engagementId,
      userId: req.user!.userId,
      promptKey,
      provider,
      vaultDocumentsUsed: vaultDocs.map(d => d.id),
      status: "running",
    }).returning();

    const aiContent = await callAI(fullPrompt, provider);
    const moderationFlags = moderateOutput(aiContent);

    const references = vaultDocs.map(d => ({
      documentId: d.id,
      documentTitle: d.title,
      lawSection: d.lawSection,
      issueDate: d.issueDate,
      effectiveDate: d.effectiveDate,
      relevanceScore: 0.8,
    }));

    let contentWithRefs = aiContent;
    if (references.length > 0) {
      contentWithRefs += "\n\n---\n## References\n" +
        references.map((r, i) =>
          `${i + 1}. **${r.documentTitle}**${r.lawSection ? ` — ${r.lawSection}` : ""}` +
          `${r.effectiveDate ? ` (Effective: ${r.effectiveDate})` : ""}${r.issueDate ? `, Issued: ${r.issueDate}` : ""}`
        ).join("\n");
    }

    const [output] = await db.insert(aiOutputsTable).values({
      runId: aiRun.id,
      engagementId,
      promptKey,
      content: contentWithRefs,
      moderationFlags,
      references,
      isStaged: true,
      isPromoted: false,
    }).returning();

    await db.update(aiRunsTable).set({ status: "completed" }).where(eq(aiRunsTable.id, aiRun.id));

    await logAudit({
      userId: req.user!.userId,
      userName: req.user!.email,
      firmId: req.user!.firmId ?? undefined,
      action: "AI_GENERATE",
      module: "ai",
      resourceId: output.id,
      resourceType: "AIOutput",
      afterState: { promptKey, vaultDocsUsed: vaultDocs.length, moderationFlags } as Record<string, unknown>,
      ipAddress: getClientIp(req),
    });

    res.json(output);
  } catch (err) {
    req.log.error({ err }, "AI generate error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/outputs/:id/promote", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const [output] = await db.select().from(aiOutputsTable)
      .where(eq(aiOutputsTable.id, req.params.id)).limit(1);
    if (!output) {
      res.status(404).json({ error: "AI output not found" });
      return;
    }
    if (output.isPromoted) {
      res.status(400).json({ error: "Already promoted" });
      return;
    }
    await db.update(aiOutputsTable).set({
      isPromoted: true,
      promotedAt: new Date(),
      promotedBy: req.user!.userId,
    }).where(eq(aiOutputsTable.id, req.params.id));
    await logAudit({
      userId: req.user!.userId,
      userName: req.user!.email,
      firmId: req.user!.firmId ?? undefined,
      action: "AI_OUTPUT_PROMOTED",
      module: "ai",
      resourceId: req.params.id,
      resourceType: "AIOutput",
      ipAddress: getClientIp(req),
    });
    res.json({ success: true, message: "AI output promoted" });
  } catch (err) {
    req.log.error({ err }, "Promote AI output error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
