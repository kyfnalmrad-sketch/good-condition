import {
  ArrowLeft,
  Download,
  BarChart3,
  FileCheck2,
  FileText,
  FileSpreadsheet,
  Link2,
  Unlink2,
  ClipboardList,
  ImagePlus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Eraser,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { useLocation } from "wouter";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

const officialTemplate = "/assets/official-good-conduct-template-light.png";
const defaultPhoto = "/assets/training-photo.svg";
const defaultWatermarkPhoto = "/assets/training-photo-watermark-duotone.svg";
const savedPhotoNameKey = "good-conduct-photo-name";
const watermarkLinkedKey = "good-conduct-watermark-linked";
const linkedWatermarkPhotoKey = "good-conduct-linked-watermark-photo";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const DOCUMENT_TYPE_OPTIONS = [
  { ar: "جواز سفر", en: "Passport" },
  { ar: "بطاقة شخصية", en: "ID Card" },
];

function isIdentityDocument(type: string) {
  return /(^|\s)id(\s|$)/i.test(type) || type.includes("هوية");
}

function formatDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }
  return value;
}

function toArabicDigits(value: string) {
  return value.replace(/[0-9]/g, digit => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);
}

function formatArabicDate(value: string) {
  return toArabicDigits(formatDate(value));
}

function toInputDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

