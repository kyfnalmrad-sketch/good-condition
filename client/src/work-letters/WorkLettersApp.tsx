import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Database, FileDown, Languages, List, Save } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import bwipjs from "@bwip-js/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { draftKey, listWorkLetters, migrateLegacyWorkLetters, saveWorkLetter, type WorkLetterData, type WorkLetterRecord } from "./db";
import WorkLettersRecords from "./WorkLettersRecords";

export type Language = "ar" | "en";

type Company = {
  id: string;
  nameAr: string;
  nameEn: string;
  short: string;
  template?: string;
  paperPath?: string;
  activityAr: string;
  activityEn: string;
};

export const COMPANIES: Company[] = [
  { id: "astar", nameAr: "شركة أستار غاز يمن", nameEn: "Aster Gas Yemen Company", short: "ASTAR", paperPath: "/assets/official-work-letter/astar/official-paper.png", activityAr: "حلول الغاز والطاقة والخدمات المرتبطة بها", activityEn: "gas, energy, and related technical services" },
  { id: "master", nameAr: "شركة ماستر بلاتينيوم لاستيراد الأجهزة والمستلزمات الطبية والإلكترونية", nameEn: "Master Platinum for Importing Medical and Electronic Equipment and Supplies", short: "MASTER", activityAr: "استيراد الأجهزة والمستلزمات الطبية والإلكترونية", activityEn: "the import of medical and electronic equipment and supplies" },
  { id: "horizon-sanaa", nameAr: "شركة أفق صنعاء للحلول الذكية", nameEn: "Horizon Sana'a Smart Solutions", short: "HORIZON", template: "horizon-sanaa", activityAr: "الحلول الذكية والتقنية والتحول الرقمي", activityEn: "smart solutions, technology, and digital transformation" },
  { id: "yemen-colors-travel", nameAr: "شركة ألوان اليمن للسياحة والسفر", nameEn: "Yemen Colors Travel and Tourism Co.", short: "COLORS", template: "yemen-colors-travel", activityAr: "السياحة والسفر وتنظيم الرحلات", activityEn: "travel, tourism, and trip organization" },
  { id: "asas-sanaa", nameAr: "شركة أساس صنعاء للمقاولات والهندسة", nameEn: "Asas Sana'a Contracting & Engineering Co.", short: "ASAS", template: "asas-sanaa", activityAr: "المقاولات والهندسة وإدارة المشاريع", activityEn: "contracting, engineering, and project management" },
  { id: "yemen-paths-logistics", nameAr: "شركة مسارات اليمن للخدمات اللوجستية", nameEn: "Yemen Paths Logistics Co.", short: "PATHS", template: "yemen-paths-logistics", activityAr: "الخدمات اللوجستية وسلاسل الإمداد والنقل", activityEn: "logistics, supply-chain, and transport services" },
  { id: "rawafed-sanaa-agricultural", nameAr: "شركة روافد صنعاء للتقنيات الزراعية", nameEn: "Rawafed Sana'a Agricultural Technologies Co.", short: "RAWAFED", template: "rawafed-sanaa-agricultural", activityAr: "التقنيات الزراعية والحلول الحديثة للقطاع الزراعي", activityEn: "agricultural technologies and modern farming solutions" },
  { id: "al-hasani-exchange", nameAr: "شركة الحسني للصرافة", nameEn: "Al Hasani Exchange Company", short: "HASANI", template: "al-hasani-exchange", activityAr: "خدمات الصرافة والتحويلات المالية", activityEn: "money exchange and remittance services" },
  { id: "najm-tech-updated", nameAr: "شركة نجم التقنية للحلول الرقمية", nameEn: "Najm Digital Solutions Co.", short: "NAJM", template: "najm-tech-updated", activityAr: "الحلول الرقمية وتقنية المعلومات", activityEn: "digital solutions and information technology" },
  { id: "safa-pharma", nameAr: "شركة صفا فارما للصناعات الدوائية", nameEn: "Safa Pharma Industries Co.", short: "SAFA", template: "safa-pharma", activityAr: "الصناعات الدوائية والمنتجات الصحية", activityEn: "pharmaceutical manufacturing and health products" },
  { id: "madar-media", nameAr: "شركة مدار للإعلام والإنتاج", nameEn: "Madar Media & Production Co.", short: "MADAR", template: "madar-media", activityAr: "الإعلام والإنتاج والمحتوى الإبداعي", activityEn: "media, production, and creative content" },
  { id: "riyadah-agri", nameAr: "شركة ريادة للتنمية الزراعية", nameEn: "Riyadah Agricultural Development Co.", short: "RIYADAH", template: "riyadah-agri", activityAr: "التنمية الزراعية والإنتاج النباتي", activityEn: "agricultural development and crop production" },
  { id: "tawasul-engineering", nameAr: "شركة تواصل للهندسة والمقاولات", nameEn: "Tawasul Engineering & Contracting Co.", short: "TAWASUL", template: "tawasul-engineering", activityAr: "الهندسة والمقاولات والأعمال الإنشائية", activityEn: "engineering, contracting, and construction works" },
  { id: "hayat-education", nameAr: "مؤسسة حياة للتعليم والتدريب", nameEn: "Hayat Education & Training Foundation", short: "HAYAT", template: "hayat-education", activityAr: "التعليم والتدريب والتطوير المهني", activityEn: "education, training, and professional development" },
  { id: "arkan-finance", nameAr: "شركة أركان للحلول المالية", nameEn: "Arkan Financial Solutions Co.", short: "ARKAN", template: "arkan-finance", activityAr: "الاستشارات والحلول المالية وإدارة الأعمال", activityEn: "financial consulting and business solutions" },
];

