export type WorkLetterRecord = {
  id: string;
  companyId: string;
  language: "ar" | "en";
  savedAt: string;
  data: WorkLetterData;
};

export type WorkLetterData = {
  companyId: string;
  employeeName: string;
  jobTitle: string;
  salary: string;
  salaryWords: string;
  passportNo?: string;
  identityNo?: string;
  birthPlace: string;
  birthDate: string;
  joiningDate: string;
  issueDate: string;
  reference: string;
  internalNo: string;
  issuerName: string;
  recipient: string;
  attention: string;
  subject: string;
  format2PassportNo: string;
  format2SignatoryName: string;
  format2SignatoryTitle: string;
  format3Recipient?: string;
  format3IssueDate?: string;
  format3Subject?: string;
  format3EmployeeName?: string;
  format3PassportNo?: string;
  format3CompanyName?: string;
  format3SignatureCompanyName?: string;
  format3JobTitle?: string;
  format3EmploymentStart?: string;
  format3Salary?: string;
  format3SignatoryName?: string;
  format3SignatoryTitle?: string;
};

export type WorkLetterBackup = {
  app: "good-condition-work-letters";
  version: 1;
  exportedAt: string;
  companyId: string;
  language: "ar" | "en";
  records: WorkLetterRecord[];
};

const DB_NAME = "work-letters-independent-db";
const DB_VERSION = 1;
const STORE = "work_letter_records";
const BACKUP_APP = "good-condition-work-letters" as const;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Database open failed"));
    request.onblocked = () => reject(new Error("Database upgrade is blocked by another open tab"));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("companyId", "companyId", { unique: false });
        store.createIndex("savedAt", "savedAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Database transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Database transaction was cancelled"));
  });
}

