import AdmZip from "adm-zip";

export type PresetPackageFile = {
  filePath: string;
  content: string;
  contentEncoding: "utf8" | "base64";
  contentType: string;
};

const MAX_ZIP_BYTES = 25 * 1024 * 1024;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 250;

const TEXT_EXTENSIONS = new Set([".html", ".css", ".js", ".json", ".txt", ".svg"]);

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
};

const BLOCKED_EXTENSIONS = new Set([
  ".php",
  ".exe",
  ".dll",
  ".bat",
  ".cmd",
  ".sh",
  ".ps1",
  ".py",
  ".rb",
  ".jar",
  ".env",
]);

function extensionOf(filePath: string) {
  const last = filePath.split("/").pop() ?? "";
  const dot = last.lastIndexOf(".");
  return dot >= 0 ? last.slice(dot).toLowerCase() : "";
}

function normalizeZipPath(filePath: string) {
  return filePath.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

function stripSingleRootFolder(paths: string[]) {
  const roots = new Set(paths.map((path) => path.split("/")[0]).filter(Boolean));

  if (roots.size !== 1) {
    return new Map(paths.map((path) => [path, path]));
  }

  const [root] = Array.from(roots);
  const rootPrefix = `${root}/`;
  const stripped = paths.map((path) => (path.startsWith(rootPrefix) ? path.slice(rootPrefix.length) : path));

  if (!stripped.includes("index.html") || !stripped.includes("dashboard.html")) {
    return new Map(paths.map((path) => [path, path]));
  }

  return new Map(paths.map((path, index) => [path, stripped[index]]));
}

function validatePresetPath(filePath: string) {
  if (!filePath || filePath.includes("\0")) {
    throw new Error("ZIP contains an invalid file path.");
  }

  const parts = filePath.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || part.startsWith("."))) {
    throw new Error(`Blocked unsafe file path: ${filePath}`);
  }

  const ext = extensionOf(filePath);
  if (!CONTENT_TYPES[ext] || BLOCKED_EXTENSIONS.has(ext)) {
    throw new Error(`Unsupported file type in preset ZIP: ${filePath}`);
  }
}

export function extractPresetZip(buffer: Buffer): PresetPackageFile[] {
  if (buffer.byteLength > MAX_ZIP_BYTES) {
    throw new Error("Preset ZIP is too large. Keep packages under 25 MB.");
  }

  const zip = new AdmZip(buffer);
  const entries = zip
    .getEntries()
    .filter((entry) => !entry.isDirectory)
    .map((entry) => ({ entry, originalPath: normalizeZipPath(entry.entryName) }))
    .filter(({ originalPath }) => originalPath.length > 0);

  if (entries.length === 0) {
    throw new Error("Preset ZIP is empty.");
  }

  if (entries.length > MAX_FILES) {
    throw new Error(`Preset ZIP has too many files. Maximum is ${MAX_FILES}.`);
  }

  const pathMap = stripSingleRootFolder(entries.map(({ originalPath }) => originalPath));
  const files = entries.map(({ entry, originalPath }) => {
    const filePath = pathMap.get(originalPath) ?? originalPath;
    validatePresetPath(filePath);

    const data = entry.getData();
    if (data.byteLength > MAX_FILE_BYTES) {
      throw new Error(`File is too large: ${filePath}`);
    }

    const ext = extensionOf(filePath);
    const isText = TEXT_EXTENSIONS.has(ext);

    return {
      filePath,
      contentType: CONTENT_TYPES[ext],
      contentEncoding: isText ? "utf8" : "base64",
      content: isText ? data.toString("utf8") : data.toString("base64"),
    } satisfies PresetPackageFile;
  });

  const filePaths = new Set(files.map((file) => file.filePath));
  if (!filePaths.has("index.html") || !filePaths.has("dashboard.html")) {
    throw new Error("Preset ZIP must contain index.html and dashboard.html at the package root.");
  }

  return files;
}

export function presetFileBody(file: { content: string; contentEncoding?: string | null }) {
  return file.contentEncoding === "base64" ? Buffer.from(file.content, "base64") : file.content;
}

export function isHtmlContentType(contentType: string) {
  return contentType.toLowerCase().includes("text/html");
}
