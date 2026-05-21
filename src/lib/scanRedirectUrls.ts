type BuildScanUrlArgs = {
  sessionId: string;
  productPath: string;
  origin?: string;
  clientToken?: string | null;
};

type BuildReturnUrlArgs = {
  returnTo: string;
  sessionId: string;
  clientToken?: string | null;
};

function normalizePath(path: string): string {
  if (!path) return "/";
  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return "/";
    }
  }
  return path.startsWith("/") ? path : `/${path}`;
}

function appendParams(path: string, params: Record<string, string | null | undefined>): string {
  const url = new URL(normalizePath(path), "https://fitly.local");
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function readClientToken(search = typeof window !== "undefined" ? window.location.search : "") {
  return new URLSearchParams(search).get("t");
}

export function buildScanUrl({
  sessionId,
  productPath: _productPath,
  origin = typeof window !== "undefined" ? window.location.origin : "",
  clientToken = readClientToken(),
}: BuildScanUrlArgs): string {
  // QR scans come from a SEPARATE device (laptop generates QR, phone scans).
  // The phone must NOT navigate back to the product page — it should show the
  // "go back to laptop" success screen. The laptop's realtime listener picks up
  // the scan and renders results. Therefore: no returnTo in the QR URL.
  const scanPath = appendParams(`/scan/${sessionId}`, { t: clientToken });
  return origin ? `${origin}${scanPath}` : scanPath;
}

export function buildReturnUrl({
  returnTo,
  sessionId,
  clientToken = readClientToken(),
}: BuildReturnUrlArgs): string {
  return appendParams(returnTo, { session: sessionId, t: clientToken });
}