export const INITIAL: WorkLetterData = {
  companyId: "astar", employeeName: "محمد علي أحمد", jobTitle: "مدير المشتريات", salary: "1500", salaryWords: "ألف وخمسمائة دولار أمريكي",
  passportNo: "", identityNo: "", birthPlace: "صنعاء، اليمن", birthDate: "18/04/1992", joiningDate: "12/01/2020", issueDate: "23/09/2026",
  reference: "ASTAR-HR-041-2026", internalNo: "ASTAR-INT-041-2026", issuerName: "أحمد محمد، مدير الموارد البشرية", recipient: "سفارة الجمهورية التركية في عمّان", attention: "القسم القنصلي", subject: "خطاب إثبات عمل وكفالة", format2PassportNo: "10715207", format2SignatoryName: "أحمد محمد", format2SignatoryTitle: "مدير الموارد البشرية",
};
export const EN_INITIAL: WorkLetterData = { ...INITIAL, employeeName: "Mohammed Ali Ahmed", jobTitle: "Procurement Manager", birthPlace: "Sana'a, Yemen", issuerName: "Ahmed Mohammed, Human Resources Manager", salaryWords: "one thousand five hundred US dollars", recipient: "The Embassy of the Republic of Turkey in Amman", attention: "The Consular Section", subject: "Letter of Verification of Employment and Support", format2PassportNo: "10715207", format2SignatoryName: "Ahmed Mohammed", format2SignatoryTitle: "Human Resources Manager" };
export type LetterFormat = 1 | 2 | 3;

