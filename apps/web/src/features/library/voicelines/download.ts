/**
 * Save a file from another origin. Browsers ignore the `download` attribute on a link to
 * another origin and open the file in a player instead, so the file is fetched (the bucket
 * allows it with CORS), turned into a blob and saved from there. If that fails the plain link
 * opens in a new tab.
 */
export async function downloadFile(url: string, name: string): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => {
      URL.revokeObjectURL(href);
    }, 15_000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}
