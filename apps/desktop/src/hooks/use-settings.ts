import { commands } from "@/bindings";
import { useTauriQuery, useTauriMutation, queryKeys } from "@/lib/tauri-query";
import { useMemo, useCallback } from "react";

// Setting types
export type SettingKey =
  | "language"
  | "languages"
  | "autoDetectLanguage"
  | "smartFormat"
  | "punctuate"
  | "paragraphs"
  | "postProcess"
  | "cloudTranscription"
  | "cloudIntelligence"
  | "localModel"
  | "cloudModel"
  | "intelligenceModel";

export type LocalModel = "Whisper";
export type CloudModel = "Deepgram";
export type IntelligenceModel = "Groq" | "OpenAI" | "Gemini";

export type SettingsMap = {
  language: string;
  languages: string[];
  autoDetectLanguage: boolean;
  smartFormat: boolean;
  punctuate: boolean;
  paragraphs: boolean;
  postProcess: boolean;
  cloudTranscription: boolean;
  cloudIntelligence: boolean;
  localModel: LocalModel;
  cloudModel: CloudModel;
  intelligenceModel: IntelligenceModel;
};

const DEFAULT_SETTINGS: SettingsMap = {
  language: "en-US",
  languages: ["en-US"],
  autoDetectLanguage: false,
  smartFormat: true,
  punctuate: true,
  paragraphs: true,
  postProcess: false,
  cloudTranscription: true,
  cloudIntelligence: true,
  localModel: "Whisper",
  cloudModel: "Deepgram",
  intelligenceModel: "Groq",
};

const BOOLEAN_KEYS: SettingKey[] = [
  "smartFormat",
  "punctuate",
  "paragraphs",
  "postProcess",
  "cloudTranscription",
  "cloudIntelligence",
  "autoDetectLanguage",
];

const JSON_KEYS: SettingKey[] = ["languages"];

export type SettingValue<K extends SettingKey> = K extends "languages"
  ? string[]
  : K extends "language" | "localModel" | "cloudModel" | "intelligenceModel"
    ? string
    : boolean;

function parseValue<K extends SettingKey>(
  key: K,
  value: string
): SettingValue<K> {
  if (JSON_KEYS.includes(key)) {
    try {
      return JSON.parse(value) as unknown as SettingValue<K>;
    } catch {
      return DEFAULT_SETTINGS[key] as unknown as SettingValue<K>;
    }
  }
  if (BOOLEAN_KEYS.includes(key)) {
    return (value === "true") as unknown as SettingValue<K>;
  }
  return value as unknown as SettingValue<K>;
}

function stringifyValue<K extends SettingKey>(
  key: K,
  value: SettingValue<K>
): string {
  if (JSON_KEYS.includes(key)) {
    return JSON.stringify(value);
  }
  if (BOOLEAN_KEYS.includes(key)) {
    return value ? "true" : "false";
  }
  return value as string;
}

export function useSettings() {
  const query = useTauriQuery(queryKeys.settings.list(), commands.settingsList);

  const setMutation = useTauriMutation(commands.settingsSet, {
    invalidateKeys: [queryKeys.settings.all],
  });

  // Transform raw settings to typed map
  const settings = useMemo(() => {
    const settingsMap = { ...DEFAULT_SETTINGS };

    for (const setting of query.data ?? []) {
      const key = setting.key as SettingKey;
      if (key in DEFAULT_SETTINGS) {
        (settingsMap as Record<string, string | boolean | string[]>)[key] =
          parseValue(key, setting.value);
      }
    }

    return settingsMap;
  }, [query.data]);

  const getSetting = useCallback(
    <K extends SettingKey>(key: K): SettingValue<K> => {
      return settings[key] as unknown as SettingValue<K>;
    },
    [settings]
  );

  const setSetting = useCallback(
    async <K extends SettingKey>(key: K, value: SettingValue<K>) => {
      const stringValue = stringifyValue(key, value);
      await setMutation.mutateAsync({ key, value: stringValue });
    },
    [setMutation]
  );

  return {
    settings,
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
    getSetting,
    setSetting,
  };
}