function companyFor(id: string) { return COMPANIES.find(company => company.id === id) ?? COMPANIES[0]; }
export function supportsFormat3(companyId: string) { return companyId === "astar" || companyId === "master"; }
function format2SignatureCompanyName(company: Company) { return company.id === "astar" ? "Aster Gas Yemen" : company.id === "master" ? "Master Platinum" : company.nameEn; }
function referencePrefix(company: Company, language: Language) {
  const legalWords = new Set(["company", "co", "foundation"]);
  const source = company.nameEn;
  return source.replace(/[،,().&\/]/g, " ").split(/\s+/).filter(word => word && !legalWords.has(word.toLowerCase())).map(word => word[0]).join("").toLocaleUpperCase();
}
function generatedReference(company: Company, language: Language, kind: "HR" | "INT") { return `${referencePrefix(company, language)}/${kind}/2026/041`; }
function letterLayout(companyId: string) { return (["yemen-paths-logistics", "rawafed-sanaa-agricultural", "al-hasani-exchange", "najm-tech-updated", "safa-pharma"].includes(companyId) ? "b" : ["madar-media", "riyadah-agri", "tawasul-engineering", "hayat-education", "arkan-finance"].includes(companyId) ? "c" : "a") as "a" | "b" | "c"; }
function businessStatement(company: Company, language: Language) {
  const statements = {
    astar: { ar: "حلول الغاز والطاقة والخدمات الفنية المرتبطة بها", en: "the provision of gas, energy, and related technical services" },
    master: { ar: "استيراد وتوريد الأجهزة والمستلزمات الطبية والإلكترونية", en: "the import and supply of medical and electronic equipment and supplies" },
    "horizon-sanaa": { ar: "الحلول الذكية والخدمات التقنية الداعمة للتحول الرقمي وتطوير الأعمال", en: "the delivery of smart solutions and technology services supporting digital transformation and business development" },
    "yemen-colors-travel": { ar: "خدمات السياحة والسفر وتنظيم الرحلات والحجوزات", en: "the provision of travel, tourism, trip organization, and reservation services" },
    "asas-sanaa": { ar: "المقاولات والأعمال الهندسية وإدارة وتنفيذ المشاريع", en: "contracting, engineering works, and project management and execution" },
    "yemen-paths-logistics": { ar: "خدمات النقل والخدمات اللوجستية وإدارة سلاسل الإمداد", en: "the provision of transport, logistics, and supply-chain management services" },
    "rawafed-sanaa-agricultural": { ar: "التقنيات والحلول الحديثة لخدمة القطاع الزراعي وتطوير الإنتاج", en: "the provision of modern technologies and solutions for agricultural development and production" },
    "al-hasani-exchange": { ar: "خدمات الصرافة والتحويلات المالية وفقًا للأنظمة واللوائح المعمول بها", en: "the provision of money exchange and remittance services in accordance with applicable regulations" },
    "najm-tech-updated": { ar: "تقنية المعلومات والحلول الرقمية وتطوير الأنظمة والخدمات الإلكترونية", en: "information technology, digital solutions, and the development of systems and electronic services" },
    "safa-pharma": { ar: "الصناعات الدوائية والمنتجات الصحية وفق معايير الجودة المعتمدة", en: "pharmaceutical manufacturing and health products in accordance with approved quality standards" },
    "madar-media": { ar: "خدمات الإعلام والإنتاج المرئي والمسموع وصناعة المحتوى الإبداعي", en: "media services, audiovisual production, and creative content development" },
    "riyadah-agri": { ar: "التنمية الزراعية والإنتاج النباتي وتطوير المشاريع الزراعية", en: "agricultural development, crop production, and the advancement of agricultural projects" },
    "tawasul-engineering": { ar: "الهندسة والمقاولات وتنفيذ الأعمال الإنشائية والفنية", en: "engineering, contracting, and the execution of construction and technical works" },
    "hayat-education": { ar: "خدمات التعليم والتدريب والتطوير المهني وبناء القدرات", en: "education, training, professional development, and capacity-building services" },
    "arkan-finance": { ar: "الاستشارات والحلول المالية وخدمات تطوير وإدارة الأعمال", en: "financial consulting, financial solutions, and business development and management services" },
  } as Record<string, { ar: string; en: string }>;
  return (statements[company.id] ?? { ar: company.activityAr, en: company.activityEn })[language];
}
function normalizeDigits(value: string) { return value.replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))); }
function numericSalary(value: string) { return Number(normalizeDigits(value).replace(/[,،\s]/g, "")); }
const AR_ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
const AR_TENS = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
function arabicIntegerWords(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 999999999) return "";
  if (value === 0) return "صفر";
  const under100 = (n: number) => n < 10 ? AR_ONES[n] : n < 20 ? (n === 10 ? "عشرة" : `${AR_ONES[n - 10]} عشر`) : n % 10 ? `${AR_ONES[n % 10]} و${AR_TENS[Math.floor(n / 10)]}` : AR_TENS[n / 10];
  const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];
  const under1000 = (n: number) => n < 100 ? under100(n) : `${hundreds[Math.floor(n / 100)]}${n % 100 ? ` و${under100(n % 100)}` : ""}`;
  const parts: string[] = [];
  if (value >= 1000000) { const m = Math.floor(value / 1000000); parts.push(m === 1 ? "مليون" : m === 2 ? "مليونان" : `${arabicIntegerWords(m)} ملايين`); value %= 1000000; }
  if (value >= 1000) { const k = Math.floor(value / 1000); parts.push(k === 1 ? "ألف" : k === 2 ? "ألفان" : `${arabicIntegerWords(k)} ألف`); value %= 1000; }
  if (value) parts.push(under1000(value));
  return parts.join(" و");
}
const EN_ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function englishIntegerWords(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 999999999) return "";
  if (value < 20) return EN_ONES[value];
  if (value < 100) return `${EN_TENS[Math.floor(value / 10)]}${value % 10 ? `-${EN_ONES[value % 10]}` : ""}`;
  if (value < 1000) return `${EN_ONES[Math.floor(value / 100)]} hundred${value % 100 ? ` ${englishIntegerWords(value % 100)}` : ""}`;
  if (value < 1000000) return `${englishIntegerWords(Math.floor(value / 1000))} thousand${value % 1000 ? ` ${englishIntegerWords(value % 1000)}` : ""}`;
  return `${englishIntegerWords(Math.floor(value / 1000000))} million${value % 1000000 ? ` ${englishIntegerWords(value % 1000000)}` : ""}`;
}
function wordsForSalary(value: string, language: Language) { const numeric = numericSalary(value); if (!Number.isFinite(numeric) || numeric < 0 || !Number.isInteger(numeric)) return ""; return language === "ar" ? `${arabicIntegerWords(numeric)} دولار أمريكي فقط لا غير` : `${englishIntegerWords(numeric)} US dollars only`; }
function salaryForArabic(value: string, words: string) { const numeric = numericSalary(value); return `${Number.isFinite(numeric) ? numeric.toLocaleString("en-US") : value} دولار أمريكي${words ? ` (${words})` : ""}`; }
function salaryForEnglish(value: string, words: string) { const numeric = numericSalary(value); return `USD ${Number.isFinite(numeric) ? numeric.toLocaleString("en-US") : value}${words ? ` (${words})` : ""}`; }
export function demoFor(companyId: string, language: Language): WorkLetterData { const company = companyFor(companyId); const base = language === "en" ? EN_INITIAL : INITIAL; const salary = base.salary; return { ...base, companyId: company.id, reference: generatedReference(company, language, "HR"), internalNo: generatedReference(company, language, "INT"), salaryWords: wordsForSalary(salary, language), format3Recipient: "TO WHOM IT MAY CONCERN", format3IssueDate: "23/09/2026", format3Subject: "Letter of Employment and Salary Verification", format3EmployeeName: "Mohammed Ali Ahmed", format3PassportNo: "10715207", format3CompanyName: company.nameEn, format3SignatureCompanyName: company.id === "astar" ? "Aster Gas Yemen" : company.id === "master" ? "Master Platinum" : company.nameEn, format3JobTitle: "Procurement Manager", format3EmploymentStart: "12/01/2020", format3Salary: "1500", format3SignatoryName: "Ahmed Mohammed", format3SignatoryTitle: "Human Resources Manager" }; }
function hydrateData(value: Partial<WorkLetterData>, companyId: string, language: Language) { const base = demoFor(companyId, language); const data = { ...base, ...value, companyId, reference: generatedReference(baseCompany(companyId), language, "HR"), internalNo: generatedReference(baseCompany(companyId), language, "INT") }; return { ...data, salaryWords: data.salaryWords || wordsForSalary(data.salary, language) }; }
function baseCompany(companyId: string) { return companyFor(companyId); }
function arabicDate(value: string) { return value ? `${value.replace(/[0-9]/g, digit => "٠١٢٣٤٥٦٧٨٩"[Number(digit)])}م` : value; }
function dateForEnglish(value: string) { const [day, month, year] = value.split("/"); return `${day} ${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][Number(month) - 1]} ${year}`; }
function codePayload(data: WorkLetterData, language: Language) {
  const base = language === "ar"
    ? [`الموظف: ${data.employeeName}`, `الوظيفة: ${data.jobTitle}`, `الحالة: على رأس العمل`, `الراتب: ${numericSalary(data.salary)} دولار`, `المرجع: ${data.reference}`, `الداخلي: ${data.internalNo}`, `الإصدار: ${arabicDate(data.issueDate)}`]
    : [`Employee: ${data.employeeName}`, `Job: ${data.jobTitle}`, `Status: Active`, `Salary: USD ${numericSalary(data.salary)}`, `Reference: ${data.reference}`, `Internal: ${data.internalNo}`, `Issued: ${dateForEnglish(data.issueDate)}`];
  return base.concat(data.passportNo ? [language === "ar" ? `الجواز: ${data.passportNo}` : `Passport: ${data.passportNo}`] : [], data.identityNo ? [language === "ar" ? `الهوية: ${data.identityNo}` : `Identity: ${data.identityNo}`] : []).join("\n");
}
function brandColor(companyId: string) { return ({ astar: "8b3f35", master: "17375e", "horizon-sanaa": "0b567a", "yemen-colors-travel": "0e858d", "asas-sanaa": "a47a25", "yemen-paths-logistics": "176ba6", "rawafed-sanaa-agricultural": "3f6f56", "al-hasani-exchange": "123d6b", "najm-tech-updated": "2d6ca8", "safa-pharma": "1478ad", "madar-media": "8f285f", "riyadah-agri": "7a9940", "tawasul-engineering": "168c88", "hayat-education": "e18a2d", "arkan-finance": "3b6e65" } as Record<string, string>)[companyId] ?? "203f5c"; }
function barcodeSvg(data: WorkLetterData, companyId: string) { const payload = [`${data.reference}`, `${data.internalNo}`, `${data.issueDate}`].join("\n"); try { return bwipjs.toSVG({ bcid: "pdf417", text: payload, barcolor: brandColor(companyId), scale: 1, columns: 6, rows: 4, includetext: false, paddingwidth: 1, paddingheight: 1 } as any); } catch { return ""; } }