function cleanEnglish(value: string) {
  return value
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeTransparentPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("photo-read-failed"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("photo-decode-failed"));
      image.onload = () => {
        const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return reject(new Error("canvas-unavailable"));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        const { data, width, height } = pixels;
        const edgeColors = [
          [data[0], data[1], data[2]],
          [
            data[(width - 1) * 4],
            data[(width - 1) * 4 + 1],
            data[(width - 1) * 4 + 2],
          ],
          [
            data[Math.floor(width / 2) * 4],

            data[Math.floor(width / 2) * 4 + 1],

            data[Math.floor(width / 2) * 4 + 2],
          ],

          [
            data[Math.floor(height / 2) * width * 4],

            data[Math.floor(height / 2) * width * 4 + 1],

            data[Math.floor(height / 2) * width * 4 + 2],
          ],

          [
            data[(Math.floor(height / 2) * width + width - 1) * 4],

            data[(Math.floor(height / 2) * width + width - 1) * 4 + 1],

            data[(Math.floor(height / 2) * width + width - 1) * 4 + 2],
          ],
          [
            data[(height - 1) * width * 4],
            data[(height - 1) * width * 4 + 1],

            data[(height - 1) * width * 4 + 2],
          ],

          [
            data[((height - 1) * width + width - 1) * 4],

            data[((height - 1) * width + width - 1) * 4 + 1],

            data[((height - 1) * width + width - 1) * 4 + 2],
          ],
        ];
        const isNearWhite = (index: number) =>
          data[index] > 226 && data[index + 1] > 226 && data[index + 2] > 226;
        const matchesEdgeBackground = (index: number) =>
          edgeColors.some(([red, green, blue]) => {
            const distance = Math.hypot(
              data[index] - red,
              data[index + 1] - green,
              data[index + 2] - blue
            );
            return distance < 58;
          });
        const visited = new Uint8Array(width * height);
        const queue: number[] = [];
        const add = (x: number, y: number) => {
          const position = y * width + x;
          if (visited[position]) return;
          const index = position * 4;
          if (!isNearWhite(index) && !matchesEdgeBackground(index)) return;
          visited[position] = 1;
          queue.push(position);
        };
        for (let x = 0; x < width; x++) {
          add(x, 0);
          add(x, height - 1);
        }
        for (let y = 0; y < height; y++) {
          add(0, y);
          add(width - 1, y);
        }
        for (let cursor = 0; cursor < queue.length; cursor++) {
          const position = queue[cursor];
          const x = position % width;
          const y = Math.floor(position / width);
          // Remove the connected paper/background pixels completely. PNG keeps
          // the alpha channel so the same processed photo can be used as a
          // genuine watermark without a white rectangle.
          data[position * 4 + 3] = 0;
          if (x > 0) add(x - 1, y);
          if (x + 1 < width) add(x + 1, y);
          if (y > 0) add(x, y - 1);
          if (y + 1 < height) add(x, y + 1);
        }
        context.putImageData(pixels, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function readPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("photo-read-failed"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export function migrateData(saved: Partial<FormState>) {
  const merged = { ...initial, ...saved };
  const idDate = toInputDate(merged.idIssueDateEn || merged.idIssueDateAr);
  const expiryDate = toInputDate(merged.expiryEn || merged.expiryAr);
  const passportExpiryDate = toInputDate(
    merged.passportEn || merged.passportAr
  );
  return {
    ...merged,
    issueDate: toInputDate(merged.issueDate) || initial.issueDate,
    idIssueDateAr: idDate || initial.idIssueDateAr,
    idIssueDateEn: idDate || initial.idIssueDateEn,
    expiryAr: expiryDate || initial.expiryAr,
    expiryEn: expiryDate || initial.expiryEn,
    passportAr: passportExpiryDate || initial.passportAr,
    passportEn: passportExpiryDate || initial.passportEn,
  };
}

const NATIONALITIES = [
  { ar: "اليمن", en: "Yemen" },
  { ar: "السعودية", en: "Saudi Arabia" },
  { ar: "عُمان", en: "Oman" },
  { ar: "الإمارات العربية المتحدة", en: "United Arab Emirates" },
  { ar: "مصر", en: "Egypt" },
  { ar: "الأردن", en: "Jordan" },
  { ar: "الكويت", en: "Kuwait" },
  { ar: "قطر", en: "Qatar" },
  { ar: "البحرين", en: "Bahrain" },
  { ar: "العراق", en: "Iraq" },
  { ar: "سوريا", en: "Syria" },
  { ar: "لبنان", en: "Lebanon" },
  { ar: "فلسطين", en: "Palestine" },
  { ar: "الأردن", en: "Jordan" },
  { ar: "تركيا", en: "Turkey" },
  { ar: "الهند", en: "India" },
  { ar: "باكستان", en: "Pakistan" },
  { ar: "المملكة المتحدة", en: "United Kingdom" },
  { ar: "الولايات المتحدة", en: "United States" },
  { ar: "كندا", en: "Canada" },
];

const COUNTRIES = [
  ...NATIONALITIES,
  { ar: "ألمانيا", en: "Germany" },
  { ar: "فرنسا", en: "France" },
  { ar: "إيطاليا", en: "Italy" },
  { ar: "إسبانيا", en: "Spain" },
  { ar: "الصين", en: "China" },
  { ar: "اليابان", en: "Japan" },
  { ar: "إثيوبيا", en: "Ethiopia" },
  { ar: "جيبوتي", en: "Djibouti" },
  { ar: "السودان", en: "Sudan" },
  { ar: "الصومال", en: "Somalia" },
];

function normalizeLookup(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("ar")
    .replace(/[\u064B-\u065F]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\s_\-./\\():]+/g, "");
}

function findBilingualOption(
  value: string,
  options: Array<{ ar: string; en: string }>
) {
  const normalized = normalizeLookup(value);
  return options.find(
    option =>
      normalizeLookup(option.ar) === normalized ||
      normalizeLookup(option.en) === normalized
  );
}

function addYears(value: string, years: number) {
  const normalized = toInputDate(value);
  if (!normalized) return "";
  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function readStoredRecords(): Array<{
  id: string;
  savedAt: string;
  data: FormState;
  photo: string;
}> {
  try {
    const parsed = JSON.parse(
      localStorage.getItem("good-conduct-records") || "[]"
    );
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      item =>
        item &&
        typeof item.id === "string" &&
        typeof item.savedAt === "string" &&
        item.data &&
        typeof item.data === "object" &&
        typeof item.photo === "string"
    );
  } catch {
    return [];
  }
}

function randomDigits(length: number) {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, value => String(value % 10)).join("");
}

function englishInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(part =>
      part
        .replace(/[^A-Za-z]/g, "")
        .charAt(0)
        .toUpperCase()
    )
    .join("");
  return initials || "USR";
}

function referenceInitials(fullName: string, surname: string) {
  const nameParts = cleanEnglish(`${surname} ${fullName}`)
    .split(/\s+/)
    .filter(Boolean);
  const initials = nameParts.map(part => part.charAt(0).toUpperCase()).join("");
  return initials || "USR";
}

function referenceCheckCode(seed: string) {
  return Array.from(seed)
    .reduce(
      (total, character, index) =>
        (total + character.charCodeAt(0) * (index + 1)) % 100,
      0
    )
    .toString()
    .padStart(2, "0");
}

function identifierValues(records: Array<{ data: FormState }>) {
  return new Set(
    records.flatMap(record => [
      record.data.issueNo,
      record.data.referenceNo,
      record.data.internalNo,
      record.data.issuanceNo,
    ])
  );
}

function uniqueIdentifier(create: () => string, used: Set<string>) {
  let value = create();
  let attempts = 0;
  while (used.has(value) && attempts < 100) {
    value = create();
    attempts += 1;
  }
  used.add(value);
  return value;
}

function generateUniqueIdentifiers(
  name: string,
  surname: string,
  records: Array<{ data: FormState }>
) {
  const used = identifierValues(records);
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const initials = referenceInitials(name, surname);
  return {
    issueNo: uniqueIdentifier(
      () => `${stamp.slice(0, 4)}${randomDigits(6)}`,
      used
    ),
    referenceNo: uniqueIdentifier(
      () => `REF-${initials}-${randomDigits(6)}`,
      used
    ),
    internalNo: uniqueIdentifier(
      () => `INT-${initials}-${randomDigits(6)}`,
      used
    ),
    issuanceNo: uniqueIdentifier(() => `ISS-${stamp}-${randomDigits(6)}`, used),
  };
}

export type FormState = {
  issueNo: string;
  referenceNo: string;
  internalNo: string;
  issuanceNo: string;
  issueDate: string;
  fullNameAr: string;
  fullNameEn: string;
  surnameAr: string;
  surnameEn: string;
  birthPlaceAr: string;
  birthPlaceEn: string;
  birthDate: string;
  idTypeAr: string;
  idTypeEn: string;
  idNumberAr: string;
  idNumberEn: string;
  passportNoAr: string;
  passportNoEn: string;
  passportAr: string;
  passportEn: string;
  nationalityAr: string;
  nationalityEn: string;
  occupationAr: string;
  occupationEn: string;
  idIssueDateAr: string;
  idIssueDateEn: string;
  idIssuePlaceAr: string;
  idIssuePlaceEn: string;
  departmentAr: string;
  departmentEn: string;
  expiryAr: string;
  expiryEn: string;
  notesAr: string;
  notesEn: string;
};

export const initial: FormState = {
  issueNo: "99901",
  referenceNo: "REF-DEMO-482731",
  internalNo: "INT-DEMO-739204",
  issuanceNo: "DEMO-20260915-7318",
  issueDate: "2026-09-15",
  fullNameAr: "سامي ناصر علي",
  fullNameEn: "Sami Nasser Ali",
  surnameAr: "الاختباري",
  surnameEn: "Al-Ikhtibari",
  birthPlaceAr: "اليمن، عدن",
  birthPlaceEn: "Aden, Yemen",
  birthDate: "15/09/1990",
  idTypeAr: "جواز سفر",
  idTypeEn: "Passport",
  idNumberAr: "00000000",
  idNumberEn: "00000000",
  passportNoAr: "DEMO-0000",
  passportNoEn: "DEMO-0000",
  passportAr: "2030-09-15",
  passportEn: "2030-09-15",
  nationalityAr: "اليمن",
  nationalityEn: "Yemen",
  occupationAr: "موظف تجريبي",
  occupationEn: "Demo Employee",
  idIssueDateAr: "2024-09-15",
  idIssueDateEn: "2024-09-15",
  idIssuePlaceAr: "عدن",
  idIssuePlaceEn: "Aden",
  departmentAr: "إدارة الاختبار والتدريب",
  departmentEn: "Testing and Training Department",
  expiryAr: "2030-09-15",
  expiryEn: "2030-09-15",
  notesAr: "بيانات وهمية لأغراض الاختبار فقط، وليست وثيقة رسمية.",
  notesEn: "SAMPLE DATA FOR TESTING ONLY - NOT AN OFFICIAL DOCUMENT",
};
const FIXED_CLOSING_TEXT = {
  notesAr: initial.notesAr,
  notesEn: initial.notesEn,
};

const FORM_REVIEW_LABELS: Record<keyof FormState, string> = {
  issueNo: "رقم القيد / Issue No.",
  referenceNo: "الرقم المرجعي / Reference No.",
  internalNo: "الرقم الداخلي / Internal No.",
  issuanceNo: "رقم الإصدار / Issuance No.",
  issueDate: "تاريخ الإصدار / Issue Date",
  fullNameAr: "الاسم الكامل",
  fullNameEn: "Full Name",
  surnameAr: "اللقب",
  surnameEn: "Surname",
  birthPlaceAr: "مكان الميلاد",
  birthPlaceEn: "Birth Place",
  birthDate: "تاريخ الميلاد / Birth Date",
  idTypeAr: "نوع الهوية",
  idTypeEn: "ID Type",
  idNumberAr: "رقم الهوية",
  idNumberEn: "ID Number",
  passportNoAr: "رقم الجواز",
  passportNoEn: "Passport Number",
  passportAr: "انتهاء الجواز",
  passportEn: "Passport Expiry",
  nationalityAr: "الجنسية",
  nationalityEn: "Nationality",
  occupationAr: "المهنة",
  occupationEn: "Occupation",
  idIssueDateAr: "تاريخ إصدار الهوية",
  idIssueDateEn: "ID Issue Date",
  idIssuePlaceAr: "جهة الإصدار",
  idIssuePlaceEn: "Issuing Authority",
  departmentAr: "الجهة التي سيُقدَّم إليها / Department Requested",
  departmentEn: "Department Requested",
  expiryAr: "تاريخ انتهاء الوثيقة",
  expiryEn: "Document Expiry",
  notesAr: "الملاحظة العربية",
  notesEn: "English note",
};

const EXCEL_FIELD_ALIASES: Record<keyof FormState, string[]> = {
  issueNo: [],
  referenceNo: [],
  internalNo: [],
  issuanceNo: [],
  issueDate: ["issueDate", "issue date", "تاريخ الإصدار", "تاريخ الاصدار"],
  fullNameAr: [
    "fullNameAr",
    "full name ar",
    "الاسم الكامل",
    "الاسم العربي",
    "الاسم بالعربي",
  ],
  fullNameEn: [
    "fullNameEn",
    "full name en",
    "full name",
    "الاسم بالانجليزي",
    "الاسم الإنجليزي",
  ],
  surnameAr: ["surnameAr", "surname ar", "اللقب العربي", "اللقب"],
  surnameEn: ["surnameEn", "surname en", "surname", "اللقب بالانجليزي"],
  birthPlaceAr: [
    "birthPlaceAr",
    "birth place ar",
    "محل الميلاد العربي",
    "محل الميلاد",
  ],
  birthPlaceEn: [
    "birthPlaceEn",
    "birth place en",
    "birth place",
    "محل الميلاد بالانجليزي",
  ],
  birthDate: [
    "birthDate",
    "birth date",
    "تاريخ الميلاد",
    "تاريخ الميلاد birth date",
  ],
  idTypeAr: ["idTypeAr", "id type ar", "نوع الهوية العربي", "نوع الهوية"],
  idTypeEn: ["idTypeEn", "id type en", "id type", "نوع الهوية بالانجليزي"],
  idNumberAr: ["idNumberAr", "id number ar", "رقم الهوية العربي", "رقم الهوية"],
  idNumberEn: [
    "idNumberEn",
    "id number en",
    "id number",
    "رقم الهوية بالانجليزي",
  ],
  passportNoAr: [
    "passportNoAr",
    "passport number ar",
    "رقم الجواز العربي",
    "رقم الجواز",
  ],
  passportNoEn: [
    "passportNoEn",
    "passport number en",
    "passport number",
    "رقم الجواز بالانجليزي",
  ],
  passportAr: [
    "passportAr",
    "passport ar",
    "انتهاء الجواز العربي",
    "تاريخ انتهاء الجواز",
  ],
  passportEn: [
    "passportEn",
    "passport en",
    "passport expiry",
    "passport expiry date",
    "انتهاء الجواز بالانجليزي",
  ],
  nationalityAr: [
    "nationalityAr",
    "nationality ar",
    "الجنسية العربية",
    "الجنسية",
  ],
  nationalityEn: [
    "nationalityEn",
    "nationality en",
    "nationality",
    "الجنسية بالانجليزي",
  ],
  occupationAr: ["occupationAr", "occupation ar", "المهنة العربية", "المهنة"],
  occupationEn: [
    "occupationEn",
    "occupation en",
    "occupation",
    "المهنة بالانجليزي",
  ],
  idIssueDateAr: [
    "idIssueDateAr",
    "id issue date ar",
    "تاريخ إصدار الهوية العربي",
    "تاريخ اصدار الهوية",
  ],
  idIssueDateEn: [
    "idIssueDateEn",
    "id issue date en",
    "id issue date",
    "تاريخ إصدار الهوية بالانجليزي",
  ],
  idIssuePlaceAr: [
    "idIssuePlaceAr",
    "id issue place ar",
    "جهة إصدار الهوية العربية",
    "جهة إصدار الهوية",
  ],
  idIssuePlaceEn: [
    "idIssuePlaceEn",
    "id issue place en",
    "id issue place",
    "جهة إصدار الهوية بالانجليزي",
  ],
  departmentAr: [
    "departmentAr",
    "department ar",
    "الدولة العربية",
    "الدولة",
    "الجهة الطالبة",
  ],
  departmentEn: [
    "departmentEn",
    "department en",
    "country",
    "destination country",
    "الدولة بالانجليزي",
    "الجهة الطالبة بالانجليزي",
  ],
  expiryAr: [
    "expiryAr",
    "expiry ar",
    "document expiry ar",
    "تاريخ انتهاء الوثيقة العربي",
    "تاريخ انتهاء الوثيقة",
  ],
  expiryEn: [
    "expiryEn",
    "expiry en",
    "document expiry",
    "document expiry date",
    "تاريخ انتهاء الوثيقة بالانجليزي",
  ],
  notesAr: ["notesAr", "notes ar", "الملاحظة العربية", "الملاحظات العربية"],
  notesEn: [
    "notesEn",
    "notes en",
    "notes",
    "english note",
    "الملاحظة الإنجليزية",
  ],
};

function excelText(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function excelDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0"),
    ].join("-");
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d)
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const text = excelText(value).replace(/[٠-٩]/g, digit =>
    String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))
  );
  const european = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (european)
    return `${european[3]}-${european[2].padStart(2, "0")}-${european[1].padStart(2, "0")}`;
  const iso = text.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (iso)
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  return toInputDate(text) || text;
}

