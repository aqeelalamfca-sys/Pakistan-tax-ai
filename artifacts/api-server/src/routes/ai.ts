import { Router, IRouter } from "express";
import { db } from "@workspace/db";
import { aiRunsTable, aiOutputsTable, aiConfigTable, vaultDocumentsTable } from "@workspace/db/schema";
import { eq, and, like, sql } from "drizzle-orm";
import { withAuth, AuthenticatedRequest, requireRole } from "../lib/auth";
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

async function getAiConfig(key: string): Promise<string | null> {
  try {
    const [row] = await db.select().from(aiConfigTable).where(eq(aiConfigTable.configKey, key)).limit(1);
    return row?.configValue || null;
  } catch {
    return null;
  }
}

async function getActiveProvider(): Promise<{ provider: string; model: string; apiKey: string | null }> {
  const dbProvider = await getAiConfig("ai_provider");
  const dbModel = await getAiConfig("ai_model");
  const dbOpenAiKey = await getAiConfig("openai_api_key");
  const dbGeminiKey = await getAiConfig("gemini_api_key");

  const provider = dbProvider || process.env.AI_PROVIDER || "openai";
  const model = dbModel || (provider === "gemini" ? "gemini-1.5-flash" : "gpt-4o-mini");
  const apiKey = provider === "gemini"
    ? (dbGeminiKey || process.env.GEMINI_API_KEY || null)
    : (dbOpenAiKey || process.env.OPENAI_API_KEY || null);

  return { provider, model, apiKey };
}

async function searchVaultDocuments(query: string, taxType?: string, limit = 5) {
  const conditions = [eq(vaultDocumentsTable.status, "active"), eq(vaultDocumentsTable.isDeleted, false)];
  if (taxType) conditions.push(eq(vaultDocumentsTable.taxType, taxType));
  const docs = await db.select().from(vaultDocumentsTable)
    .where(and(...conditions))
    .orderBy(vaultDocumentsTable.priority)
    .limit(limit);
  return docs;
}

async function callAI(prompt: string, provider: string, model: string, apiKey: string | null): Promise<{ content: string; tokensUsed?: number; durationMs: number }> {
  const start = Date.now();

  if (provider === "openai" && apiKey) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: model || "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a senior Pakistan tax advisor with deep expertise in Income Tax Ordinance 2001, Sales Tax Act 1990, Federal Excise Act, and all FBR circulars and SROs. Always cite specific law sections. Be precise and professional." },
            { role: "user", content: prompt }
          ],
          max_tokens: 3000,
          temperature: 0.3,
        }),
      });
      const data = await response.json() as any;
      if (data.error) {
        return { content: generateFallbackResponse(prompt, `API Error: ${data.error.message}`), durationMs: Date.now() - start };
      }
      return {
        content: data.choices?.[0]?.message?.content || "Unable to generate AI response.",
        tokensUsed: data.usage?.total_tokens,
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return { content: generateFallbackResponse(prompt, err.message), durationMs: Date.now() - start };
    }
  }

  if (provider === "gemini" && apiKey) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model || "gemini-1.5-flash"}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `You are a senior Pakistan tax advisor. ${prompt}` }] }],
          generationConfig: { maxOutputTokens: 3000, temperature: 0.3 },
        }),
      });
      const data = await response.json() as any;
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        return { content: generateFallbackResponse(prompt, "Empty Gemini response"), durationMs: Date.now() - start };
      }
      return { content, tokensUsed: data.usageMetadata?.totalTokenCount, durationMs: Date.now() - start };
    } catch (err: any) {
      return { content: generateFallbackResponse(prompt, err.message), durationMs: Date.now() - start };
    }
  }

  return { content: generateFallbackResponse(prompt), durationMs: Date.now() - start };
}