export function LetterPreview({ data, language, format = 1 }: { data: WorkLetterData; language: Language; format?: LetterFormat }) {
  const company = companyFor(data.companyId);
  const issuerName = data.issuerName || (language === "ar" ? "أحمد محمد، مدير الموارد البشرية" : "Ahmed Mohammed, Human Resources Manager");
  const english = language === "en";
  const formatTwo = english && format === 2;
  const formatThree = english && format === 3 && supportsFormat3(company.id);
  const format3Recipient = data.format3Recipient ?? "TO WHOM IT MAY CONCERN";
  const format3IssueDate = data.format3IssueDate ?? data.issueDate;
  const format3Subject = data.format3Subject ?? "Letter of Employment and Salary Verification";
  const format3EmployeeName = data.format3EmployeeName ?? data.employeeName;
  const format3PassportNo = data.format3PassportNo ?? "";
  const format3CompanyName = data.format3CompanyName?.trim() || company.nameEn;
  const format3SignatureCompanyName = data.format3SignatureCompanyName?.trim() || (company.id === "astar" ? "Aster Gas Yemen" : "Master Platinum");
  const format3JobTitle = data.format3JobTitle ?? data.jobTitle;
  const format3EmploymentStart = data.format3EmploymentStart ?? data.joiningDate;
  const format3Salary = data.format3Salary ?? data.salary;
  const format3NumericSalary = numericSalary(format3Salary);
  const format3SalaryDisplay = Number.isFinite(format3NumericSalary) ? format3NumericSalary.toLocaleString("en-US") : format3Salary;
  const format3Qr = ["Document: Letter of Employment and Salary Verification", `Company: ${format3CompanyName}`, `Employee: ${format3EmployeeName}`, `Passport: ${format3PassportNo}`, `Job: ${format3JobTitle}`, `Employment start: ${format3EmploymentStart}`, `Monthly salary: USD ${format3SalaryDisplay}`, `Issued: ${format3IssueDate}`].join("\n");
  const qr = codePayload(language === "en" && formatTwo ? { ...data, passportNo: data.format2PassportNo } : data, language);
  const barcode = useMemo(() => format === 1 ? barcodeSvg(data, company.id) : "", [data, company.id, format]);
  const paperAsset = company.paperPath ?? (company.template ? `/assets/official-work-letter/templates/${company.template}.png` : `/assets/official-work-letter/${company.id}-official-paper.png`);
  const optionalArabic = <>{data.passportNo ? <> ورقم الجواز <strong>{data.passportNo}</strong></> : null}{data.identityNo ? <> ورقم الهوية <strong>{data.identityNo}</strong></> : null}</>;
  const optionalEnglish = <>{data.passportNo ? <>; passport number: <strong>{data.passportNo}</strong></> : null}{data.identityNo ? <>; identity number: <strong>{data.identityNo}</strong></> : null}</>;
  const passport = data.format2PassportNo;
  const joiningYear = data.joiningDate.split("/").pop() || "2019";
  if (formatThree) return <article className={`work-letter-paper company-${company.id} layout-${letterLayout(company.id)} letter-format-3 is-english`} dir="ltr">
    <img className="company-official-paper" src={paperAsset} alt="" />
    <div className="official-letter-content"><div className="format3-letter-body">
      <div className="format3-qr" aria-label="Employment letter QR code"><QRCodeSVG value={format3Qr} size={82} level="L" boostLevel={false} fgColor="#111111" /></div>
      <h1>{format3Recipient || "TO WHOM IT MAY CONCERN"}</h1>
      <p className="format3-date"><strong>Date:</strong> {format3IssueDate}</p>
      <p className="format3-subject"><strong>Sub.:</strong> {format3Subject}</p>
      <p>This is to certify that Mr. <strong>{format3EmployeeName}</strong>{format3PassportNo.trim() ? <>, holding Passport No. (<strong>{format3PassportNo}</strong>),</> : null} is currently employed with <strong>{format3CompanyName}</strong> as a <strong>{format3JobTitle}</strong> on a full-time basis, starting from <strong>{format3EmploymentStart}</strong>.</p>
      <p>We further certify that he receives a total monthly salary of <strong>$ {format3SalaryDisplay}</strong>.</p>
      <p>This letter is issued upon his request for official verification purposes, without any financial or legal liability on our company.</p>
      <p>For any further information or verification, please feel free to contact us.</p>
      <p className="format3-regards">Best regards,</p>
      <div className="format3-signature"><div className="format3-signature-space"><span aria-hidden="true" /></div><strong>{format3SignatureCompanyName}</strong>{data.format3SignatoryName && <span>{data.format3SignatoryName}</span>}{data.format3SignatoryTitle && <span className="format3-signature-title">{data.format3SignatoryTitle}</span>}</div>
    </div></div>
  </article>;
  return <article className={`work-letter-paper company-${company.id} layout-${letterLayout(company.id)} ${formatTwo ? "letter-format-2" : "is-official-paper"} ${english ? "is-english" : "is-arabic"}`} dir={english ? "ltr" : "rtl"}>
    <img className="company-official-paper" src={paperAsset} alt="" />
    <div className="official-letter-content">{formatTwo ? <div className="format2-letter-body"><div className="format2-qr" aria-label="Document QR code"><QRCodeSVG value={qr} size={86} level="L" boostLevel={false} fgColor="#111111" /></div>{(data.recipient.trim() || data.attention.trim()) && <p>{data.recipient.trim() && <><strong>To:</strong> {data.recipient}</>}{data.attention.trim() && <><br /><strong>Attn.:</strong> {data.attention}</>}</p>}<p><strong>Date:</strong> {data.issueDate}</p>{data.subject.trim() && <p className="format2-subject"><strong>Sub.:</strong> {data.subject}</p>}<p>This letter is to confirm that Mr. <strong>{data.employeeName}</strong>{passport.trim() ? <>, holding Passport No. (<strong>{passport}</strong>),</> : null} is under our employment as a <strong>{data.jobTitle}</strong> since {joiningYear} in a full time position, receives a monthly salary of <strong>$ {numericSalary(data.salary)}</strong>.</p><p>Due to the constant health concern, Mr. <strong>{data.employeeName}</strong> decided to travel abroad for further treatment in the Republic of Turkey. We, as the employer, are fully supporting Mr. {data.employeeName}'s decision to allow him to receive the necessary health care.</p><p>We also confirm that his position will remain guaranteed during his temporary medical leave.</p><p>Therefore, you are kindly requested to issue an entry visa to allow him to receive the necessary medical treatment.<br />For further information, please contact us.</p><p className="format2-regards">Best regards</p><div className="format2-signature"><div className="format2-signature-space"><span className="format2-signature-line" aria-hidden="true" /></div><strong>{format2SignatureCompanyName(company)}</strong>{data.format2SignatoryName.trim() && <span className="format2-signature-issuer">{data.format2SignatoryName}</span>}{data.format2SignatoryTitle.trim() && <span className="format2-signature-title">{data.format2SignatoryTitle}</span>}</div></div> : <><div className="letter-meta"><div><span>{english ? "Internal No." : "الرقم الداخلي"}</span><b>{data.internalNo}</b></div><div><span>{english ? "Reference" : "المرجع"}</span><b>{data.reference}</b></div><div><span>{english ? "Date" : "التاريخ"}</span><b>{english ? dateForEnglish(data.issueDate) : arabicDate(data.issueDate)}</b></div></div>
      <div className="letter-main"><div className="letter-qr" aria-label={english ? "Document QR code" : "رمز QR للوثيقة"}><QRCodeSVG value={qr} size={92} level="L" boostLevel={false} fgColor="#111111" /></div><h1>{english ? "To Whom It May Concern" : "إلى من يهمه الأمر"}</h1>
        {english ? <p className="letter-copy">{company.nameEn} presents its compliments. The company is duly engaged in <strong>{businessStatement(company, "en")}</strong>. This is to certify that <strong>{data.employeeName}</strong> is employed by our company as <strong>{data.jobTitle}</strong>, with a monthly salary of <strong>{salaryForEnglish(data.salary, data.salaryWords)}</strong>. Place of birth: <strong>{data.birthPlace}</strong>; date of birth: <strong>{dateForEnglish(data.birthDate)}</strong>; date of joining: <strong>{dateForEnglish(data.joiningDate)}</strong>{optionalEnglish}.<br /><br />This certificate is issued at his request for official purposes, without any responsibility or obligation on the company beyond the information stated herein.</p> : <p className="letter-copy">تهديكم <strong>{company.nameAr}</strong> أطيب تحياتها، ونفيدكم بأن الشركة تعمل بصورة نظامية في مجال <strong>{businessStatement(company, "ar")}</strong>. كما نفيدكم بأن الأخ <strong>{data.employeeName}</strong> يعمل لدى شركتنا بوظيفة <strong>{data.jobTitle}</strong>، ويتقاضى راتباً شهرياً قدره <strong>{salaryForArabic(data.salary, data.salaryWords)}</strong>. وقد التحق بالعمل لدينا بتاريخ <strong>{arabicDate(data.joiningDate)}</strong>، ومكان ميلاده <strong>{data.birthPlace}</strong>، وتاريخ ميلاده <strong>{arabicDate(data.birthDate)}</strong>{optionalArabic}.<br /><br />وقد أُصدرت له هذه الإفادة بناءً على طلبه وللأغراض الرسمية، دون أدنى مسؤولية أو التزام على الشركة تجاه أي طرف آخر، في حدود صحة البيانات الواردة فيها.</p>}
        <p className="letter-closing">{english ? "Yours faithfully," : "وتفضلوا بقبول خالص الاحترام والتقدير،،،"}</p></div>
    <div className="letter-signature"><strong>{english ? "Human Resources Department" : "إدارة الموارد البشرية"}</strong><div className="signature-issuer"><span>{english ? "Issued by:" : "صادر من:"}</span><b>{issuerName}</b></div></div></>}</div>{!formatTwo && <div className="letter-barcode" dangerouslySetInnerHTML={{ __html: barcode }} />}
  </article>;
}