function normalizeExcelKey(value: string) {
  return normalizeLookup(value).replace(/[^a-z0-9\u0600-\u06ff]/g, "");
}

function excelRowToForm(row: Record<string, unknown>) {
  const entries = Object.entries(row);
  const result: Partial<FormState> = {};
  (Object.keys(EXCEL_FIELD_ALIASES) as Array<keyof FormState>).forEach(key => {
    const aliases = EXCEL_FIELD_ALIASES[key].map(normalizeExcelKey);
    const match = entries.find(([header]) =>
      aliases.includes(normalizeExcelKey(header))
    );
    if (!match) return;
    const value = [
      "issueDate",
      "birthDate",
      "passportAr",
      "passportEn",
      "idIssueDateAr",
      "idIssueDateEn",
      "expiryAr",
      "expiryEn",
    ].includes(key)
      ? excelDate(match[1])
      : excelText(match[1]);
    if (value) result[key] = value as never;
  });
  return result;
}

function linkedExpiryDate(issueDate: string) {
  return addYears(issueDate, 1) || issueDate;
}

const EXCEL_TEMPLATE_ROW = {
  issueDate: "15/09/2026",
  fullNameAr: "سامي ناصر علي",
  fullNameEn: "Sami Nasser Ali",
  surnameAr: "الاختباري",
  surnameEn: "Al Ikhtibari",
  birthDate: "15/09/1990",
  birthPlaceAr: "اليمن، عدن",
  birthPlaceEn: "Aden, Yemen",
  nationalityAr: "اليمن",
  nationalityEn: "Yemen",
  idTypeAr: "جواز سفر",
  idTypeEn: "Passport",
  idNumberAr: "00000000",
  idNumberEn: "00000000",
  passportAr: "15/09/2030",
  passportEn: "15/09/2030",
  occupationAr: "موظف تجريبي",
  occupationEn: "Demo Employee",
  idIssueDateAr: "15/09/2024",
  idIssueDateEn: "15/09/2024",
  idIssuePlaceAr: "عدن",
  idIssuePlaceEn: "Aden",
  departmentAr: "إدارة الاختبار والتدريب",
  departmentEn: "Testing and Training Department",
  expiryAr: "15/09/2030",
  expiryEn: "15/09/2030",
  notesAr: "بيانات وهمية لأغراض الاختبار فقط.",
  notesEn: "SAMPLE DATA FOR TESTING ONLY.",
};

const EXCEL_FIELD_GUIDE = [
  ["issueDate", "تاريخ الإصدار", "Issue Date"],
  ["fullNameAr", "الاسم الكامل", "Full Name"],
  ["fullNameEn", "الاسم بالإنجليزي", "Full Name (English)"],
  ["surnameAr", "اللقب", "Surname"],
  ["surnameEn", "اللقب بالإنجليزي", "Surname (English)"],
  ["birthDate", "تاريخ الميلاد", "Birth Date"],
  ["birthPlaceAr", "مكان الميلاد", "Birth Place"],
  ["birthPlaceEn", "مكان الميلاد بالإنجليزي", "Birth Place (English)"],
  ["nationalityAr", "الجنسية", "Nationality"],
  ["nationalityEn", "الجنسية بالإنجليزي", "Nationality (English)"],
  ["idTypeAr", "نوع الهوية", "ID Type"],
  ["idTypeEn", "نوع الهوية بالإنجليزي", "ID Type (English)"],
  ["idNumberAr", "رقم الهوية", "ID Number"],
  ["idNumberEn", "رقم الهوية بالإنجليزي", "ID Number (English)"],
  ["passportAr", "تاريخ انتهاء الجواز", "Passport Expiry"],
  ["passportEn", "تاريخ انتهاء الجواز بالإنجليزي", "Passport Expiry (English)"],
  ["occupationAr", "المهنة", "Occupation"],
  ["occupationEn", "المهنة بالإنجليزي", "Occupation (English)"],
  ["idIssueDateAr", "تاريخ إصدار الهوية", "ID Issue Date"],
  ["idIssueDateEn", "تاريخ إصدار الهوية بالإنجليزي", "ID Issue Date (English)"],
  ["idIssuePlaceAr", "جهة إصدار الهوية", "ID Issue Place"],
  ["idIssuePlaceEn", "جهة إصدار الهوية بالإنجليزي", "ID Issue Place (English)"],
  ["departmentAr", "الجهة التي سيُقدَّم إليها", "Department Requested"],
  [
    "departmentEn",
    "الجهة التي سيُقدَّم إليها بالإنجليزي",
    "Department Requested (English)",
  ],
  ["expiryAr", "تاريخ انتهاء الوثيقة", "Document Expiry"],
  ["expiryEn", "تاريخ انتهاء الوثيقة بالإنجليزي", "Document Expiry (English)"],
  ["notesAr", "الملاحظة", "Notes"],
  ["notesEn", "الملاحظة بالإنجليزي", "Notes (English)"],
] as const;

