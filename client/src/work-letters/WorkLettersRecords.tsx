import { useRef, useState, type ChangeEvent } from "react";
import { Download, RotateCcw, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  deleteWorkLetter,
  exportWorkLetterBackup,
  restoreWorkLetterBackup,
  type WorkLetterRecord,
} from "./db";
import type { Language } from "./WorkLettersApp";

type Props = {
  records: WorkLetterRecord[];
  companyId: string;
  language: Language;
  onRecordsChange: () => void | Promise<void>;
  onRestore: (record: WorkLetterRecord) => void;
};

export default function WorkLettersRecords({ records, companyId, language, onRecordsChange, onRestore }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const english = language === "en";

  async function downloadBackup() {
    setBusy(true);
    try {
      const backup = await exportWorkLetterBackup(companyId, language);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `work-letters-${companyId}-${language}-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(english ? "Company backup downloaded" : "تم تنزيل النسخة الاحتياطية للشركة");
    } catch {
      toast.error(english ? "Could not create the backup" : "تعذر إنشاء النسخة الاحتياطية");
    } finally {
      setBusy(false);
    }
  }

  async function restoreBackup(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const count = await restoreWorkLetterBackup(await file.text(), companyId, language);
      await onRecordsChange();
      toast.success(english ? `${count} record(s) restored` : `تمت استعادة ${count} سجل`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Restore failed";
      toast.error(english ? message : `تعذرت الاستعادة: ${message}`);
    } finally {
      input.value = "";
      setBusy(false);
    }
  }

  async function removeRecord(record: WorkLetterRecord) {
    const prompt = english ? "Delete this saved letter?" : "هل تريد حذف هذا الخطاب المحفوظ؟";
    if (!window.confirm(prompt)) return;
    setBusy(true);
    try {
      await deleteWorkLetter(record.id);
      await onRecordsChange();
      toast.success(english ? "Record deleted" : "تم حذف السجل");
    } catch {
      toast.error(english ? "Could not delete the record" : "تعذر حذف السجل");
    } finally {
      setBusy(false);
    }
  }

  const labels = english
    ? { title: "Saved records", subtitle: "Stored on this device · scoped to this company and language", backup: "Download backup", restore: "Restore backup", restoreRecord: "Load into form", remove: "Delete", empty: "No saved records for this company and language yet." }
    : { title: "السجلات المحفوظة", subtitle: "محفوظة على هذا الجهاز · مستقلة حسب الشركة واللغة", backup: "تنزيل نسخة احتياطية", restore: "استعادة نسخة", restoreRecord: "استعادة إلى النموذج", remove: "حذف", empty: "لا توجد سجلات محفوظة لهذه الشركة واللغة بعد." };

  return <section className="work-records">
    <div className="work-records-title">
      <div><h2>{labels.title} ({records.length})</h2><span>{labels.subtitle}</span></div>
      <div className="work-record-actions">
        <Button type="button" variant="outline" disabled={busy} onClick={downloadBackup}><Download size={15} /> {labels.backup}</Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}><Upload size={15} /> {labels.restore}</Button>
        <input ref={fileInput} className="work-record-file" type="file" accept="application/json,.json" onChange={restoreBackup} />
      </div>
    </div>
    <p className="work-records-note">{english ? "Restoring merges records for the selected company/language; the legacy source is retained after migration." : "الاستعادة تدمج سجلات الشركة واللغة المحددتين، وتبقى بيانات المصدر القديمة محفوظة بعد الترحيل."}</p>
    {records.length === 0 ? <p className="work-record-empty">{labels.empty}</p> : records.map(record => <div className="work-record" key={record.id}>
      <div><b>{record.data.employeeName}</b><span>{record.data.reference} · {new Date(record.savedAt).toLocaleString(english ? "en-US" : "ar-YE")}</span></div>
      <div className="work-record-actions">
        <Button type="button" variant="outline" disabled={busy} onClick={() => onRestore(record)}><RotateCcw size={15} /> {labels.restoreRecord}</Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => removeRecord(record)}><Trash2 size={15} /> {labels.remove}</Button>
      </div>
    </div>)}
  </section>;
}