async function writeRecords(records: WorkLetterRecord[]) {
  if (!records.length) return;
  const db = await openDatabase();
  try {
    const transaction = db.transaction(STORE, "readwrite");
    const done = transactionDone(transaction);
    const store = transaction.objectStore(STORE);
    records.forEach(record => store.put(record));
    await done;
  } finally {
    db.close();
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeData(value: unknown, fallbackCompanyId?: string): WorkLetterData | null {
  if (!isObject(value)) return null;
  const companyId = typeof value.companyId === "string" ? value.companyId : fallbackCompanyId;
  const requiredStrings = [
    "employeeName", "jobTitle", "salary", "salaryWords", "birthPlace", "birthDate",
    "joiningDate", "issueDate", "reference", "internalNo", "issuerName",
  ];
  if (!companyId || requiredStrings.some(key => typeof value[key] !== "string")) return null;
  const oldIssuerName = value.issuerName as string;
  const [legacySignatoryName, ...legacySignatoryTitleParts] = oldIssuerName.split(/[,،]/).map(part => part.trim());
  return {
    companyId,
    employeeName: value.employeeName as string,
    jobTitle: value.jobTitle as string,
    salary: value.salary as string,
    salaryWords: value.salaryWords as string,
    passportNo: typeof value.passportNo === "string" ? value.passportNo : undefined,
    identityNo: typeof value.identityNo === "string" ? value.identityNo : undefined,
    birthPlace: value.birthPlace as string,
    birthDate: value.birthDate as string,
    joiningDate: value.joiningDate as string,
    issueDate: value.issueDate as string,
    reference: value.reference as string,
    internalNo: value.internalNo as string,
    issuerName: value.issuerName as string,
    recipient: typeof value.recipient === "string" ? value.recipient : "The Embassy of the Republic of Turkey in Amman",
    attention: typeof value.attention === "string" ? value.attention : "The Consular Section",
    subject: typeof value.subject === "string" ? value.subject : "Letter of Verification of Employment and Support",
    format2PassportNo: typeof value.format2PassportNo === "string" ? value.format2PassportNo : "10715207",
    format2SignatoryName: typeof value.format2SignatoryName === "string" ? value.format2SignatoryName : legacySignatoryName || "Ahmed Mohammed",
    format2SignatoryTitle: typeof value.format2SignatoryTitle === "string" ? value.format2SignatoryTitle : legacySignatoryTitleParts.join(", ") || "Human Resources Manager",
    format3Recipient: typeof value.format3Recipient === "string" ? value.format3Recipient : "TO WHOM IT MAY CONCERN",
    format3IssueDate: typeof value.format3IssueDate === "string" ? value.format3IssueDate : value.issueDate as string,
    format3Subject: typeof value.format3Subject === "string" ? value.format3Subject : "Letter of Employment and Salary Verification",
    format3EmployeeName: typeof value.format3EmployeeName === "string" ? value.format3EmployeeName : value.employeeName as string,
    format3PassportNo: typeof value.format3PassportNo === "string" ? value.format3PassportNo : typeof value.format2PassportNo === "string" ? value.format2PassportNo : "10715207",
    format3CompanyName: typeof value.format3CompanyName === "string" ? value.format3CompanyName : companyId === "astar" ? "Aster Gas Yemen Company" : companyId === "master" ? "Master Platinum for Importing Medical and Electronic Equipment and Supplies" : "",
    format3SignatureCompanyName: typeof value.format3SignatureCompanyName === "string" ? value.format3SignatureCompanyName : companyId === "astar" ? "Aster Gas Yemen" : companyId === "master" ? "Master Platinum" : "",
    format3JobTitle: typeof value.format3JobTitle === "string" ? value.format3JobTitle : value.jobTitle as string,
    format3EmploymentStart: typeof value.format3EmploymentStart === "string" ? value.format3EmploymentStart : value.joiningDate as string,
    format3Salary: typeof value.format3Salary === "string" ? value.format3Salary : value.salary as string,
    format3SignatoryName: typeof value.format3SignatoryName === "string" ? value.format3SignatoryName : legacySignatoryName || "Ahmed Mohammed",
    format3SignatoryTitle: typeof value.format3SignatoryTitle === "string" ? value.format3SignatoryTitle : legacySignatoryTitleParts.join(", ") || "Human Resources Manager",
  };
}

function normalizeLegacyRecord(value: unknown, companyId: string, language: "ar" | "en", index: number): WorkLetterRecord | null {
  if (!isObject(value)) return null;
  const dataValue = isObject(value.data) ? value.data : value;
  const data = normalizeData(dataValue, companyId);
  const recordCompanyId = typeof value.companyId === "string" ? value.companyId : data?.companyId;
  const recordLanguage = value.language === "en" || value.language === "ar" ? value.language : language;
  if (!data || recordCompanyId !== companyId || data.companyId !== companyId || recordLanguage !== language) return null;
  const savedAt = typeof value.savedAt === "string" && !Number.isNaN(Date.parse(value.savedAt))
    ? value.savedAt
    : new Date().toISOString();
  const legacyId = typeof value.id === "string" && value.id ? value.id : "";
  const stablePart = encodeURIComponent(data.reference || data.employeeName).slice(0, 60);
  return {
    id: legacyId || `legacy-${companyId}-${language}-${index}-${stablePart}`,
    companyId,
    language,
    savedAt,
    data,
  };
}

export async function saveWorkLetter(data: WorkLetterData, language: "ar" | "en") {
  const record: WorkLetterRecord = {
    id: `${data.companyId}-${language}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    companyId: data.companyId,
    language,
    savedAt: new Date().toISOString(),
    data,
  };
  await writeRecords([record]);
  return record;
}

export async function listWorkLetters(companyId?: string, language?: "ar" | "en") {
  const db = await openDatabase();
  let records: WorkLetterRecord[];
  try {
    records = await new Promise<WorkLetterRecord[]>((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      request.onerror = () => reject(request.error ?? new Error("Read failed"));
      request.onsuccess = () => resolve((request.result as WorkLetterRecord[]).sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
    });
  } finally {
    db.close();
  }
  return records
    .filter(record => (!companyId || record.companyId === companyId) && (!language || record.language === language))
    .flatMap(record => {
      const data = normalizeData(record.data, record.companyId);
      return data ? [{ ...record, data }] : [];
    });
}

export async function deleteWorkLetter(id: string) {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(STORE, "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore(STORE).delete(id);
    await done;
  } finally {
    db.close();
  }
}

/** Copy legacy localStorage records into IndexedDB; source keys are intentionally retained as a safety backup. */
export async function migrateLegacyWorkLetters(companyId: string, language: "ar" | "en") {
  if (typeof localStorage === "undefined") return 0;
  const key = recordsKey(companyId, language);
  const markerKey = `${key}:migrated:v1`;
  if (localStorage.getItem(markerKey)) return 0;
  const raw = localStorage.getItem(key);
  if (raw === null) return 0;

  const parsed: unknown = JSON.parse(raw);
  const candidates = Array.isArray(parsed)
    ? parsed
    : isObject(parsed) && Array.isArray(parsed.records)
      ? parsed.records
      : null;
  if (!candidates) throw new Error("Legacy records have an unsupported format");

  const records = candidates
    .map((record, index) => normalizeLegacyRecord(record, companyId, language, index))
    .filter((record): record is WorkLetterRecord => record !== null);
  await writeRecords(records);
  localStorage.setItem(markerKey, JSON.stringify({ completedAt: new Date().toISOString(), migrated: records.length }));
  return records.length;
}

export async function exportWorkLetterBackup(companyId: string, language: "ar" | "en"): Promise<WorkLetterBackup> {
  await migrateLegacyWorkLetters(companyId, language);
  return {
    app: BACKUP_APP,
    version: 1,
    exportedAt: new Date().toISOString(),
    companyId,
    language,
    records: await listWorkLetters(companyId, language),
  };
}

export async function restoreWorkLetterBackup(content: string, companyId: string, language: "ar" | "en") {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Backup file is not valid JSON");
  }
  if (!isObject(parsed) || parsed.app !== BACKUP_APP || parsed.version !== 1 || parsed.companyId !== companyId || parsed.language !== language) {
    throw new Error("Backup is for a different company/language or an unsupported version");
  }
  if (!Array.isArray(parsed.records)) throw new Error("Backup does not contain a records list");
  if (parsed.records.length > 10000) throw new Error("Backup contains too many records");

  const records = parsed.records.map((value, index) => {
    if (!isObject(value) || typeof value.id !== "string" || !value.id || typeof value.savedAt !== "string") {
      throw new Error(`Invalid record at position ${index + 1}`);
    }
    const data = normalizeData(value.data, companyId);
    if (!data || value.companyId !== companyId || value.language !== language || data.companyId !== companyId) {
      throw new Error(`Record ${index + 1} does not match this company and language`);
    }
    return { id: value.id, companyId, language, savedAt: value.savedAt, data } satisfies WorkLetterRecord;
  });
  await writeRecords(records);
  return records.length;
}

export function draftKey(companyId: string, language: "ar" | "en") {
  return `work-letters:draft:${companyId}:${language}`;
}

export function recordsKey(companyId: string, language: "ar" | "en") {
  return `work-letters:records:${companyId}:${language}`;
}
