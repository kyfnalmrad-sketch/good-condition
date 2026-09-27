import { ArrowRight, Download, FilePenLine, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  createDocumentFileName,
  DocumentPreview,
  initial,
  migrateData,
  type FormState,
} from "./Home";
import { useEffect, useState } from "react";

const savedDataKey = "good-conduct-form-data";
const savedPhotoKey = "good-conduct-form-photo";
const savedPhotoNameKey = "good-conduct-photo-name";
const savedWatermarkPhotoKey = "good-conduct-watermark-photo";
const defaultWatermarkPhoto = "/assets/training-photo-watermark-duotone.svg";

export default function Preview() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<FormState>(initial);
  const [photo, setPhoto] = useState("/assets/training-photo.svg");
  const [photoName, setPhotoName] = useState(initial.fullNameEn);
  const [watermarkPhoto, setWatermarkPhoto] = useState(defaultWatermarkPhoto);
  const [showWatermark, setShowWatermark] = useState(true);

  useEffect(() => {
    document.title = createDocumentFileName(data.fullNameEn);
    return () => {
      document.title = "نظام إصدار حسن السيرة | معاينة تدريبية";
    };
  }, [data.fullNameEn]);

  useEffect(() => {
    try {
      const storedData = localStorage.getItem(savedDataKey);
      const storedPhoto = localStorage.getItem(savedPhotoKey);
      const storedPhotoName = localStorage.getItem(savedPhotoNameKey);
      const storedWatermarkPhoto = localStorage.getItem(savedWatermarkPhotoKey);
      const storedWatermarkVisibility = localStorage.getItem(
        "good-conduct-show-watermark"
      );
      if (storedData) {
        const nextData = migrateData(JSON.parse(storedData));
        setData(nextData);
        setPhotoName(storedPhotoName || nextData.fullNameEn);
      }
      if (storedPhoto) setPhoto(storedPhoto);
      if (storedWatermarkPhoto) setWatermarkPhoto(storedWatermarkPhoto);
      else if (storedPhoto) setWatermarkPhoto(storedPhoto);
      if (storedWatermarkVisibility !== null)
        setShowWatermark(storedWatermarkVisibility === "true");
    } catch {
      // Keep the training defaults if saved data is unavailable.
    }
  }, []);

  return (
    <main className="preview-page" dir="rtl">
      <header className="standalone-toolbar">
        <div className="standalone-brand">
          <div className="brand-mark">
            <ShieldCheck size={20} />
          </div>
          <div>
            <span>CRIMINAL EVIDENCE</span>
            <strong>معاينة الورقة الرسمية</strong>
          </div>
        </div>
        <div className="standalone-actions">
          <Button variant="outline" onClick={() => setLocation("/editor")}>
            <FilePenLine size={16} /> تعديل البيانات
          </Button>
          <Button onClick={() => window.print()}>
            <Download size={16} /> تصدير PDF
          </Button>
        </div>
      </header>
      <section className="standalone-preview-heading">
        <div>
          <span className="eyebrow">
            <ShieldCheck size={14} /> Official document preview
          </span>
          <h1>المعاينة النهائية</h1>
          <p>
            هذه الصفحة مخصصة للمعاينة والطباعة فقط. عند اختيار تصدير PDF سيظهر
            المستند بصيغة A4 الرسمية.
          </p>
        </div>
        <Button variant="ghost" onClick={() => setLocation("/editor")}>
          <ArrowRight size={16} /> العودة للمحرر
        </Button>
      </section>
      <DocumentPreview
        data={data}
        photo={photo}
        photoName={photoName}
        watermarkPhoto={watermarkPhoto}
        showWatermark={showWatermark}
      />
    </main>
  );
}
