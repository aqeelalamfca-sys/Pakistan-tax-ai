import { Router, IRouter } from "express";
import { db } from "@workspace/db";
import { reviewNotesTable, approvalsTable, riskFlagsTable, engagementsTable, usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { withAuth, AuthenticatedRequest, requireRole } from "../lib/auth";
import { logAudit, getClientIp } from "../lib/audit";
import { z } from "zod";

const router: IRouter = Router();

router.get("/:engagementId/notes", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const notes = await db
      .select({
        note: reviewNotesTable,
        authorName: usersTable.firstName,
        authorLastName: usersTable.lastName,
      })
      .from(reviewNotesTable)
      .leftJoin(usersTable, eq(reviewNotesTable.authorId, usersTable.id))
      .where(eq(reviewNotesTable.engagementId, req.params.engagementId));

    const enriched = notes.map(n => ({
      ...n.note,
      authorName: `${n.authorName} ${n.authorLastName}`,
    }));

    const total = enriched.length;
    const openCount = enriched.filter(n => n.status === "open").length;
    res.json({ notes: enriched, total, openCount });
  } catch (err) {
    req.log.error({ err }, "List review notes error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:engagementId/notes", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { content, parentId } = req.body;
    if (!content) {
      res.status(400).json({ error: "Content required" });
      return;
    }
    const [note] = await db.insert(reviewNotesTable).values({
      engagementId: req.params.engagementId,
      authorId: req.user!.userId,
      content,
      parentId,
      status: "open",
    }).returning();
    await logAudit({
      userId: req.user!.userId,
      userName: req.user!.email,
      firmId: req.user!.firmId ?? undefined,
      action: "CREATE_REVIEW_NOTE",
      module: "reviews",
      resourceId: note.id,
      resourceType: "ReviewNote",
      ipAddress: getClientIp(req),
    });
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    res.status(201).json({ ...note, authorName: `${user.firstName} ${user.lastName}` });
  } catch (err) {
    req.log.error({ err }, "Create review note error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:engagementId/approve", withAuth, requireRole("SUPER_ADMIN", "PARTNER"), async (req: AuthenticatedRequest, res) => {
  try {
    const { engagementId } = req.params;
    const openHighRisks = await db.select().from(riskFlagsTable)
      .where(and(
        eq(riskFlagsTable.engagementId, engagementId),
        eq(riskFlagsTable.severity, "HIGH"),
        eq(riskFlagsTable.status, "open"),
      ));
    if (openHighRisks.length > 0) {
      res.status(400).json({ error: `Cannot approve: ${openHighRisks.length} open HIGH severity risk(s) exist.` });
      return;
    }
    const openNotes = await db.select().from(reviewNotesTable)
      .where(and(eq(reviewNotesTable.engagementId, engagementId), eq(reviewNotesTable.status, "open")));
    if (openNotes.length > 0) {
      res.status(400).json({ error: `Cannot approve: ${openNotes.length} open review note(s) exist.` });
      return;
    }
    const [approval] = await db.insert(approvalsTable).values({
      engagementId,
      approvedBy: req.user!.userId,
      comments: req.body.comments,
    }).returning();
    await db.update(engagementsTable).set({ status: "Approved", updatedAt: new Date() })
      .where(eq(engagementsTable.id, engagementId));
    await logAudit({
      userId: req.user!.userId,
      userName: req.user!.email,
      firmId: req.user!.firmId ?? undefined,
      action: "APPROVE_ENGAGEMENT",
      module: "reviews",
      resourceId: engagementId,
      resourceType: "Engagement",
      ipAddress: getClientIp(req),
    });
    const [approver] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    res.json({ ...approval, approverName: `${approver.firstName} ${approver.lastName}` });
  } catch (err) {
    req.log.error({ err }, "Approve engagement error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
