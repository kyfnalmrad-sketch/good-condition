import { ArrowLeft, FilePenLine, Printer, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { draftKey } from "./db";
import { COMPANIES, demoFor, LetterPreview, normalizeCompanyId, supportsFormat3, type Language, type LetterFormat } from "./WorkLettersApp";
import type { WorkLetterData } from "./db";

function routeState() {
  const params = new URLSearchParams(window.location.search);
  const companyId = normalizeCompanyId(params.get("company") || "astar");
  const language: Language = params.get("language") === "en" ? "en" : "ar";
  const requestedFormat = params.get("format");
  const format: LetterFormat = language !== "en" ? 1 : requestedFormat === "2" ? 2 : requestedFormat === "3" && supportsFormat3(companyId) ? 3 : 1;
  return { companyId, language, format };
}

function formatSuffix(format: LetterFormat) {
  return format === 1 ? "" : `&format=${format}`;
}

export default function WorkLettersPreview() {
  const [, setLocation] = useLocation();
  const [initial] = useState(routeState);
  const [companyId, setCompanyId] = useState(initial.companyId);
  const [language, setLanguage] = useState<Language>(initial.language);
  const [format, setFormat] = useState<LetterFormat>(initial.format);
  const [data, setData] = useState<WorkLetterData>(() => demoFor(initial.companyId, initial.language));
  const english = language === "en";

  useEffect(() => {
    const stored = localStorage.getItem(draftKey(companyId, language));
    if (!stored) { setData(demoFor(companyId, language)); return; }
    try { setData({ ...demoFor(companyId, language), ...JSON.parse(stored), companyId }); }
    catch { setData(demoFor(companyId, language)); }
  }, [companyId, language]);

  useEffect(() => {
    document.title = english ? "Official Work Letter · English" : "خطاب العمل الرسمي · عربي";
    return () => { document.title = "نظام إصدار حسن السيرة | معاينة تدريبية"; };
  }, [english]);

  useEffect(() => {
    const syncFromHistory = () => {
      const next = routeState();
      setCompanyId(next.companyId);
      setLanguage(next.language);
      setFormat(next.format);
    };
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, []);

  const refreshDraft = () => {
    const fallback = demoFor(companyId, language);
    const stored = localStorage.getItem(draftKey(companyId, language));
    if (!stored) { setData(fallback); return; }
    try { setData({ ...fallback, ...JSON.parse(stored), companyId }); }
    catch { setData(fallback); }
  };

  const changeCompany = (nextCompanyId: string) => {
    const nextFormat: LetterFormat = format === 3 && !supportsFormat3(nextCompanyId) ? 1 : format;
    setCompanyId(nextCompanyId);
    setFormat(nextFormat);
    setData(demoFor(nextCompanyId, language));
    setLocation(`/work-letters/preview?company=${nextCompanyId}&language=${language}${english ? formatSuffix(nextFormat) : ""}`);
  };

  const changeLanguage = (next: Language) => {
    const nextFormat: LetterFormat = next === "en" ? format : 1;
    setLanguage(next);
    setFormat(nextFormat);
    setData(demoFor(companyId, next));
    setLocation(`/work-letters/preview?company=${companyId}&language=${next}${next === "en" ? formatSuffix(nextFormat) : ""}`);
  };

  const changeFormat = (next: LetterFormat) => {
    if (next !== 1 && !english) return;
    if (next === 3 && !supportsFormat3(companyId)) return;
    setFormat(next);
    setLocation(`/work-letters/preview?company=${companyId}&language=${language}${formatSuffix(next)}`);
  };

  return <main className={`work-letter-preview-page ${english ? "preview-en" : "preview-ar"}`} dir={english ? "ltr" : "rtl"}>
    <header className="work-letter-preview-toolbar">
      <div><span>WORK-LETTERS</span><strong>{english ? "Official document preview" : "المعاينة الرسمية للخطاب"}</strong></div>
      <div className="work-letter-preview-actions">
        {COMPANIES.map(company => <Button key={company.id} variant="outline" onClick={() => changeCompany(company.id)}>{company.short}</Button>)}
        <Button variant="outline" onClick={() => changeLanguage(language === "en" ? "ar" : "en")}>{english ? "العربية" : "English"}</Button>
        {english && <>
          <Button variant={format === 1 ? "default" : "outline"} onClick={() => changeFormat(1)}>Format 1</Button>
          <Button variant={format === 2 ? "default" : "outline"} onClick={() => changeFormat(2)}>Format 2</Button>
          {supportsFormat3(companyId) && <Button variant={format === 3 ? "default" : "outline"} onClick={() => changeFormat(3)}>Format 3</Button>}
        </>}
        <Button variant="outline" onClick={refreshDraft}><RefreshCw size={16} /> {english ? "Update preview" : "تحديث المعاينة"}</Button>
        <Button variant="outline" onClick={() => setLocation(`/work-letters?company=${companyId}&language=${language}${english ? formatSuffix(format) : ""}`)}><FilePenLine size={16} /> {english ? "Edit data" : "تعديل البيانات"}</Button>
        <Button onClick={() => window.print()}><Printer size={16} /> {english ? "Print / PDF" : "طباعة / PDF"}</Button>
      </div>
    </header>
    <div className="work-letter-preview-notice"><ArrowLeft size={15} /> {english ? (format === 3 ? "Format 3 uses the selected company’s own letterhead, accent, spacing, and signature. QR is included; PDF417 is omitted." : format === 2 ? "Format 2 uses the selected company’s own official paper and styling; Format 1 remains separate." : "Only the official A4 paper is printed; the form and controls are excluded.") : (format === 2 ? "يستخدم التنسيق ٢ ورق الشركة المختارة وتنسيقها المستقل." : "تتم طباعة الورقة الرسمية A4 فقط، ولا يظهر نموذج الإدخال أو أدوات الموقع.")}</div>
    <section className="work-letter-preview-stage"><LetterPreview data={{ ...data, companyId }} language={language} format={format} /></section>
  </main>;
}
