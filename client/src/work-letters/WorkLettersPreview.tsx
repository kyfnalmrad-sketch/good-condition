import { ArrowLeft, FilePenLine, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { draftKey } from "./db";
import { COMPANIES, demoFor, LetterPreview, type Language, type LetterFormat } from "./WorkLettersApp";
import type { WorkLetterData } from "./db";

function routeState() {
  const params = new URLSearchParams(window.location.search);
  const language: Language = params.get("language") === "en" ? "en" : "ar";
  return {
    companyId: params.get("company") || "astar",
    language,
    format: (language === "en" && params.get("format") === "2" ? 2 : 1) as LetterFormat,
  };
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
    try { setData({ ...demoFor(companyId, language), ...JSON.parse(stored), companyId }); } catch { setData(demoFor(companyId, language)); }
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

  const changeCompany = (nextCompanyId: string) => {
    setCompanyId(nextCompanyId);
    setData(demoFor(nextCompanyId, language));
    setLocation(`/work-letters/preview?company=${nextCompanyId}&language=${language}${english && format === 2 ? "&format=2" : ""}`);
  };
  const changeLanguage = (next: Language) => {
    const nextFormat: LetterFormat = next === "en" && format === 2 ? 2 : 1;
    setLanguage(next);
    setFormat(nextFormat);
    setData(demoFor(companyId, next));
    setLocation(`/work-letters/preview?company=${companyId}&language=${next}${next === "en" && nextFormat === 2 ? "&format=2" : ""}`);
  };
  const changeFormat = (next: LetterFormat) => {
    setFormat(next);
    setLocation(`/work-letters/preview?company=${companyId}&language=en&format=${next}`);
  };

  return <main className={`work-letter-preview-page ${english ? "preview-en" : "preview-ar"}`} dir={english ? "ltr" : "rtl"}>
    <header className="work-letter-preview-toolbar">
      <div><span>WORK-LETTERS</span><strong>{english ? "Official document preview" : "المعاينة الرسمية للخطاب"}</strong></div>
      <div className="work-letter-preview-actions">
        {COMPANIES.map(company => <Button key={company.id} variant="outline" onClick={() => changeCompany(company.id)}>{company.short}</Button>)}
        <Button variant="outline" onClick={() => changeLanguage(language === "en" ? "ar" : "en")}>{english ? "العربية" : "English"}</Button>
        {english && <Button variant="outline" onClick={() => changeFormat(format === 2 ? 1 : 2)}>{format === 2 ? "Format 1" : "Format 2 · Embassy letter"}</Button>}
        <Button variant="outline" onClick={() => setLocation(`/work-letters?company=${companyId}&language=${language}${english && format === 2 ? "&format=2" : ""}`)}><FilePenLine size={16} /> {english ? "Edit data" : "تعديل البيانات"}</Button>
        <Button onClick={() => window.print()}><Printer size={16} /> {english ? "Print / PDF" : "طباعة / PDF"}</Button>
      </div>
    </header>
    <div className="work-letter-preview-notice"><ArrowLeft size={15} /> {english ? (format === 2 ? "Format 2 · Independent embassy-style layout on Astar/Master official stationery; Format 1 remains unchanged." : "Only the official A4 paper is printed; the form and controls are excluded.") : "تتم طباعة الورقة الرسمية A4 فقط، ولا يظهر نموذج الإدخال أو أدوات الموقع."}</div>
    <section className="work-letter-preview-stage"><LetterPreview data={{ ...data, companyId }} language={language} format={format} /></section>
  </main>;
}
