export default async function handler(req, res) {
  const OWNER = process.env.GH_OWNER;
  const REPO  = process.env.GH_REPO;
  const PATH  = process.env.GH_PATH || "data.json";
  const TOKEN = process.env.GH_TOKEN;
  const BRANCH = process.env.GH_BRANCH || "main";

  const apiBase = "https://api.github.com";
  const headers = {
    "Authorization": `Bearer ${TOKEN}`,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  async function getCurrentFile() {
    const url = `${apiBase}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(PATH)}?ref=${encodeURIComponent(BRANCH)}`;
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(await r.text());
    return await r.json();
  }

  if (req.method === "GET") {
    try {
      const file = await getCurrentFile();
      const jsonText = Buffer.from(file.content, "base64").toString("utf-8");
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(200).send(jsonText);
    } catch (e) {
      return res.status(500).json({ error: String(e.message || e) });
    }
  }

  if (req.method === "POST") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (!body || !Array.isArray(body.rows)) {
        return res.status(400).json({ error: "Body must be { rows: [...] }" });
      }

      const file = await getCurrentFile();
      const sha = file.sha;

      const newText = JSON.stringify({ rows: body.rows }, null, 2);
      const newB64 = Buffer.from(newText, "utf-8").toString("base64");

      const putUrl = `${apiBase}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(PATH)}`;
      const putBody = {
        message: "Auto-save data.json",
        content: newB64,
        sha,
        branch: BRANCH,
      };

      const r2 = await fetch(putUrl, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(putBody),
      });
      if (!r2.ok) throw new Error(await r2.text());

      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: String(e.message || e) });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).end("Method Not Allowed");
}
