import fs from "fs";
import path from "path";

export interface ProviderSettings {
  enabled: boolean;
  apiKey: string;
  dailyBudget: number;
}

export interface AppSettings {
  providers: {
    openai: ProviderSettings;
    anthropic: ProviderSettings;
    google: ProviderSettings;
    perplexity: ProviderSettings;
  };
  monitoring: {
    defaultCron: string;
    batchSize: number;
    alertsEnabled: boolean;
    emailNotifications: boolean;
    notificationEmail: string;
  };
  scoring: {
    structuralWeight: number;
    citationWeight: number;
    competitiveWeight: number;
    autoValidate: boolean;
    validationProviders: string[];
  };
  general: {
    brandName: string;
    brandDomain: string;
    setupComplete: boolean;
    timezone: string;
  };
}

const SETTINGS_PATH = path.join(process.cwd(), "aeo-settings.json");

const DEFAULT_SETTINGS: AppSettings = {
  providers: {
    openai: { enabled: false, apiKey: "", dailyBudget: 5 },
    anthropic: { enabled: false, apiKey: "", dailyBudget: 5 },
    google: { enabled: false, apiKey: "", dailyBudget: 5 },
    perplexity: { enabled: false, apiKey: "", dailyBudget: 5 },
  },
  monitoring: {
    defaultCron: "0 9 * * 1",
    batchSize: 20,
    alertsEnabled: true,
    emailNotifications: false,
    notificationEmail: "",
  },
  scoring: {
    structuralWeight: 0.2,
    citationWeight: 0.5,
    competitiveWeight: 0.3,
    autoValidate: true,
    validationProviders: ["openai", "google"],
  },
  general: {
    brandName: "",
    brandDomain: "",
    setupComplete: false,
    timezone: "UTC",
  },
};

const ENV_KEY_MAP: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
};

// ── Deep merge utility ───────────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge<T extends object>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      ) as T[keyof T];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}

// ── File I/O ─────────────────────────────────────────────────────────────

function readSettingsFile(): Partial<AppSettings> {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) {
      return {};
    }
    const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
    return JSON.parse(raw) as Partial<AppSettings>;
  } catch {
    return {};
  }
}

function writeSettingsFile(settings: AppSettings): void {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
}

// ── Public API ───────────────────────────────────────────────────────────

export function getSettings(): AppSettings {
  const stored = readSettingsFile();
  return deepMerge(DEFAULT_SETTINGS, stored) as unknown as AppSettings;
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const updated = deepMerge(current, partial) as unknown as AppSettings;
  writeSettingsFile(updated);
  return updated;
}

export function isSetupComplete(): boolean {
  const settings = getSettings();
  return settings.general.setupComplete;
}

export function getProviderApiKey(provider: string): string {
  const settings = getSettings();

  // Check settings file first
  const providerKey = provider as keyof AppSettings["providers"];
  const providerSettings = settings.providers[providerKey];

  if (providerSettings && providerSettings.apiKey) {
    return providerSettings.apiKey;
  }

  // Fall back to environment variable
  const envVar = ENV_KEY_MAP[provider];
  if (envVar) {
    return process.env[envVar] ?? "";
  }

  return "";
}