function generateFallbackResponse(prompt: string, error?: string): string {
  const errorNote = error ? `\n\n⚠️ AI Provider Error: ${error}\nUsing built-in template response instead.\n` : "";
  return `[AI Draft - Requires Review]${errorNote}

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
    const { provider, model, apiKey } = await getActiveProvider();

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
      model,
      vaultDocumentsUsed: vaultDocs.map(d => d.id),
      status: "running",
    }).returning();

    const result = await callAI(fullPrompt, provider, model, apiKey);
    const moderationFlags = moderateOutput(result.content);

    const references = vaultDocs.map(d => ({
      documentId: d.id,
      documentTitle: d.title,
      lawSection: d.lawSection,
      issueDate: d.issueDate,
      effectiveDate: d.effectiveDate,
      relevanceScore: 0.8,
    }));

    let contentWithRefs = result.content;
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

    await db.update(aiRunsTable).set({
      status: "completed",
      tokenCount: result.tokensUsed?.toString(),
      durationMs: result.durationMs.toString(),
    }).where(eq(aiRunsTable.id, aiRun.id));

    await logAudit({
      userId: req.user!.userId,
      userName: req.user!.email,
      firmId: req.user!.firmId ?? undefined,
      action: "AI_GENERATE",
      module: "ai",
      resourceId: output.id,
      resourceType: "AIOutput",
      afterState: { promptKey, provider, model, vaultDocsUsed: vaultDocs.length, moderationFlags, durationMs: result.durationMs } as Record<string, unknown>,
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

const superAdminOnly = requireRole("SUPER_ADMIN");

router.get("/settings", withAuth, superAdminOnly, async (req: AuthenticatedRequest, res) => {
  try {
    const rows = await db.select().from(aiConfigTable);
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.configKey] = row.isSecret ? maskSecret(row.configValue) : row.configValue;
    }
    const defaults: Record<string, string> = {
      ai_provider: settings.ai_provider || process.env.AI_PROVIDER || "openai",
      ai_model: settings.ai_model || "gpt-4o-mini",
      openai_api_key: settings.openai_api_key || (process.env.OPENAI_API_KEY ? maskSecret(process.env.OPENAI_API_KEY) : ""),
      gemini_api_key: settings.gemini_api_key || (process.env.GEMINI_API_KEY ? maskSecret(process.env.GEMINI_API_KEY) : ""),
      ai_temperature: settings.ai_temperature || "0.3",
      ai_max_tokens: settings.ai_max_tokens || "3000",
      ai_system_prompt: settings.ai_system_prompt || "You are a senior Pakistan tax advisor with deep expertise in Income Tax Ordinance 2001, Sales Tax Act 1990, Federal Excise Act, and all FBR circulars and SROs.",
      vault_search_limit: settings.vault_search_limit || "5",
      moderation_enabled: settings.moderation_enabled || "true",
    };
    res.json({ settings: defaults, isConfigured: !!(settings.openai_api_key || process.env.OPENAI_API_KEY || settings.gemini_api_key || process.env.GEMINI_API_KEY) });
  } catch (err) {
    req.log.error({ err }, "Get AI settings error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/settings", withAuth, superAdminOnly, async (req: AuthenticatedRequest, res) => {
  try {
    const updates = req.body as Record<string, string>;
    const allowedKeys = [
      "ai_provider", "ai_model", "openai_api_key", "gemini_api_key",
      "ai_temperature", "ai_max_tokens", "ai_system_prompt",
      "vault_search_limit", "moderation_enabled",
    ];
    const secretKeys = ["openai_api_key", "gemini_api_key"];

    for (const [key, value] of Object.entries(updates)) {
      if (!allowedKeys.includes(key)) continue;
      if (secretKeys.includes(key) && value && value.includes("••••")) continue;

      const existing = await db.select().from(aiConfigTable).where(eq(aiConfigTable.configKey, key)).limit(1);
      if (existing.length > 0) {
        await db.update(aiConfigTable).set({
          configValue: value,
          isSecret: secretKeys.includes(key),
          updatedBy: req.user!.userId,
          updatedAt: new Date(),
        }).where(eq(aiConfigTable.configKey, key));
      } else {
        await db.insert(aiConfigTable).values({
          configKey: key,
          configValue: value,
          isSecret: secretKeys.includes(key),
          updatedBy: req.user!.userId,
        });
      }
    }

    await logAudit({
      userId: req.user!.userId,
      userName: req.user!.email,
      firmId: req.user!.firmId ?? undefined,
      action: "AI_SETTINGS_UPDATE",
      module: "ai",
      resourceType: "AIConfig",
      afterState: { updatedKeys: Object.keys(updates).filter(k => allowedKeys.includes(k)) } as Record<string, unknown>,
      ipAddress: getClientIp(req),
    });

    res.json({ success: true, message: "AI settings updated" });
  } catch (err) {
    req.log.error({ err }, "Update AI settings error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/test-connection", withAuth, superAdminOnly, async (req: AuthenticatedRequest, res) => {
  try {
    const { provider, apiKey, model } = req.body;
    const testPrompt = "Respond with exactly: 'Connection successful. Pakistan Tax AI Engine is operational.'";
    const result = await callAI(testPrompt, provider || "openai", model || "gpt-4o-mini", apiKey || null);
    const isSuccess = !result.content.includes("AI Provider Error") && !result.content.includes("[AI Draft");
    res.json({
      success: isSuccess,
      message: isSuccess ? "AI connection successful" : "Connection failed - using fallback",
      response: result.content.substring(0, 200),
      durationMs: result.durationMs,
    });
  } catch (err) {
    req.log.error({ err }, "AI test connection error");
    res.status(500).json({ error: "Test failed", message: (err as Error).message });
  }
});

router.get("/stats", withAuth, superAdminOnly, async (req: AuthenticatedRequest, res) => {
  try {
    const [totalRuns] = await db.select({ count: sql<number>`count(*)` }).from(aiRunsTable);
    const [totalOutputs] = await db.select({ count: sql<number>`count(*)` }).from(aiOutputsTable);
    const [promotedOutputs] = await db.select({ count: sql<number>`count(*)` }).from(aiOutputsTable).where(eq(aiOutputsTable.isPromoted, true));
    const recentRuns = await db.select().from(aiRunsTable).orderBy(sql`created_at DESC`).limit(10);
    res.json({
      totalRuns: Number(totalRuns.count),
      totalOutputs: Number(totalOutputs.count),
      promotedOutputs: Number(promotedOutputs.count),
      recentRuns,
    });
  } catch (err) {
    req.log.error({ err }, "AI stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

function maskSecret(value: string): string {
  if (!value || value.length < 8) return "••••••••";
  return value.substring(0, 4) + "••••••••" + value.substring(value.length - 4);
}

export default router;