export default function WorkLettersApp() {
  const [, setLocation] = useLocation(); const routeParams = new URLSearchParams(window.location.search); const routeLanguage = routeParams.get("language") === "en" ? "en" : "ar"; const routeCompany = routeParams.get("company") || "astar";
  const routeFormat: LetterFormat = routeLanguage === "en" && routeParams.get("format") === "2" ? 2 : routeLanguage === "en" && routeParams.get("format") === "3" && supportsFormat3(routeCompany) ? 3 : 1;
  const [language, setLanguage] = useState<Language>(routeLanguage); const [format, setFormat] = useState<LetterFormat>(routeFormat); const [data, setData] = useState<WorkLetterData>(() => demoFor(routeCompany, routeLanguage)); const [records, setRecords] = useState<WorkLetterRecord[]>([]); const [showRecords, setShowRecords] = useState(false); const company = companyFor(data.companyId); const english = language === "en";
  useEffect(() => {
    const companyId = data.companyId;
    const currentLanguage = language;
    const saved = localStorage.getItem(draftKey(companyId, currentLanguage));
    if (saved) {
      try { setData(hydrateData(JSON.parse(saved), companyId, currentLanguage)); }
      catch { setData(demoFor(companyId, currentLanguage)); }
    } else {
      setData(current => demoFor(current.companyId, currentLanguage));
    }
    let active = true;
    migrateLegacyWorkLetters(companyId, currentLanguage)
      .then(() => listWorkLetters(companyId, currentLanguage))
      .then(nextRecords => { if (active) setRecords(nextRecords); })
      .catch(() => { if (active) toast.error(english ? "Records could not be loaded; legacy data was kept." : "تعذر تحميل السجلات؛ تم الإبقاء على البيانات القديمة."); });
    return () => { active = false; };
  }, [data.companyId, language]);
  useEffect(() => { localStorage.setItem(draftKey(data.companyId, language), JSON.stringify(data)); }, [data, language]);
  function update(key: keyof WorkLetterData, value: string) { setData(current => ({ ...current, [key]: value })); }
  function updateSalary(value: string) { setData(current => ({ ...current, salary: value, salaryWords: wordsForSalary(value, language) })); }
  function navigateLetter(companyId: string, nextLanguage: Language) { const saved = localStorage.getItem(draftKey(companyId, nextLanguage)); const nextData = saved ? (() => { try { return hydrateData(JSON.parse(saved), companyId, nextLanguage); } catch { return demoFor(companyId, nextLanguage); } })() : demoFor(companyId, nextLanguage); const nextFormat: LetterFormat = nextLanguage !== "en" ? 1 : format === 2 ? 2 : format === 3 && supportsFormat3(companyId) ? 3 : 1; setData(nextData); setLanguage(nextLanguage); setFormat(nextFormat); const formatSuffix = nextFormat === 1 ? "" : `&format=${nextFormat}`; window.history.replaceState({}, "", `/work-letters?company=${companyId}&language=${nextLanguage}${formatSuffix}`); }
  function selectFormat(nextFormat: LetterFormat) { if (!english && nextFormat !== 1) return; if (nextFormat === 3 && !supportsFormat3(data.companyId)) return; setFormat(nextFormat); setLocation(`/work-letters?company=${data.companyId}&language=${language}${nextFormat === 1 ? "" : `&format=${nextFormat}`}`); }
  async function save() {
    try {
      await saveWorkLetter(data, language);
      setRecords(await listWorkLetters(data.companyId, language));
      toast.success(english ? "Saved in the independent database" : "تم الحفظ في قاعدة البيانات المستقلة");
    } catch {
      toast.error(english ? "Could not save this record" : "تعذر حفظ هذا السجل");
    }
  }
  function restoreRecord(record: WorkLetterRecord) {
    setData(record.data);
    localStorage.setItem(draftKey(record.companyId, record.language), JSON.stringify(record.data));
    setShowRecords(false);
    toast.success(english ? "Record loaded into the form" : "تمت استعادة السجل إلى النموذج");
  }
  const labels = english ? { title: "Work Letters", subtitle: "Independent Arabic / English document workspace", data: "Document data", preview: "Live A4 preview", save: "Save record", records: "Records", company: "Company", employee: "Employee full name", job: "Job title", salary: "Monthly salary", salaryWords: "Amount in words (editable)", birthPlace: "Place of birth", birthDate: "Date of birth", joiningDate: "Date of joining", issueDate: "Issue date", recipient: "To / Recipient", attention: "Attention (Attn.)", subject: "Subject (Sub.)", format2Fields: "Format 2 · Variable letter fields", format2Signer: "Signatory name", format2SignerTitle: "Signatory title / position", reference: "Reference", internal: "Internal number", passport: "Passport number (optional)", identity: "Identity number (optional)", issuer: "Issued by" } : { title: "خطابات العمل", subtitle: "مسار مستقل للوثائق العربية والإنجليزية", data: "بيانات الوثيقة", preview: "معاينة A4 مباشرة", save: "حفظ السجل", records: "السجلات", company: "الشركة", employee: "اسم الموظف الكامل", job: "المسمى الوظيفي", salary: "الراتب الشهري", salaryWords: "المبلغ كتابةً (قابل للتعديل)", birthPlace: "مكان الميلاد", birthDate: "تاريخ الميلاد", joiningDate: "تاريخ الالتحاق", issueDate: "تاريخ الإصدار", recipient: "الجهة المرسل إليها", attention: "عناية", subject: "الموضوع", format2Fields: "حقول متغيرة للتنسيق ٢", format2Signer: "اسم الموقّع", format2SignerTitle: "صفة الموقّع / منصبه", reference: "المرجع", internal: "الرقم الداخلي", passport: "رقم الجواز (اختياري)", identity: "رقم الهوية (اختياري)", issuer: "صادر من" };
  return <main className="work-letters-app" dir={english ? "ltr" : "rtl"}><aside className="work-sidebar"><div className="work-brand"><div className="work-brand-mark">WL</div><div><b>{labels.title}</b><span>{labels.subtitle}</span></div></div><div className="work-language"><Languages size={17} /><button className={language === "ar" ? "active" : ""} onClick={() => navigateLetter(data.companyId, "ar")}>العربية</button><button className={language === "en" ? "active" : ""} onClick={() => navigateLetter(data.companyId, "en")}>English</button></div><div className="work-steps"><span>01 · {english ? "Choose a company" : "اختر الشركة"}</span><span>02 · {english ? "Edit and save data" : "عدّل واحفظ البيانات"}</span><span>03 · {english ? "Print official A4" : "اطبع الورقة الرسمية A4"}</span></div><div className="work-storage-note"><Database size={17} /><div><b>{english ? "IndexedDB active" : "قاعدة IndexedDB فعالة"}</b><span>{english ? "Records are isolated from the original app." : "السجلات معزولة عن النظام الأصلي."}</span></div></div></aside><section className="work-workspace"><header className="work-toolbar"><div><span className="work-eyebrow">WORK-LETTERS / {company.short}</span><h1>{labels.data}</h1></div><div className="work-actions"><Button variant="outline" onClick={() => setShowRecords(value => !value)}><List size={16} /> {labels.records} ({records.length})</Button><Button variant="outline" onClick={() => setLocation(`/work-letters/preview?company=${data.companyId}&language=${language}${language === "en" && format !== 1 ? `&format=${format}` : ""}`)}><FileDown size={16} /> {english ? "Official preview / PDF" : "المعاينة الرسمية / PDF"}</Button>{english && <div className="letter-format-selector" aria-label="Letter format"><Button variant={format === 1 ? "default" : "outline"} onClick={() => selectFormat(1)}>Format 1</Button><Button variant={format === 2 ? "default" : "outline"} onClick={() => selectFormat(2)}>Format 2</Button>{supportsFormat3(company.id) && <Button variant={format === 3 ? "default" : "outline"} onClick={() => selectFormat(3)}>Format 3</Button>}</div>}<Button onClick={save}><Save size={16} /> {labels.save}</Button></div></header><div className="work-grid"><div className="work-form-card"><label className="company-selector">{labels.company}<select aria-label={labels.company} value={data.companyId} onChange={event => navigateLetter(event.target.value, language)}>{COMPANIES.map(item => <option key={item.id} value={item.id}>{english ? `${item.short} — ${item.nameEn}` : `${item.short} — ${item.nameAr}`}</option>)}</select></label>{format === 3 && english && supportsFormat3(company.id) ? <div className="format3-editable-fields"><b className="format3-editable-fields-title">Format 3 · Variable employment letter fields</b><div className="work-form-row"><label>Addressee<Input value={data.format3Recipient ?? "TO WHOM IT MAY CONCERN"} onChange={event => update("format3Recipient", event.target.value)} /></label><label>Issue date<Input value={data.format3IssueDate ?? data.issueDate} onChange={event => update("format3IssueDate", event.target.value)} placeholder="DD/MM/YYYY" /></label></div><label>Subject<Input value={data.format3Subject ?? "Letter of Employment and Salary Verification"} onChange={event => update("format3Subject", event.target.value)} /></label><div className="work-form-row"><label>Full name as in passport<Input value={data.format3EmployeeName ?? data.employeeName} onChange={event => update("format3EmployeeName", event.target.value)} /></label><label>Passport number<Input value={data.format3PassportNo ?? ""} onChange={event => update("format3PassportNo", event.target.value)} /></label></div><label>Company name<Input value={data.format3CompanyName ?? company.nameEn} onChange={event => update("format3CompanyName", event.target.value)} /></label><label>Company name (signature)<Input value={data.format3SignatureCompanyName ?? (company.id === "astar" ? "Aster Gas Yemen" : "Master Platinum")} onChange={event => update("format3SignatureCompanyName", event.target.value)} /></label><div className="work-form-row"><label>Job title<Input value={data.format3JobTitle ?? data.jobTitle} onChange={event => update("format3JobTitle", event.target.value)} /></label><label>Employment start date / year<Input value={data.format3EmploymentStart ?? data.joiningDate} onChange={event => update("format3EmploymentStart", event.target.value)} placeholder="DD/MM/YYYY or YYYY" /></label></div><label>Monthly salary (USD)<Input value={data.format3Salary ?? data.salary} onChange={event => update("format3Salary", event.target.value)} /></label><div className="work-form-row"><label>HR manager name<Input value={data.format3SignatoryName ?? "Ahmed Mohammed"} onChange={event => update("format3SignatoryName", event.target.value)} /></label><label>Signatory title<Input value={data.format3SignatoryTitle ?? "Human Resources Manager"} onChange={event => update("format3SignatoryTitle", event.target.value)} /></label></div></div> : <><label>{labels.employee}<Input value={data.employeeName} onChange={event => update("employeeName", event.target.value)} /></label><div className="work-form-row"><label>{labels.job}<Input value={data.jobTitle} onChange={event => update("jobTitle", event.target.value)} /></label><label>{labels.salary}<Input value={data.salary} onChange={event => updateSalary(event.target.value)} /></label></div><label>{labels.salaryWords}<Input value={data.salaryWords} onChange={event => update("salaryWords", event.target.value)} /></label><label>{labels.birthPlace}<Input value={data.birthPlace} onChange={event => update("birthPlace", event.target.value)} /></label>{!(format === 2 && english) && <div className="work-form-row"><label>{labels.passport}<Input value={data.passportNo || ""} onChange={event => update("passportNo", event.target.value)} placeholder={english ? "Optional" : "اختياري"} /></label><label>{labels.identity}<Input value={data.identityNo || ""} onChange={event => update("identityNo", event.target.value)} placeholder={english ? "Optional" : "اختياري"} /></label></div>}<div className="work-form-row"><label>{labels.birthDate}<Input value={data.birthDate} onChange={event => update("birthDate", event.target.value)} placeholder="DD/MM/YYYY" /></label><label>{labels.joiningDate}<Input value={data.joiningDate} onChange={event => update("joiningDate", event.target.value)} placeholder="DD/MM/YYYY" /></label></div><div className="work-form-row"><label>{labels.issueDate}<Input value={data.issueDate} onChange={event => update("issueDate", event.target.value)} placeholder="DD/MM/YYYY" /></label><label>{labels.reference}<Input value={data.reference} onChange={event => update("reference", event.target.value)} /></label></div>{format === 2 && english && <div className="format2-editable-fields"><b className="format2-editable-fields-title">{labels.format2Fields}</b><div className="work-form-row"><label>{labels.recipient}<Input value={data.recipient} onChange={event => update("recipient", event.target.value)} /></label><label>{labels.attention}<Input value={data.attention} onChange={event => update("attention", event.target.value)} /></label></div><label>{labels.subject}<Input value={data.subject} onChange={event => update("subject", event.target.value)} /></label><div className="work-form-row"><label>{labels.passport}<Input value={data.format2PassportNo} onChange={event => update("format2PassportNo", event.target.value)} placeholder="Optional" /></label><label>{labels.format2Signer}<Input value={data.format2SignatoryName} onChange={event => update("format2SignatoryName", event.target.value)} /></label></div><label>{labels.format2SignerTitle}<Input value={data.format2SignatoryTitle} onChange={event => update("format2SignatoryTitle", event.target.value)} /></label></div>}<label>{labels.internal}<Input value={data.internalNo} onChange={event => update("internalNo", event.target.value)} /></label>{!(format === 2 && english) && <label>{labels.issuer}<Input value={data.issuerName} onChange={event => update("issuerName", event.target.value)} /></label>}</>}<div className="work-form-footer"><Button variant="outline" onClick={() => navigateLetter(data.companyId, language === "en" ? "ar" : "en")}>{language === "en" ? "العربية" : "English"}</Button><Button onClick={() => navigator.clipboard?.writeText(JSON.stringify(data))}><Copy size={15} /> {english ? "Copy data" : "نسخ البيانات"}</Button><span><Check size={14} /> {english ? "Auto-saved draft" : "مسودة محفوظة تلقائياً"}</span></div></div><div className="work-preview-card"><div className="work-preview-heading"><span>{labels.preview}</span><small>{english ? (format === 3 ? "QR only · Format 3 · A4" : format === 2 ? "QR only · Format 2 · A4" : "QR + PDF417 · Format 1") : "QR + PDF417 · عمودي"}</small></div><LetterPreview data={data} language={language} format={format} /></div></div>{showRecords && <WorkLettersRecords
      records={records}
      companyId={data.companyId}
      language={language}
      onRecordsChange={async () => setRecords(await listWorkLetters(data.companyId, language))}
      onRestore={restoreRecord}
    />}</section></main>;
}