function downloadExcelTemplate() {
  const sheet = XLSX.utils.json_to_sheet([EXCEL_TEMPLATE_ROW]);
  sheet["!cols"] = Object.keys(EXCEL_TEMPLATE_ROW).map(() => ({ wch: 22 }));
  const instructions = XLSX.utils.aoa_to_sheet([
    ["تعليمات تعبئة قالب حسن السيرة والسلوك"],
    ["اكتب بيانات شخص واحد فقط في الصف الثاني من ورقة Good Conduct."],
    ["تواريخ Excel: استخدم DD/MM/YYYY أو YYYY-MM-DD."],
    [
      "الأرقام النظامية (رقم القيد والمرجع والداخلي والإصدار) ينشئها النظام تلقائيًا ولا تُستورد من Excel.",
    ],
    ["الصورة تُرفع من داخل النظام وليست داخل ملف Excel."],
    [
      "مقاس الصورة الموصى به: 400 × 600 بكسل بنسبة 2:3، JPG أو PNG، وبحد أقصى 5MB.",
    ],
    [
      "تُستخدم الصورة نفسها للعلامة المائية، ويزيل النظام الخلفية البيضاء من نسخة العلامة المائية فقط.",
    ],
    [
      "مقاس الصورة داخل الوثيقة: 40 × 60mm. مقاس العلامة المائية: 24 × 36mm تقريبًا.",
    ],
    ["لا تغيّر أسماء أعمدة ورقة Good Conduct حتى يتم الاستيراد بشكل صحيح."],
  ]);
  instructions["!cols"] = [{ wch: 120 }];
  const guide = XLSX.utils.aoa_to_sheet([
    ["اسم الحقل الداخلي", "التسمية العربية", "التسمية الإنجليزية", "ملاحظة"],
    ...EXCEL_FIELD_GUIDE.map(([key, ar, en]) => [
      key,
      ar,
      en,
      "بيانات مستخدم قابلة للاستيراد",
    ]),
    [
      "issueNo / referenceNo / internalNo / issuanceNo",
      "أرقام النظام",
      "System identifiers",
      "لا تعبئها؛ ينشئها النظام بعد الاستيراد",
    ],
  ]);
  guide["!cols"] = [{ wch: 34 }, { wch: 32 }, { wch: 34 }, { wch: 42 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Good Conduct");
  XLSX.utils.book_append_sheet(workbook, instructions, "Instructions");
  XLSX.utils.book_append_sheet(workbook, guide, "Field Guide");
  XLSX.writeFile(workbook, "Good Conduct Data Template.xlsx");
}

export function createDocumentFileName(name: string) {
  const cleaned = cleanEnglish(name)
    .replace(/_+/g, " ")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return `${cleaned || "Good Conduct Certificate"}.pdf`;
}

function Field({
  label,
  value,
  onChange,
  dir = "rtl",
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  dir?: "rtl" | "ltr";
  readOnly?: boolean;
}) {
  return (
    <div className="field">
      <Label>{label}</Label>
      <Input
        dir={dir}
        value={value}
        readOnly={readOnly}
        onChange={e => onChange(e.target.value)}
        onBlur={e => onChange(e.currentTarget.value.trim())}
      />
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <Label>{label}</Label>
      <Input
        type="date"
        dir="ltr"
        value={toInputDate(value)}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

function DatePairField({
  label,
  arabicValue,
  englishValue,
  linked,
  onToggle,
  onChange,
}: {
  label: string;
  arabicValue: string;
  englishValue: string;
  linked: boolean;
  onToggle: () => void;
  onChange: (side: "ar" | "en", value: string) => void;
}) {
  const change = (side: "ar" | "en", value: string) => {
    onChange(side, value);
    if (linked) onChange(side === "ar" ? "en" : "ar", value);
  };
  return (
    <div className="date-pair-field">
      <div className="date-pair-heading">
        <Label>{label}</Label>
        <button
          type="button"
          className={`link-toggle${linked ? " active" : ""}`}
          onClick={onToggle}
        >
          {linked ? <Link2 size={13} /> : <Unlink2 size={13} />}
          {linked ? "مرتبط" : "مستقل"}
        </button>
      </div>
      <div className="date-pair-grid">
        <div className="field">
          <label>العربي</label>
          <Input
            type="date"
            dir="rtl"
            lang="ar"
            value={toInputDate(arabicValue)}
            onChange={e => change("ar", e.target.value)}
          />
        </div>
        <div className="field">
          <label>English</label>
          <Input
            type="date"
            dir="ltr"
            lang="en"
            value={toInputDate(englishValue)}
            onChange={e => change("en", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

function TextPairField({
  label,
  arabicValue,
  englishValue,
  linked,
  onToggle,
  onChange,
}: {
  label: string;
  arabicValue: string;
  englishValue: string;
  linked: boolean;
  onToggle: () => void;
  onChange: (side: "ar" | "en", value: string) => void;
}) {
  const change = (side: "ar" | "en", value: string) => {
    onChange(side, value);
    if (linked) onChange(side === "ar" ? "en" : "ar", value);
  };
  return (
    <div className="date-pair-field text-pair-field">
      <div className="date-pair-heading">
        <Label>{label}</Label>
        <button
          type="button"
          className={`link-toggle${linked ? " active" : ""}`}
          onClick={onToggle}
          aria-pressed={linked}
        >
          {linked ? <Link2 size={13} /> : <Unlink2 size={13} />}
          {linked ? "مرتبط" : "مستقل"}
        </button>
      </div>
      <div className="date-pair-grid">
        <div className="field">
          <label>العربي</label>
          <Input
            dir="rtl"
            value={arabicValue}
            onChange={e => change("ar", e.target.value)}
          />
        </div>
        <div className="field">
          <label>English</label>
          <Input
            dir="ltr"
            value={englishValue}
            onChange={e => change("en", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

function BilingualChoiceField({
  label,
  field,
  arabicValue,
  englishValue,
  options,
  linked,
  onToggle,
  onChange,
}: {
  label: string;
  field: "nationality" | "department";
  arabicValue: string;
  englishValue: string;
  options: Array<{ ar: string; en: string }>;
  linked: boolean;
  onToggle: () => void;
  onChange: (changes: Partial<FormState>) => void;
}) {
  const listId = `options-${label.replace(/[^a-z]/gi, "-")}`;
  const selected =
    findBilingualOption(englishValue, options) ||
    findBilingualOption(arabicValue, options);
  const applyValue = (side: "ar" | "en", value: string) => {
    const option = findBilingualOption(value, options);
    const key = `${field}${side === "ar" ? "Ar" : "En"}` as
      | "nationalityAr"
      | "nationalityEn"
      | "departmentAr"
      | "departmentEn";
    if (option) {
      onChange(
        linked
          ? {
              [`${field}Ar`]: option.ar,
              [`${field}En`]: option.en,
            }
          : { [key]: value }
      );
    } else if (linked) {
      onChange({
        [`${field}Ar`]: value,
        [`${field}En`]: value,
      });
    } else {
      onChange({ [key]: value });
    }
  };
  return (
    <div className="field bilingual-choice-field">
      <div className="date-pair-heading">
        <Label>
          {label} <span>اختر أو اكتب</span>
        </Label>
        <button
          type="button"
          className={`link-toggle${linked ? " active" : ""}`}
          onClick={onToggle}
          aria-pressed={linked}
        >
          {linked ? <Link2 size={13} /> : <Unlink2 size={13} />}
          {linked ? "مرتبط" : "مستقل"}
        </button>
      </div>
      <div className="custom-nationality-grid">
        <Input
          list={listId}
          dir="rtl"
          aria-label={`${label} بالعربي`}
          value={arabicValue}
          onChange={e => applyValue("ar", e.target.value)}
          placeholder="العربية أو اكتب قيمة حرة"
        />
        <Input
          list={listId}
          dir="ltr"
          aria-label={`${label} بالإنجليزية`}
          value={englishValue}
          onChange={e => applyValue("en", e.target.value)}
          placeholder="English or custom"
        />
      </div>
      <datalist id={listId}>
        {options.map(option => (
          <>
            <option key={`${option.en}-${option.ar}-en`} value={option.en}>
              {option.ar}
            </option>
            <option key={`${option.en}-${option.ar}-ar`} value={option.ar}>
              {option.en}
            </option>
          </>
        ))}
      </datalist>
      {selected && (
        <small className="choice-hint">
          {selected.en} / {selected.ar}
        </small>
      )}
    </div>
  );
}

function AutoButton({
  onClick,
  label = "تلقائي",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="auto-button"
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
export function DocumentPreview({
  data,
  photo,
  photoName = data.fullNameEn,
  watermarkPhoto = photo,
  showWatermark = false,
}: {
  data: FormState;
  photo: string;
  photoName?: string;
  watermarkPhoto?: string;
  showWatermark?: boolean;
}) {
  const rows = [
    [
      ["Full Name", data.fullNameEn],
      ["SURNAME", data.surnameEn],
      ["اللقب", data.surnameAr],
      ["الاسم", data.fullNameAr],
    ],
    [
      ["Birth Place", data.birthPlaceEn],
      ["Date of Birth", formatDate(data.birthDate)],
      ["تاريخ الميلاد", formatArabicDate(data.birthDate)],
      ["مكان الميلاد", data.birthPlaceAr],
    ],
    [
      ["Card Type", data.idTypeEn],
      ["ID Card", data.idNumberEn],
      ["رقم الهوية", toArabicDigits(data.idNumberAr)],
      ["نوع الهوية", data.idTypeAr],
    ],
    [
      ["Date of Issue", formatDate(data.idIssueDateEn)],
      ["Date of Expiry", formatDate(data.passportEn)],
      ["تاريخ الانتهاء", formatArabicDate(data.passportAr)],
      ["تاريخ الإصدار", formatArabicDate(data.idIssueDateAr)],
    ],
    [
      ["Occupation", data.occupationEn],
      ["Nationality", data.nationalityEn],
      ["الجنسية", data.nationalityAr],
      ["المهنة", data.occupationAr],
    ],
    [
      ["Issuing Authority", data.idIssuePlaceEn],
      ["Department Requested", data.departmentEn],
      ["جهة الإصدار", data.idIssuePlaceAr],
      ["الجهة التي سيُقدَّم إليها", data.departmentAr],
    ],
  ];
  const qrPayloadAr = [
    `الدولة: ${data.nationalityAr}`,
    `جهة الاستقدام: ${data.departmentAr}`,
    `الاسم: ${data.fullNameAr}`,
    `تاريخ الميلاد: ${formatArabicDate(data.birthDate)}`,
    `رقم القيد: ${toArabicDigits(data.issueNo)}`,
  ].join("\n");
  const qrPayloadEn = [
    `COUNTRY: ${cleanEnglish(data.nationalityEn)}`,
    `RECRUITMENT DESTINATION: ${cleanEnglish(data.departmentEn)}`,
    `NAME: ${cleanEnglish(data.fullNameEn)}`,
    `BIRTH DATE: ${formatDate(data.birthDate)}`,
    `RECORD NO: ${data.issueNo}`,
  ].join("\n");
  return (
    <div className="document-wrap">
      <article className="document" id="print-document">
        <img
          className="word-template-bg"
          src={officialTemplate}
          alt=""
          aria-hidden="true"
        />
        {showWatermark && watermarkPhoto && (
          <div className="doc-watermark-wrap" aria-hidden="true">
            <img className="doc-watermark" src={watermarkPhoto} alt="" />
            <span>{data.referenceNo}</span>
          </div>
        )}
        <div className="doc-top">
          <div className="photo-stack">
            <img className="doc-photo" src={photo} alt="الصورة الشخصية" />
            <span className="doc-photo-name" dir="ltr">
              {cleanEnglish(photoName)}
            </span>
            <div className="code-details code-details-en" dir="ltr">
              <span className="passport-number">
                Passport No. {cleanEnglish(data.idNumberEn)}
              </span>
              <span>Birth Place: {cleanEnglish(data.birthPlaceEn)}</span>
            </div>
          </div>
          <div className="doc-meta">
            <div>
              <small>No. | رقم القيد</small>
              <b>{data.issueNo}</b>
            </div>
            <div>
              <small>Issue Date | تاريخ الإصدار</small>
              <b>{formatDate(data.issueDate)}</b>
            </div>
          </div>
          <div className="qr-box">
            <div className="personal-code" data-qr-value={qrPayloadAr}>
              <QRCodeSVG
                value={qrPayloadAr}
                size={128}
                level="H"
                includeMargin
              />
              <img src="/assets/yemen-emblem.png" alt="" />
            </div>
            <span>{data.fullNameAr || data.fullNameEn}</span>
            <div className="code-details code-details-ar" dir="rtl">
              <span className="passport-number">
                رقم الجواز: {toArabicDigits(data.idNumberAr)}
              </span>
              <span>مكان الميلاد: {data.birthPlaceAr}</span>
            </div>
          </div>
        </div>
        <div className="doc-table" aria-label="جدول البيانات ثنائي اللغة">
          {rows.map((row, i) => (
            <div className="doc-row" key={i}>
              <div className="doc-language english-side">
                {row.slice(0, 2).map(([label, value]) => (
                  <div className="doc-cell english" key={label}>
                    <span>{label}</span>
                    <b dir="ltr">{value}</b>
                  </div>
                ))}
              </div>
              <div className="doc-language arabic-side">
                {row.slice(2).map(([label, value]) => (
                  <div className="doc-cell arabic" key={label}>
                    <span>{label}</span>
                    <b dir="rtl">{value}</b>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="doc-statement">
          <div>{data.notesEn}</div>
          <div dir="rtl">{data.notesAr}</div>
        </div>
        <div className="doc-notes">
          <div className="doc-note-copy doc-note-copy-en">
            <p className="doc-note-text">
              Any erasure, alteration, or amendment to the information provided
              in this certificate renders it null and void.
            </p>
          </div>
          <div className="doc-note-copy doc-note-copy-ar" dir="rtl">
            <p className="doc-note-text">
              أي محو أو تعديل أو شطب في هذه البيانات يعتبر هذه الوثيقة لاغية
            </p>
          </div>
          <div className="doc-expiry doc-expiry-en">
            <p>Date of expired {formatDate(data.expiryEn)}</p>
          </div>
          <div className="doc-expiry doc-expiry-ar" dir="rtl">
            <p>تاريخ الانتهاء {formatDate(data.expiryAr)}</p>
          </div>
        </div>
        <div className="doc-signatures">
          <div className="office-signature">
            <b dir="rtl">مدير الأدلة الجنائية م/عدن</b>
          </div>
          <div className="office-signature">
            <b dir="rtl">الحاسب الآلي م/عدن</b>
          </div>
        </div>
        <div className="doc-lower-header">
          <div className="doc-lower-left" dir="rtl">
            <b className="doc-lower-date-line" dir="rtl">
              تاريخ الطلب: <span dir="ltr">{formatDate(data.issueDate)}</span>
            </b>
            <b className="doc-request-number" dir="ltr">
              No. {data.issueNo}
            </b>
          </div>
          <div className="doc-lower-right">
            <div className="doc-lower-qr" aria-label="English QR code">
              <QRCodeSVG
                value={qrPayloadEn}
                size={86}
                level="H"
                includeMargin
              />
              <span className="doc-lower-qr-label">EN</span>
            </div>
            <div className="doc-lower-identity">
              <b className="doc-lower-name" dir="rtl">
                الاسم: {data.fullNameAr || data.fullNameEn}
              </b>
              <b className="doc-lower-record-number" dir="ltr">
                الرقم: {data.issueNo}
              </b>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState(initial);
  const [photo, setPhoto] = useState(defaultPhoto);
  const [originalPhoto, setOriginalPhoto] = useState(defaultPhoto);
  const [photoName, setPhotoName] = useState(initial.fullNameEn);
  const [watermarkPhoto, setWatermarkPhoto] = useState(defaultWatermarkPhoto);
  const [linkedWatermarkPhoto, setLinkedWatermarkPhoto] =
    useState(defaultWatermarkPhoto);
  const [watermarkLinked, setWatermarkLinked] = useState(true);
  const [removePhotoBackground, setRemovePhotoBackground] = useState(false);
  const [showWatermark, setShowWatermark] = useState(true);
  const [closingTextMode, setClosingTextMode] = useState<"fixed" | "custom">(
    "fixed"
  );
  const [customDestinations, setCustomDestinations] = useState<
    Array<{ ar: string; en: string }>
  >([]);
  const [generated, setGenerated] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [documentYearLinked, setDocumentYearLinked] = useState(true);
  const [idNumberLinked, setIdNumberLinked] = useState(true);
  const [linkedTextFields, setLinkedTextFields] = useState({
    fullName: true,
    surname: true,
    birthPlace: true,
    occupation: true,
    idIssuePlace: true,
  });
  const [linkedDates, setLinkedDates] = useState({
    idIssue: true,
    expiry: true,
    passport: true,
  });
  const [departmentLinked, setDepartmentLinked] = useState(true);
  const [nationalityLinked, setNationalityLinked] = useState(true);
  const [inputView, setInputView] = useState<"guided" | "full">("guided");
  const [editorStep, setEditorStep] = useState<1 | 2 | 3>(1);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("good-conduct-form-data");
      const savedPhoto = localStorage.getItem("good-conduct-form-photo");
      const savedPhotoName = localStorage.getItem(savedPhotoNameKey);
      const savedWatermarkPhoto = localStorage.getItem(
        "good-conduct-watermark-photo"
      );
      const savedLinkedWatermarkPhoto = localStorage.getItem(
        linkedWatermarkPhotoKey
      );
      const savedWatermarkLinked = localStorage.getItem(watermarkLinkedKey);
      const savedTransparency = localStorage.getItem(
        "good-conduct-remove-photo-background"
      );
      const savedWatermarkVisibility = localStorage.getItem(
        "good-conduct-show-watermark"
      );
      const savedClosingTextMode = localStorage.getItem(
        "good-conduct-closing-text-mode"
      );
      const savedDestinations = localStorage.getItem(
        "good-conduct-custom-destinations"
      );
      if (saved) {
        const savedData = migrateData(JSON.parse(saved));
        setData(savedData);
        setPhotoName(savedPhotoName || savedData.fullNameEn);
      }
      if (savedPhoto) {
        setPhoto(savedPhoto);
        setOriginalPhoto(savedPhoto);
      }
      if (savedLinkedWatermarkPhoto)
        setLinkedWatermarkPhoto(savedLinkedWatermarkPhoto);
      if (savedWatermarkLinked !== "false") {
        if (savedLinkedWatermarkPhoto) setWatermarkPhoto(savedLinkedWatermarkPhoto);
        else if (savedWatermarkPhoto) setWatermarkPhoto(savedWatermarkPhoto);
      } else {
        setWatermarkLinked(false);
        if (savedWatermarkPhoto) setWatermarkPhoto(savedWatermarkPhoto);
      }
      if (savedTransparency !== null)
        setRemovePhotoBackground(savedTransparency === "true");
      if (savedWatermarkVisibility !== null)
        setShowWatermark(savedWatermarkVisibility === "true");
      if (savedClosingTextMode === "custom" || savedClosingTextMode === "fixed")
        setClosingTextMode(savedClosingTextMode);
      if (savedDestinations) {
        const parsed = JSON.parse(savedDestinations);
        if (Array.isArray(parsed)) setCustomDestinations(parsed);
      }
    } catch {
      /* keep defaults */
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem("good-conduct-form-data", JSON.stringify(data));
        localStorage.setItem("good-conduct-form-photo", photo);
        localStorage.setItem(savedPhotoNameKey, photoName);
        localStorage.setItem("good-conduct-watermark-photo", watermarkPhoto);
        localStorage.setItem(linkedWatermarkPhotoKey, linkedWatermarkPhoto);
        localStorage.setItem(watermarkLinkedKey, String(watermarkLinked));
        setDraftSaved(true);
      } catch {
        setDraftSaved(false);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [data, photo, photoName, watermarkPhoto, linkedWatermarkPhoto, watermarkLinked]);
  useEffect(() => {
    localStorage.setItem(
      "good-conduct-remove-photo-background",
      String(removePhotoBackground)
    );
  }, [removePhotoBackground]);
  useEffect(() => {
    localStorage.setItem("good-conduct-show-watermark", String(showWatermark));
  }, [showWatermark]);
  useEffect(() => {
    localStorage.setItem("good-conduct-closing-text-mode", closingTextMode);
  }, [closingTextMode]);
  useEffect(() => {
    const ar = data.departmentAr.trim();
    const en = data.departmentEn.trim();
    if (!ar || !en || findBilingualOption(ar, COUNTRIES)) return;
    setCustomDestinations(previous => {
      if (previous.some(option => option.ar === ar && option.en === en))
        return previous;
      return [...previous, { ar, en }];
    });
  }, [data.departmentAr, data.departmentEn]);
  useEffect(() => {
    localStorage.setItem(
      "good-conduct-custom-destinations",
      JSON.stringify(customDestinations)
    );
  }, [customDestinations]);
  const destinationOptions = useMemo(
    () => [...COUNTRIES, ...customDestinations],
    [customDestinations]
  );
  const update = (key: keyof FormState) => (value: string) =>
    setData(d => ({ ...d, [key]: value }));
  const updateSystemIdentifiers = () => {
    setData(d => ({
      ...d,
      ...generateUniqueIdentifiers(
        d.fullNameEn || d.fullNameAr,
        d.surnameEn || d.surnameAr,
        readStoredRecords()
      ),
    }));
    toast.success("تم إنشاء أرقام نظامية جديدة غير مكررة");
  };
  const onExcel = async (file?: File) => {
    if (!file) return;
    const validExtension = /\.(xlsx|xls|csv)$/i.test(file.name);
    if (!validExtension) {
      toast.error("اختر ملف Excel بصيغة XLSX أو XLS أو CSV");
      return;
    }
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), {
        type: "array",
        cellDates: true,
      });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = firstSheet
        ? XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
            defval: "",
            raw: true,
          })
        : [];
      if (!rows.length) {
        toast.error("لم يتم العثور على صف بيانات في ملف Excel");
        return;
      }
      const imported = excelRowToForm(rows[0]);
      const identifiers = generateUniqueIdentifiers(
        String(imported.fullNameEn || imported.fullNameAr || data.fullNameEn),
        String(imported.surnameEn || imported.surnameAr || data.surnameEn),
        readStoredRecords()
      );
      const closingText =
        closingTextMode === "fixed"
          ? FIXED_CLOSING_TEXT
          : {
              notesAr: imported.notesAr || data.notesAr,
              notesEn: imported.notesEn || data.notesEn,
            };
      let next = migrateData({
        ...data,
        ...imported,
        ...closingText,
        ...identifiers,
      });
      if (documentYearLinked) {
        next = {
          ...next,
          expiryAr: linkedExpiryDate(next.issueDate),
          expiryEn: linkedExpiryDate(next.issueDate),
        };
      }
      setData(next);
      setGenerated(false);
      toast.success(
        `تم استيراد بيانات الصف الأول إلى الخانات${rows.length > 1 ? "، وتم تجاهل الصفوف اللاحقة" : ""}`
      );
    } catch {
      toast.error("تعذر قراءة ملف Excel. تأكد من صحة الملف والعناوين");
    }
  };
  const updateIdNumber = (side: "ar" | "en", value: string) => {
    setData(d =>
      idNumberLinked
        ? { ...d, idNumberAr: value, idNumberEn: value }
        : { ...d, [side === "ar" ? "idNumberAr" : "idNumberEn"]: value }
    );
  };
  const updateLinkedText =
    (arKey: keyof FormState, enKey: keyof FormState, linked: boolean) =>
    (side: "ar" | "en", value: string) => {
      setData(d =>
        linked
          ? { ...d, [arKey]: value, [enKey]: value }
          : { ...d, [side === "ar" ? arKey : enKey]: value }
      );
    };
  const toggleIdNumberLink = () => {
    setIdNumberLinked(linked => {
      const nextLinked = !linked;
      if (nextLinked)
        setData(d => ({
          ...d,
          idNumberAr: d.idNumberAr || d.idNumberEn,
          idNumberEn: d.idNumberEn || d.idNumberAr,
        }));
      return nextLinked;
    });
  };
  const updateIssueDate = (value: string) => {
    setData(d =>
      documentYearLinked
        ? {
            ...d,
            issueDate: value,
            expiryAr: linkedExpiryDate(value),
            expiryEn: linkedExpiryDate(value),
          }
        : { ...d, issueDate: value }
    );
  };
  const updateExpiryDate = (side: "ar" | "en", value: string) => {
    setData(d => {
      const next = {
        ...d,
        [side === "ar" ? "expiryAr" : "expiryEn"]: value,
      };
      if (!documentYearLinked) return next;
      const issueDate = addYears(value, -1) || d.issueDate;
      return {
        ...next,
        issueDate,
        expiryAr: linkedExpiryDate(issueDate),
        expiryEn: linkedExpiryDate(issueDate),
      };
    });
  };
  const toggleDocumentYearLink = () => {
    setDocumentYearLinked(linked => {
      const nextLinked = !linked;
      if (nextLinked)
        setData(d => ({
          ...d,
          expiryAr: linkedExpiryDate(d.issueDate),
          expiryEn: linkedExpiryDate(d.issueDate),
        }));
      return nextLinked;
    });
  };
  const onPhoto = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("اختر ملف صورة صالحًا");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("حجم الصورة يجب ألا يتجاوز 5 ميجابايت");
      return;
    }
    try {
      const originalPhoto = await readPhoto(file);
      const transparentPhoto = await makeTransparentPhoto(file);
      setOriginalPhoto(originalPhoto);
      setLinkedWatermarkPhoto(transparentPhoto);
      if (watermarkLinked) setWatermarkPhoto(transparentPhoto);
      setPhoto(removePhotoBackground ? transparentPhoto : originalPhoto);
      toast.success(
        removePhotoBackground
          ? "تم تحسين الصورة وإزالة الخلفية البيضاء المتصلة"
          : "تم حفظ الصورة دون إزالة الخلفية"
      );
    } catch {
      toast.error("تعذر معالجة الصورة");
    }
  };
  const onWatermarkPhoto = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("اختر ملف صورة صالحًا للعلامة المائية");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("حجم صورة العلامة المائية يجب ألا يتجاوز 5 ميجابايت");
      return;
    }
    try {
      const transparentPhoto = await makeTransparentPhoto(file);
      setWatermarkPhoto(transparentPhoto);
      setWatermarkLinked(false);
      toast.success("تم حفظ صورة العلامة المائية المنفصلة");
    } catch {
      toast.error("تعذر معالجة صورة العلامة المائية");
    }
  };
  const toggleWatermarkLink = (linked: boolean) => {
    setWatermarkLinked(linked);
    if (linked) setWatermarkPhoto(linkedWatermarkPhoto);
  };
  const transferToRecords = () => {
    if (
      !data.issueNo.trim() ||
      !(data.fullNameAr.trim() || data.fullNameEn.trim())
    ) {
      toast.error("أدخل رقم القيد واسم صاحب الطلب أولًا");
      return;
    }
    const records = readStoredRecords();
    const record = {
      id: data.internalNo || `${data.issueNo}-${Date.now()}`,
      savedAt: new Date().toISOString(),
      data,
      photo,
      watermarkPhoto,
    };
    localStorage.setItem(
      "good-conduct-records",
      JSON.stringify([
        record,
        ...records.filter((r: { id: string }) => r.id !== record.id),
      ])
    );
    toast.success("تم ترحيل الوثيقة إلى السجلات");
  };
  const clearData = () => {
    const cleared = Object.fromEntries(
      Object.keys(initial).map(key => [key, ""])
    ) as FormState;
    setData(cleared);
    setPhoto(defaultPhoto);
    setOriginalPhoto(defaultPhoto);
    setPhotoName(initial.fullNameEn);
    setWatermarkPhoto(defaultWatermarkPhoto);
    setGenerated(false);
    setDraftSaved(false);
    setLinkedWatermarkPhoto(defaultWatermarkPhoto);
    setWatermarkLinked(true);
    localStorage.removeItem("good-conduct-form-data");
    localStorage.removeItem("good-conduct-form-photo");
    localStorage.removeItem(savedPhotoNameKey);
    localStorage.removeItem("good-conduct-watermark-photo");
    localStorage.removeItem(linkedWatermarkPhotoKey);
    localStorage.removeItem(watermarkLinkedKey);
    toast.info("تم مسح بيانات النموذج");
  };
  const generate = () => {
    if (
      !data.issueNo.trim() ||
      !(data.fullNameAr.trim() || data.fullNameEn.trim())
    ) {
      toast.error("أدخل رقم القيد واسم صاحب الطلب أولًا");
      return;
    }
    localStorage.setItem("good-conduct-form-data", JSON.stringify(data));
    localStorage.setItem("good-conduct-form-photo", photo);
    localStorage.setItem(savedPhotoNameKey, photoName);
    localStorage.setItem("good-conduct-watermark-photo", watermarkPhoto);
    localStorage.setItem(linkedWatermarkPhotoKey, linkedWatermarkPhoto);
    localStorage.setItem(watermarkLinkedKey, String(watermarkLinked));
    const records = readStoredRecords();
    const record = {
      id: data.internalNo || `${data.issueNo}-${Date.now()}`,
      savedAt: new Date().toISOString(),
      data,
      photo,
      watermarkPhoto,
    };
    localStorage.setItem(
      "good-conduct-records",
      JSON.stringify([
        record,
        ...records.filter((r: { id: string }) => r.id !== record.id),
      ])
    );
    setGenerated(true);
    setDraftSaved(true);
    toast.success("تم تحديث المعاينة بالبيانات");
    setLocation("/preview");
  };
  const reset = () => {
    setData(initial);
    setPhoto(defaultPhoto);
    setOriginalPhoto(defaultPhoto);
    setPhotoName(initial.fullNameEn);
    setWatermarkPhoto(defaultWatermarkPhoto);
    setRemovePhotoBackground(false);
    setLinkedWatermarkPhoto(defaultWatermarkPhoto);
    setWatermarkLinked(true);
    localStorage.removeItem("good-conduct-form-data");
    localStorage.removeItem("good-conduct-form-photo");
    localStorage.removeItem(savedPhotoNameKey);
    localStorage.removeItem("good-conduct-watermark-photo");
    localStorage.removeItem(linkedWatermarkPhotoKey);
    localStorage.removeItem(watermarkLinkedKey);
    setGenerated(false);
    setDraftSaved(false);
    toast.info("تمت استعادة البيانات التجريبية");
  };
  return (
    <main
      className={`app-shell editor-page noor-editor-shell input-view-${inputView} guided-step-${editorStep}`}
    >
      <aside className="control-panel">
        <div className="brand">
          <div className="brand-mark">
            <ShieldCheck size={21} />
          </div>
          <div>
            <p>CRIMINAL EVIDENCE</p>
            <h1>إصدار حسن السيرة</h1>
          </div>
        </div>
        <div className="panel-intro">
          <span className="eyebrow">
            <Sparkles size={14} /> قالب رسمي ثابت
          </span>
          <h2>
            أدخل البيانات.
            <br />
            <em>راجع الناتج.</em>
          </h2>
          <p>
            الورقة الرسمية هي القالب الأساسي. الحقول أدناه تغيّر البيانات
            المتغيرة فقط داخل نفس التصميم.
          </p>
        </div>
        <div
          className="input-mode-switch"
          role="tablist"
          aria-label="طريقة الإدخال"
        >
          <button
            type="button"
            className={inputView === "guided" ? "active" : ""}
            onClick={() => setInputView("guided")}
          >
            إصدار جديد
          </button>
          <button
            type="button"
            className={inputView === "full" ? "active" : ""}
            onClick={() => setInputView("full")}
          >
            الإدخال الكامل
          </button>
        </div>
        {inputView === "guided" && (
          <div className="guided-steps" aria-label="خطوات الإدخال">
            <span className={editorStep >= 1 ? "active" : ""}>
              01 <b>بيانات الإصدار</b>
            </span>
            <i />
            <span className={editorStep >= 2 ? "active" : ""}>
              02 <b>بيانات صاحب الطلب</b>
            </span>
            <i />
            <span className={editorStep >= 3 ? "active" : ""}>
              03 <b>المراجعة</b>
            </span>
          </div>
        )}
        <section className="form-section" data-step="1">
          <div className="section-heading">
            <span>01</span>
            <div>
              <h3>بيانات الإصدار</h3>
              <p>البيانات الظاهرة أعلى الوثيقة والرموز</p>
            </div>
          </div>
          <div className="form-grid">
            <Field
              label="رقم القيد / Issue No."
              value={data.issueNo}
              onChange={update("issueNo")}
              dir="ltr"
            />
            <div className="field-with-action">
              <Field
                label="الرقم المرجعي / Reference No."
                value={data.referenceNo}
                onChange={update("referenceNo")}
                dir="ltr"
              />
              <AutoButton
                label="توليد الأرقام"
                onClick={updateSystemIdentifiers}
              />
            </div>
            <div className="field-with-action">
              <Field
                label="رقم الإصدار / Issuance No."
                value={data.issuanceNo}
                onChange={update("issuanceNo")}
                dir="ltr"
                readOnly
              />
              <AutoButton
                label="توليد الأرقام"
                onClick={updateSystemIdentifiers}
              />
            </div>
            <div className="field-with-action">
              <Field
                label="الرقم الداخلي / Internal No."
                value={data.internalNo}
                onChange={update("internalNo")}
                dir="ltr"
                readOnly
              />
              <AutoButton
                label="توليد الأرقام"
                onClick={updateSystemIdentifiers}
              />
            </div>
            <DateField
              label="تاريخ الإصدار / Issue Date"
              value={data.issueDate}
              onChange={updateIssueDate}
            />
            <div className="date-link-control">
              <div>
                <strong>ربط سنة الإصدار والانتهاء</strong>
                <small>
                  {documentYearLinked
                    ? "تتطابق السنة تلقائيًا مع إبقاء اليوم والشهر حسب الحقل"
                    : "كل تاريخ مستقل ويمكن تعديل سنته منفردًا"}
                </small>
              </div>
              <button
                type="button"
                className={`link-toggle${documentYearLinked ? " active" : ""}`}
                onClick={toggleDocumentYearLink}
                aria-pressed={documentYearLinked}
              >
                {documentYearLinked ? (
                  <Link2 size={13} />
                ) : (
                  <Unlink2 size={13} />
                )}
                {documentYearLinked ? "السنة مرتبطة" : "السنة مستقلة"}
              </button>
            </div>
          </div>
          <div className="excel-import-panel">
            <div className="excel-import-copy">
              <FileSpreadsheet size={20} />
              <div>
                <strong>استيراد بيانات من Excel</strong>
                <p>
                  ارفع صفًا واحدًا، وستُعبّأ الخانات الحالية تلقائيًا للمراجعة
                  قبل الاعتماد.
                </p>
              </div>
            </div>
            <div className="excel-import-actions">
              <label className="excel-upload-button">
                <span>رفع ملف Excel</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  onChange={e => {
                    void onExcel(e.target.files?.[0]);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
              <Button
                type="button"
                variant="outline"
                onClick={downloadExcelTemplate}
              >
                تحميل القالب
              </Button>
            </div>
            <small className="excel-import-note">
              الأرقام النظامية مثل رقم القيد والمرجعي والداخلي ورقم الإصدار
              ينشئها النظام تلقائيًا ولا تُستورد من Excel.
            </small>
          </div>
          <div className="symbol-tester">
            <div className="symbol-tester-head">
              <span>LIVE CHECK</span>
              <strong>QR والبيانات النظامية</strong>
            </div>
            <p>
              QR لبيانات الشخص؛ وتظهر أرقام القيد والمرجعي والإصدار في خاناتها
              الرسمية.
            </p>
            <div className="test-payload">
              <span>Identifiers</span>
              <code>
                RECORD NO: {data.issueNo} | REFERENCE NO: {data.referenceNo} |
                ISSUANCE NO: {data.issuanceNo}
              </code>
              <b>يتحدث تلقائيًا</b>
            </div>
          </div>
        </section>
        <section className="form-section" data-step="2">
          <div className="section-heading">
            <span>02</span>
            <div>
              <h3>بيانات صاحب الطلب</h3>
              <p>تظهر في الجدول العربي والإنجليزي</p>
            </div>
          </div>
          <div className="form-grid">
            <TextPairField
              label="الاسم الكامل / Full Name"
              arabicValue={data.fullNameAr}
              englishValue={data.fullNameEn}
              linked={linkedTextFields.fullName}
              onToggle={() =>
                setLinkedTextFields(d => ({ ...d, fullName: !d.fullName }))
              }
              onChange={updateLinkedText(
                "fullNameAr",
                "fullNameEn",
                linkedTextFields.fullName
              )}
            />
            <TextPairField
              label="اللقب / Surname"
              arabicValue={data.surnameAr}
              englishValue={data.surnameEn}
              linked={linkedTextFields.surname}
              onToggle={() =>
                setLinkedTextFields(d => ({ ...d, surname: !d.surname }))
              }
              onChange={updateLinkedText(
                "surnameAr",
                "surnameEn",
                linkedTextFields.surname
              )}
            />
            <TextPairField
              label="مكان الميلاد / Birth Place"
              arabicValue={data.birthPlaceAr}
              englishValue={data.birthPlaceEn}
              linked={linkedTextFields.birthPlace}
              onToggle={() =>
                setLinkedTextFields(d => ({ ...d, birthPlace: !d.birthPlace }))
              }
              onChange={updateLinkedText(
                "birthPlaceAr",
                "birthPlaceEn",
                linkedTextFields.birthPlace
              )}
            />
            <DateField
              label="تاريخ الميلاد / Date of Birth"
              value={data.birthDate}
              onChange={update("birthDate")}
            />
            <DatePairField
              label={"تاريخ الانتهاء / Date of Expiry"}
              arabicValue={data.passportAr}
              englishValue={data.passportEn}
              linked={linkedDates.passport}
              onToggle={() =>
                setLinkedDates(d => ({ ...d, passport: !d.passport }))
              }
              onChange={(side, value) =>
                setData(d => ({
                  ...d,
                  [side === "ar" ? "passportAr" : "passportEn"]: value,
                }))
              }
            />
            <div className="field document-type-field">
              <Label>نوع الهوية / Card Type</Label>
              <select
                value={data.idTypeEn}
                onChange={e => {
                  const option = DOCUMENT_TYPE_OPTIONS.find(
                    item => item.en === e.target.value
                  );
                  if (option)
                    setData(d => ({
                      ...d,
                      idTypeAr: option.ar,
                      idTypeEn: option.en,
                    }));
                }}
              >
                {DOCUMENT_TYPE_OPTIONS.map(option => (
                  <option key={option.en} value={option.en}>
                    {option.ar} / {option.en}
                  </option>
                ))}
              </select>
            </div>
            <TextPairField
              label="رقم الهوية / ID Card"
              arabicValue={data.idNumberAr}
              englishValue={data.idNumberEn}
              linked={idNumberLinked}
              onToggle={toggleIdNumberLink}
              onChange={updateIdNumber}
            />
            <TextPairField
              label="المهنة / Occupation"
              arabicValue={data.occupationAr}
              englishValue={data.occupationEn}
              linked={linkedTextFields.occupation}
              onToggle={() =>
                setLinkedTextFields(d => ({ ...d, occupation: !d.occupation }))
              }
              onChange={updateLinkedText(
                "occupationAr",
                "occupationEn",
                linkedTextFields.occupation
              )}
            />
            <TextPairField
              label="جهة الإصدار / Issuing Authority"
              arabicValue={data.idIssuePlaceAr}
              englishValue={data.idIssuePlaceEn}
              linked={linkedTextFields.idIssuePlace}
              onToggle={() =>
                setLinkedTextFields(d => ({
                  ...d,
                  idIssuePlace: !d.idIssuePlace,
                }))
              }
              onChange={updateLinkedText(
                "idIssuePlaceAr",
                "idIssuePlaceEn",
                linkedTextFields.idIssuePlace
              )}
            />
            <BilingualChoiceField
              label="الجهة التي سيُقدَّم إليها / Department Requested"
              field="department"
              options={destinationOptions}
              arabicValue={data.departmentAr}
              englishValue={data.departmentEn}
              linked={departmentLinked}
              onToggle={() => setDepartmentLinked(linked => !linked)}
              onChange={changes => setData(d => ({ ...d, ...changes }))}
            />
            <DatePairField
              label="تاريخ إصدار الهوية / ID Issue Date"
              arabicValue={data.idIssueDateAr}
              englishValue={data.idIssueDateEn}
              linked={linkedDates.idIssue}
              onToggle={() =>
                setLinkedDates(d => ({ ...d, idIssue: !d.idIssue }))
              }
              onChange={(side, value) =>
                setData(d => ({
                  ...d,
                  [side === "ar" ? "idIssueDateAr" : "idIssueDateEn"]: value,
                }))
              }
            />
            <BilingualChoiceField
              label="الجنسية / Nationality"
              field="nationality"
              options={NATIONALITIES}
              arabicValue={data.nationalityAr}
              englishValue={data.nationalityEn}
              linked={nationalityLinked}
              onToggle={() => setNationalityLinked(linked => !linked)}
              onChange={changes => setData(d => ({ ...d, ...changes }))}
            />
            <DatePairField
              label="تاريخ انتهاء الوثيقة / Document Expiry Date"
              arabicValue={data.expiryAr}
              englishValue={data.expiryEn}
              linked={linkedDates.expiry}
              onToggle={() =>
                setLinkedDates(d => ({ ...d, expiry: !d.expiry }))
              }
              onChange={updateExpiryDate}
            />
          </div>
          <label className="upload-zone">
            <ImagePlus size={18} />
            <span>رفع الصورة الشخصية</span>
            <small>بيانات وهمية فقط</small>
            <input
              type="file"
              accept="image/*"
              aria-label="رفع صورة شخصية"
              onChange={e => onPhoto(e.target.files?.[0])}
            />
          </label>
          <div className="photo-name-editor">
            <Field
              label="الاسم أسفل الصورة / Photo name"
              value={photoName}
              onChange={setPhotoName}
              dir="ltr"
            />
          </div>
          <label className="upload-zone watermark-upload-zone">
            <ImagePlus size={18} />
            <span>رفع صورة العلامة المائية</span>
            <small>اختياري</small>
            <input
              type="file"
              accept="image/*"
              aria-label="رفع صورة العلامة المائية"
              onChange={e => onWatermarkPhoto(e.target.files?.[0])}
            />
          </label>
          <label className="transparency-toggle">
            <input
              type="checkbox"
              checked={watermarkLinked}
              onChange={e => toggleWatermarkLink(e.target.checked)}
            />
            <span>
              <strong>ربط العلامة المائية بالصورة الأصلية</strong>
              <small>
                عند إلغاء الربط تستخدم الصورة المرفوعة للعلامة المائية فقط
              </small>
            </span>
          </label>
          <label className="transparency-toggle">
            <input
              type="checkbox"
              checked={removePhotoBackground}
              onChange={async e => {
                const enabled = e.target.checked;
                setRemovePhotoBackground(enabled);
                if (originalPhoto !== defaultPhoto)
                  setPhoto(enabled ? watermarkPhoto : originalPhoto);
              }}
            />
            <span>
              <strong>إزالة خلفية الصورة</strong>
              <small>
                تؤثر على الصورة الشخصية فقط، ولا تغيّر العلامة المائية
              </small>
            </span>
          </label>
          <label className="transparency-toggle">
            <input
              type="checkbox"
              checked={showWatermark}
              onChange={e => setShowWatermark(e.target.checked)}
            />
            <span>
              <strong>إضافة العلامة المائية</strong>
              <small>تظهر في منتصف الصفحة فوق الجدول مع الرقم المرجعي</small>
            </span>
          </label>
        </section>
        <section className="form-section" data-step="2">
          <div className="section-heading">
            <span>03</span>
            <div>
              <h3>النصوص الختامية</h3>
              <p>ثابتة لا تتغير مع Excel أو حرة قابلة للتحرير</p>
            </div>
          </div>
          <div className="closing-text-choice">
            <label htmlFor="closing-text-mode">نوع الجملة الخاتمية</label>
            <select
              id="closing-text-mode"
              value={closingTextMode}
              onChange={e =>
                setClosingTextMode(e.target.value as "fixed" | "custom")
              }
            >
              <option value="fixed">جملة ثابتة معتمدة</option>
              <option value="custom">جملة حرة قابلة للتحرير</option>
            </select>
          </div>
          <div className="stack">
            <Textarea
              aria-label="الملاحظة العربية"
              dir="rtl"
              value={data.notesAr}
              readOnly={closingTextMode === "fixed"}
              onChange={e => setData(d => ({ ...d, notesAr: e.target.value }))}
            />
            <Textarea
              aria-label="English note"
              value={data.notesEn}
              readOnly={closingTextMode === "fixed"}
              onChange={e => setData(d => ({ ...d, notesEn: e.target.value }))}
            />
          </div>
        </section>
        <section className="guided-review-panel" data-step="3">
          <div className="section-heading">
            <span>03</span>
            <div>
              <h3>مراجعة بيانات الإدخال</h3>
              <p>راجع الحقول كاملة قبل الانتقال إلى الإدخال الكامل</p>
            </div>
          </div>
          <div className="guided-review-grid full-review-grid">
            {(Object.keys(initial) as Array<keyof FormState>)
              .filter(key => key !== "passportNoAr" && key !== "passportNoEn")
              .map(key => (
                <div key={key}>
                  <small>{FORM_REVIEW_LABELS[key]}</small>
                  <strong
                    dir={
                      key.endsWith("En") ||
                      [
                        "issueNo",
                        "referenceNo",
                        "internalNo",
                        "issuanceNo",
                        "issueDate",
                        "birthDate",
                      ].includes(key)
                        ? "ltr"
                        : "rtl"
                    }
                  >
                    {data[key] || "—"}
                  </strong>
                </div>
              ))}
          </div>
          <button
            type="button"
            className="review-to-full"
            onClick={() => setInputView("full")}
          >
            فتح الإدخال الكامل <ArrowLeft size={15} />
          </button>
        </section>
        {inputView === "guided" && (
          <div className="guided-navigation">
            <Button
              variant="outline"
              type="button"
              disabled={editorStep === 1}
              onClick={() => setEditorStep(step => (step - 1) as 1 | 2 | 3)}
            >
              الخطوة السابقة
            </Button>
            {editorStep < 3 ? (
              <Button
                type="button"
                onClick={() => setEditorStep(step => (step + 1) as 1 | 2 | 3)}
              >
                الخطوة التالية <ArrowLeft size={15} />
              </Button>
            ) : (
              <Button type="button" onClick={() => setInputView("full")}>
                مراجعة كل الحقول <ArrowLeft size={15} />
              </Button>
            )}
          </div>
        )}
        <div className="actions">
          <Button onClick={generate}>
            <FileCheck2 size={17} /> تحديث المعاينة
          </Button>
          <Button variant="outline" onClick={transferToRecords}>
            <ClipboardList size={16} /> ترحيل وحفظ بالسجلات
          </Button>
          <Button variant="outline" onClick={clearData}>
            <Eraser size={16} /> مسح البيانات
          </Button>
          <Button variant="outline" onClick={reset}>
            <RotateCcw size={16} /> إعادة ضبط
          </Button>
          <Button variant="outline" onClick={() => setLocation("/records")}>
            <ClipboardList size={16} /> السجلات
          </Button>
          <Button variant="outline" onClick={() => setLocation("/operations")}>
            <BarChart3 size={16} /> العمليات
          </Button>
          <Button
            variant="outline"
            className="work-letters-entry"
            onClick={() => setLocation("/work-letters")}
          >
            <FileText size={16} /> خطابات العمل
          </Button>
        </div>
      </aside>
      <section className="preview-panel">
        <div className="preview-top">
          <div>
            <span className="eyebrow">OFFICIAL TEMPLATE PREVIEW</span>
            <h2>معاينة الورقة الرسمية</h2>
          </div>
          <div className="preview-actions">
            <span className={generated ? "status ready" : "status"}>
              <i />{" "}
              {generated
                ? "تم التحديث"
                : draftSaved
                  ? "المسودة محفوظة"
                  : "بيانات تجريبية"}
            </span>
            <Button
              variant="outline"
              onClick={() => {
                localStorage.setItem(
                  "good-conduct-form-data",
                  JSON.stringify(data)
                );
                localStorage.setItem("good-conduct-form-photo", photo);
                localStorage.setItem(savedPhotoNameKey, photoName);
                localStorage.setItem(
                  "good-conduct-watermark-photo",
                  watermarkPhoto
                );
                setLocation("/preview");
              }}
            >
              <Download size={16} /> PDF / طباعة
            </Button>
          </div>
        </div>
        <div className="preview-note">
          <ShieldCheck size={16} />
          <span>
            القالب الرسمي ثابت، والمتغيرات فقط هي البيانات التي تدخلها في لوحة
            التحكم.
          </span>
        </div>
        <DocumentPreview
          data={data}
          photo={photo}
          photoName={photoName}
          watermarkPhoto={watermarkPhoto}
          showWatermark={showWatermark}
        />
      </section>
    </main>
  );
}
