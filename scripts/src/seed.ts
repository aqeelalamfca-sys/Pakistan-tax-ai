import { db } from "@workspace/db";
import {
  firmsTable, usersTable, clientsTable, engagementsTable,
  taxRulesTable, withholdingEntriesTable, vaultDocumentsTable,
} from "@workspace/db/schema";
import bcrypt from "bcrypt";

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log("Seeding Tax Intelligence Engine...");

  const [firm1] = await db.insert(firmsTable).values({
    name: "A.F. Ferguson & Co. (Demo)",
    registrationNo: "SECP-001",
    address: "7th Floor, State Life Building, I.I. Chundrigar Road, Karachi",
    email: "info@afferguson.demo",
    phone: "+92-21-111-343-343",
  }).returning();

  const [firm2] = await db.insert(firmsTable).values({
    name: "KPMG Taseer Hadi (Demo)",
    registrationNo: "SECP-002",
    address: "6th Floor, Serena Business Complex, Islamabad",
    email: "info@kpmg.demo",
    phone: "+92-51-2803-201",
  }).returning();

  console.log("Firms created:", firm1.id, firm2.id);

  const superAdmin = await db.insert(usersTable).values({
    firmId: firm1.id,
    email: "superadmin@demo.test",
    firstName: "Super",
    lastName: "Admin",
    passwordHash: await hashPassword("Admin@1234"),
    role: "SUPER_ADMIN",
    isActive: true,
    mfaEnabled: false,
  }).returning();

  const partner = await db.insert(usersTable).values({
    firmId: firm1.id,
    email: "partner@demo.test",
    firstName: "Asad",
    lastName: "Khan",
    passwordHash: await hashPassword("Partner@1234"),
    role: "PARTNER",
    isActive: true,
    mfaEnabled: false,
  }).returning();

  const manager = await db.insert(usersTable).values({
    firmId: firm1.id,
    email: "manager@demo.test",
    firstName: "Sara",
    lastName: "Ahmed",
    passwordHash: await hashPassword("Manager@1234"),
    role: "TAX_MANAGER",
    isActive: true,
    mfaEnabled: false,
  }).returning();

  const senior = await db.insert(usersTable).values({
    firmId: firm1.id,
    email: "senior@demo.test",
    firstName: "Omar",
    lastName: "Farooq",
    passwordHash: await hashPassword("Senior@1234"),
    role: "SENIOR",
    isActive: true,
    mfaEnabled: false,
  }).returning();

  console.log("Users created:", superAdmin[0].id, partner[0].id);

  const [client1] = await db.insert(clientsTable).values({
    firmId: firm1.id,
    legalName: "Textile Mills Pvt. Ltd.",
    ntn: "1234567-8",
    businessType: "Private Limited Company",
    industry: "Textile",
    taxTypes: ["income_tax", "sales_tax", "withholding_tax"],
    address: "SITE Area, Karachi",
    contactPersons: [{ name: "Ali Hassan", designation: "CFO", phone: "+92-300-1234567" }],
  }).returning();

  const [client2] = await db.insert(clientsTable).values({
    firmId: firm1.id,
    legalName: "Tech Ventures (SMC-Pvt.) Ltd.",
    ntn: "9876543-2",
    businessType: "SMC-Private Limited",
    industry: "Technology",
    taxTypes: ["income_tax", "withholding_tax"],
    address: "Gulberg III, Lahore",
    contactPersons: [{ name: "Fatima Malik", designation: "CEO", phone: "+92-321-7654321" }],
  }).returning();

  const [client3] = await db.insert(clientsTable).values({
    firmId: firm1.id,
    legalName: "Aziz & Sons (Pvt.) Ltd.",
    ntn: "5555555-5",
    businessType: "Private Limited Company",
    industry: "Manufacturing",
    taxTypes: ["income_tax", "sales_tax", "withholding_tax", "customs"],
    address: "Industrial Estate, Rawalpindi",
  }).returning();

  const [client4] = await db.insert(clientsTable).values({
    firmId: firm1.id,
    legalName: "National Trading Co.",
    ntn: "7777777-7",
    businessType: "Association of Persons",
    industry: "Trading",
    taxTypes: ["income_tax", "withholding_tax"],
    address: "Bolton Market, Karachi",
  }).returning();

  const [client5] = await db.insert(clientsTable).values({
    firmId: firm1.id,
    legalName: "Dr. Raza Medical Practice",
    ntn: "3333333-3",
    cnic: "42201-1234567-1",
    businessType: "Individual",
    industry: "Healthcare",
    taxTypes: ["income_tax"],
    address: "Defence Housing Authority, Karachi",
  }).returning();

  console.log("Clients created:", client1.id, client2.id, client3.id);

  const [eng1] = await db.insert(engagementsTable).values({
    firmId: firm1.id,
    clientId: client1.id,
    title: "Income Tax Return 2024 - Textile Mills",
    taxYear: "2024",
    taxType: "income_tax",
    status: "Under_Review",
    teamMembers: [partner[0].id, manager[0].id, senior[0].id],
  }).returning();

  const [eng2] = await db.insert(engagementsTable).values({
    firmId: firm1.id,
    clientId: client2.id,
    title: "Income Tax Return 2024 - Tech Ventures",
    taxYear: "2024",
    taxType: "income_tax",
    status: "Data_Uploaded",
    teamMembers: [manager[0].id, senior[0].id],
  }).returning();

  const [eng3] = await db.insert(engagementsTable).values({
    firmId: firm1.id,
    clientId: client3.id,
    title: "Income Tax & Sales Tax 2024 - Aziz & Sons",
    taxYear: "2024",
    taxType: "income_tax",
    status: "Draft",
    teamMembers: [senior[0].id],
  }).returning();

  const [eng4] = await db.insert(engagementsTable).values({
    firmId: firm1.id,
    clientId: client4.id,
    title: "Income Tax Return 2024 - National Trading",
    taxYear: "2024",
    taxType: "income_tax",
    status: "Validated",
    teamMembers: [manager[0].id],
  }).returning();

  const [eng5] = await db.insert(engagementsTable).values({
    firmId: firm1.id,
    clientId: client5.id,
    title: "Income Tax Return 2024 - Dr. Raza",
    taxYear: "2024",
    taxType: "income_tax",
    status: "Approved",
    teamMembers: [senior[0].id],
  }).returning();

  console.log("Engagements created:", eng1.id, eng2.id, eng3.id);

  const starterRules = [
    {
      ruleCode: "PKR-INC-001",
      title: "Inadmissible Expense Candidate",
      description: "Flags potential inadmissible expenses under Section 21 of Income Tax Ordinance 2001",
      taxType: "income_tax",
      entityType: "company",
      conditionJson: { field: "expense_category", operator: "in_list", value: ["entertainment", "gifts", "fines", "penalties"] },
      actionJson: { type: "risk_flag", recommendation: "Verify admissibility under Section 21 ITO 2001" },
      severity: "HIGH",
      materialityThreshold: 100000,
      evidenceRequired: true,
      effectiveFrom: "2024-07-01",
    },
    {
      ruleCode: "PKR-INC-002",
      title: "WHT Rate Mismatch",
      description: "Flags when withholding tax rate applied does not match prescribed rate under Income Tax Ordinance",
      taxType: "income_tax",
      conditionJson: { field: "wht_rate", operator: "neq", value: "prescribed_rate", section: "153" },
      actionJson: { type: "risk_flag", recommendation: "Verify WHT rates under Section 153 and other applicable sections" },
      severity: "HIGH",
      materialityThreshold: 50000,
      evidenceRequired: true,
      effectiveFrom: "2024-07-01",
    },
    {
      ruleCode: "PKR-INC-003",
      title: "Missing Evidence for Deduction",
      description: "Detects claimed deductions without supporting documentation",
      taxType: "income_tax",
      conditionJson: { field: "deduction_amount", operator: "gt", value: 0, evidence_attached: false },
      actionJson: { type: "risk_flag", recommendation: "Obtain and attach supporting documentation for all claimed deductions" },
      severity: "MEDIUM",
      materialityThreshold: 25000,
      evidenceRequired: true,
      effectiveFrom: "2024-07-01",
    },
    {
      ruleCode: "PKR-INC-004",
      title: "Unusual Related Party Movement",
      description: "Detects abnormal transactions with related parties per Section 108 ITO 2001",
      taxType: "income_tax",
      conditionJson: { field: "related_party_transaction", operator: "gt", value: 500000 },
      actionJson: { type: "risk_flag", recommendation: "Prepare transfer pricing documentation per Section 108 ITO 2001" },
      severity: "HIGH",
      materialityThreshold: 500000,
      evidenceRequired: true,
      effectiveFrom: "2024-07-01",
    },
    {
      ruleCode: "PKR-INC-005",
      title: "Expense Trend Spike",
      description: "Flags expenses that show unusual spike compared to prior year",
      taxType: "income_tax",
      conditionJson: { field: "expense_variance", operator: "trend_spike", threshold: 50, period: "year" },
      actionJson: { type: "risk_flag", recommendation: "Investigate and document reasons for significant expense increase" },
      severity: "MEDIUM",
      materialityThreshold: 200000,
      evidenceRequired: false,
      effectiveFrom: "2024-07-01",
    },
    {
      ruleCode: "PKR-INC-006",
      title: "Period Mismatch",
      description: "Detects transactions recorded outside the relevant tax period",
      taxType: "income_tax",
      conditionJson: { field: "transaction_date", operator: "not_contains", value: "tax_period" },
      actionJson: { type: "risk_flag", recommendation: "Verify period allocation and adjust if necessary" },
      severity: "MEDIUM",
      materialityThreshold: 10000,
      evidenceRequired: false,
      effectiveFrom: "2024-07-01",
    },
    {
      ruleCode: "PKR-INC-007",
      title: "Missing Invoice Reference",
      description: "Flags expense entries lacking invoice reference numbers",
      taxType: "income_tax",
      conditionJson: { field: "invoice_no", operator: "is_null" },
      actionJson: { type: "risk_flag", recommendation: "Obtain invoice copies for all expense claims" },
      severity: "LOW",
      materialityThreshold: 5000,
      evidenceRequired: false,
      effectiveFrom: "2024-07-01",
    },
    {
      ruleCode: "PKR-INC-008",
      title: "Payroll vs Ledger Inconsistency",
      description: "Detects when payroll expenses in ledger do not match payroll register",
      taxType: "income_tax",
      conditionJson: { field: "payroll_ledger_variance", operator: "gt", value: 10000 },
      actionJson: { type: "risk_flag", recommendation: "Reconcile payroll register with general ledger entries" },
      severity: "HIGH",
      materialityThreshold: 10000,
      evidenceRequired: true,
      effectiveFrom: "2024-07-01",
    },
    {
      ruleCode: "PKR-INC-009",
      title: "Minimum Tax Applicability Check",
      description: "Verifies minimum tax under Section 113 is correctly computed",
      taxType: "income_tax",
      conditionJson: { field: "minimum_tax_rate", operator: "lt", value: 1.5 },
      actionJson: { type: "adjustment", recommendation: "Recalculate minimum tax at 1.5% of turnover per Section 113 ITO 2001" },
      severity: "HIGH",
      materialityThreshold: 0,
      evidenceRequired: false,
      effectiveFrom: "2024-07-01",
    },
    {
      ruleCode: "PKR-INC-010",
      title: "Super Tax Applicability",
      description: "Checks super tax liability for high-income taxpayers per Finance Act 2022",
      taxType: "income_tax",
      entityType: "company",
      conditionJson: { field: "taxable_income", operator: "gt", value: 150000000 },
      actionJson: { type: "adjustment", recommendation: "Apply super tax at applicable rate per Finance Act 2022 Section 4C" },
      severity: "HIGH",
      materialityThreshold: 0,
      evidenceRequired: false,
      effectiveFrom: "2022-07-01",
    },
  ];

  for (const rule of starterRules) {
    await db.insert(taxRulesTable).values(rule).onConflictDoNothing();
  }
  console.log("Tax rules seeded:", starterRules.length);

  const whtEntries = [
    { engagementId: eng1.id, vendorName: "ABC Suppliers (Pvt.) Ltd.", vendorNtn: "1111111-1", sectionCode: "153(1)(a)", paymentNature: "Goods", grossAmount: 5000000, expectedRate: 3.5, actualRate: 3.5, whtDeducted: 175000, certificateStatus: "issued", depositStatus: "deposited" },
    { engagementId: eng1.id, vendorName: "XYZ Services Ltd.", vendorNtn: "2222222-2", sectionCode: "153(1)(b)", paymentNature: "Services", grossAmount: 2000000, expectedRate: 4.5, actualRate: 3.5, whtDeducted: 70000, certificateStatus: "pending", depositStatus: "pending" },
    { engagementId: eng1.id, vendorName: "Khan Contractors", vendorNtn: "3333333-3", sectionCode: "153(1)(c)", paymentNature: "Contracts", grossAmount: 1500000, expectedRate: 8.0, actualRate: 8.0, whtDeducted: 120000, certificateStatus: "issued", depositStatus: "deposited" },
    { engagementId: eng1.id, vendorName: "Related Party Corp.", vendorNtn: "4444444-4", sectionCode: "153(1)(a)", paymentNature: "Goods", grossAmount: 8000000, expectedRate: 3.5, actualRate: 0, whtDeducted: 0, certificateStatus: "missing", depositStatus: "not_deposited" },
  ];

  for (const entry of whtEntries) {
    await db.insert(withholdingEntriesTable).values(entry);
  }
  console.log("WHT entries seeded");

  const vaultDocs = [
    {
      title: "Income Tax Ordinance, 2001 (Consolidated)",
      docType: "legislation",
      taxType: "income_tax",
      jurisdiction: "Federal",
      lawSection: "Full Ordinance",
      effectiveDate: "2001-07-01",
      issueDate: "2001-06-13",
      status: "active",
      priority: 1,
      tags: ["ITO", "income_tax", "ordinance"],
      summary: "The primary legislation governing income tax in Pakistan. Applies to all taxpayers including companies, AOPs, and individuals.",
      fileName: "ito-2001-consolidated.pdf",
      filePath: "/tmp/vault/placeholder-ito-2001.pdf",
      mimeType: "application/pdf",
      uploadedBy: superAdmin[0].id,
      indexedAt: new Date(),
    },
    {
      title: "Finance Act 2024 - Tax Amendments",
      docType: "legislation",
      taxType: "income_tax",
      jurisdiction: "Federal",
      lawSection: "Various Amendments",
      effectiveDate: "2024-07-01",
      issueDate: "2024-06-26",
      status: "active",
      priority: 1,
      tags: ["Finance_Act", "2024", "amendments"],
      summary: "Finance Act 2024 amendments to Income Tax Ordinance 2001, Sales Tax Act 1990, and Federal Excise Act 2005.",
      fileName: "finance-act-2024.pdf",
      filePath: "/tmp/vault/placeholder-finance-act-2024.pdf",
      mimeType: "application/pdf",
      uploadedBy: superAdmin[0].id,
      indexedAt: new Date(),
    },
    {
      title: "SRO 1243(I)/2023 - WHT Rates Notification",
      docType: "sro",
      taxType: "withholding_tax",
      jurisdiction: "Federal",
      lawSection: "Section 153",
      effectiveDate: "2023-12-01",
      issueDate: "2023-11-28",
      status: "active",
      priority: 2,
      tags: ["SRO", "withholding", "rates", "153"],
      summary: "FBR SRO prescribing revised withholding tax rates on supply of goods, services, and execution of contracts under Section 153.",
      fileName: "sro-1243-2023.pdf",
      filePath: "/tmp/vault/placeholder-sro-1243.pdf",
      mimeType: "application/pdf",
      uploadedBy: superAdmin[0].id,
      indexedAt: new Date(),
    },
    {
      title: "Circular No. 2/2024 - Super Tax Computation",
      docType: "circular",
      taxType: "income_tax",
      jurisdiction: "Federal",
      lawSection: "Section 4C",
      effectiveDate: "2024-01-01",
      issueDate: "2024-01-15",
      status: "active",
      priority: 2,
      tags: ["circular", "super_tax", "4C"],
      summary: "FBR clarification on computation methodology for super tax under Section 4C for tax year 2024.",
      fileName: "circular-2-2024.pdf",
      filePath: "/tmp/vault/placeholder-circular-2-2024.pdf",
      mimeType: "application/pdf",
      uploadedBy: superAdmin[0].id,
      indexedAt: new Date(),
    },
    {
      title: "Schedule I - Tax Rates for Companies TY 2024",
      docType: "schedule",
      taxType: "income_tax",
      jurisdiction: "Federal",
      lawSection: "First Schedule - Part I",
      effectiveDate: "2024-07-01",
      issueDate: "2024-06-26",
      status: "active",
      priority: 1,
      tags: ["schedule", "rates", "companies", "2024"],
      summary: "Tax rates applicable to companies for tax year 2024. Rate: 29% for all companies except banking companies (39%).",
      fileName: "schedule-i-2024.txt",
      filePath: "/tmp/vault/placeholder-schedule-i.txt",
      mimeType: "text/plain",
      uploadedBy: superAdmin[0].id,
      indexedAt: new Date(),
    },
  ];

  for (const doc of vaultDocs) {
    await db.insert(vaultDocumentsTable).values(doc).onConflictDoNothing();
  }
  console.log("Vault documents seeded:", vaultDocs.length);

  console.log("\n✅ Seed completed successfully!\n");
  console.log("Demo login credentials:");
  console.log("  Super Admin: superadmin@demo.test / Admin@1234");
  console.log("  Partner:     partner@demo.test / Partner@1234");
  console.log("  Manager:     manager@demo.test / Manager@1234");
  console.log("  Senior:      senior@demo.test / Senior@1234");
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
