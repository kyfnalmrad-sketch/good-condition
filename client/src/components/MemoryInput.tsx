import { useEffect, useId, useMemo, useState, type ComponentProps, type FocusEventHandler } from "react";
import { Input } from "@/components/ui/input";
import { loadMemorySuggestions, rememberMemoryValue, type MemorySuggestion } from "@/lib/memory";

type LocalOption = {
  value: string;
  label?: string;
};

type MemoryInputProps = ComponentProps<"input"> & {
  moduleKey?: string;
  fieldKey?: string;
  localOptions?: LocalOption[];
  labelAr?: string;
  labelEn?: string;
};

function uniqueOptions(options: LocalOption[]) {
  const seen = new Set<string>();
  return options.filter(option => {
    const value = option.value.trim();
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

export function MemoryInput({ moduleKey, fieldKey, localOptions = [], labelAr, labelEn, onBlur, value, ...props }: MemoryInputProps) {
  const listId = `memory-${useId().replace(/:/g, "")}`;
  const [remoteOptions, setRemoteOptions] = useState<MemorySuggestion[]>([]);
  const currentValue = typeof value === "string" ? value : "";

  useEffect(() => {
    if (!moduleKey || !fieldKey) return;
    setRemoteOptions([]);
    let active = true;
    void loadMemorySuggestions(moduleKey, fieldKey).then(values => {
      if (active) setRemoteOptions(values);
    });
    return () => {
      active = false;
    };
  }, [fieldKey, moduleKey]);

  const options = useMemo(() => {
    const remote = remoteOptions.map(option => ({ value: option.value_text, label: option.label_ar || option.label_en || undefined }));
    return uniqueOptions([...localOptions, ...remote]);
  }, [localOptions, remoteOptions]);

  const handleBlur: FocusEventHandler<HTMLInputElement> = event => {
    if (moduleKey && fieldKey && currentValue.trim()) {
      void rememberMemoryValue({ moduleKey, fieldKey, value: currentValue, labelAr, labelEn });
    }
    onBlur?.(event);
  };

  if (!moduleKey || !fieldKey) return <Input {...props} {...(value === undefined ? {} : { value })} onBlur={onBlur} />;

  return (
    <>
      <Input {...props} {...(value === undefined ? {} : { value })} list={listId} onBlur={handleBlur} />
      <datalist id={listId}>
        {options.map(option => (
          <option key={option.value} value={option.value} label={option.label} />
        ))}
      </datalist>
    </>
  );
}
