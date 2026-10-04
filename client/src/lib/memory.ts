export type MemorySuggestion = {
  id: string;
  app_code: "bankv1" | "good";
  module_key: string;
  field_key: string;
  value_text: string;
  label_ar: string | null;
  label_en: string | null;
  usage_count: number;
  updated_at: string;
};

export async function loadMemorySuggestions(moduleKey: string, fieldKey: string, limit = 120): Promise<MemorySuggestion[]> {
  try {
    const response = await fetch(`/api/memory?moduleKey=${encodeURIComponent(moduleKey)}&fieldKey=${encodeURIComponent(fieldKey)}&limit=${limit}`, { credentials: "same-origin" });
    if (!response.ok) return [];
    const payload = (await response.json()) as { values?: MemorySuggestion[] };
    return Array.isArray(payload.values) ? payload.values : [];
  } catch {
    return [];
  }
}

export async function rememberMemoryValue(input: { moduleKey: string; fieldKey: string; value: string; labelAr?: string; labelEn?: string }): Promise<MemorySuggestion | null> {
  try {
    const response = await fetch("/api/memory", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { value?: MemorySuggestion | null };
    return payload.value ?? null;
  } catch {
    return null;
  }
}
