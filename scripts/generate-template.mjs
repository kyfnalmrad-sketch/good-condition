import * as XLSX from "xlsx";

const row = {
  issueDate: "",
  fullNameAr: "",
  fullNameEn: "",
  surnameAr: "",
  surnameEn: "",
  birthDate: "",
  birthPlaceAr: "",
  birthPlaceEn: "",
  nationalityAr: "",
  nationalityEn: "",
  idTypeAr: "جواز سفر",
  idTypeEn: "Passport",
  idNumberAr: "",
  idNumberEn: "",
  passportAr: "",
  passportEn: "",
  occupationAr: "",
  occupationEn: "",
  idIssueDateAr: "",
  idIssueDateEn: "",
  idIssuePlaceAr: "",
  idIssuePlaceEn: "",
  departmentAr: "",
  departmentEn: "",
  expiryAr: "",
  expiryEn: "",
};

const guide = [
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
  ["departmentEn", "الجهة التي سيُقدَّم إليها بالإنجليزي", "Department Requested (English)"],
  ["expiryAr", "تاريخ انتهاء الوثيقة", "Document Expiry"],
  ["expiryEn", "تاريخ انتهاء الوثيقة بالإنجليزي", "Document Expiry (English)"],
];

const sheet = XLSX.utils.json_to_sheet([row]);
sheet["!cols"] = Object.keys(row).map(() => ({ wch: 22 }));
const instructions = XLSX.utils.aoa_to_sheet([
  ["تعليمات تعبئة قالب حسن السيرة والسلوك"],
  ["اكتب بيانات شخص واحد فقط في الصف الثاني من ورقة Good Conduct."],
  ["تاريخ الإصدار هو تاريخ إصدار وثيقة حسن السيرة والسلوك، وليس تاريخ إصدار جواز أو بطاقة الشخص."],
  ["أدخل بيانات الشخص الفعلية في الحقول المطابقة لها، واترك الملاحظات خارج القالب لأن الجملة الخاتمية ثابتة في النظام."],
  ["تواريخ Excel: استخدم DD/MM/YYYY أو YYYY-MM-DD."],
  ["الأرقام النظامية issueNo و referenceNo و internalNo و issuanceNo لا تكتبها؛ ينشئها النظام بعد الاستيراد."],
  ["الصورة تُرفع من داخل النظام وليست داخل ملف Excel."],
  ["لا تغيّر أسماء أعمدة ورقة Good Conduct حتى يتم الاستيراد بشكل صحيح."],
]);
instructions["!cols"] = [{ wch: 120 }];
const guideSheet = XLSX.utils.aoa_to_sheet([
  ["اسم الحقل الداخلي", "التسمية العربية", "التسمية الإنجليزية", "ملاحظة"],
  ...guide.map(([key, ar, en]) => [key, ar, en, "بيانات مستخدم قابلة للاستيراد"]),
  ["issueNo / referenceNo / internalNo / issuanceNo", "أرقام النظام", "System identifiers", "لا تعبئها؛ ينشئها النظام بعد الاستيراد"],
]);
guideSheet["!cols"] = [{ wch: 34 }, { wch: 32 }, { wch: 34 }, { wch: 42 }];
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, sheet, "Good Conduct");
XLSX.utils.book_append_sheet(workbook, instructions, "Instructions");
XLSX.utils.book_append_sheet(workbook, guideSheet, "Field Guide");
XLSX.writeFile(workbook, "Good Conduct Data Template.xlsx");
