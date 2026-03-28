import { Router, type IRouter } from "express";
import * as cheerio from "cheerio";
import { DetectVideosResponse, DetectVideosBody } from "@workspace/api-zod";

const router: IRouter = Router();

interface VideoSource {
  url: string;
  type: "mp4" | "hls" | "dash" | "webm" | "iframe" | "unknown";
  title: string;
  quality?: string;
  duration?: number;
  thumbnail?: string;
  sourceHost: string;
}

function resolveUrl(src: string, baseUrl: string): string | null {
  try {
    if (!src || src.startsWith("blob:") || src.startsWith("data:")) return null;
    if (src.startsWith("//")) return "https:" + src;
    if (src.startsWith("http")) return src;
    return new URL(src, baseUrl).href;
  } catch {
    return null;
  }
}

function detectVideoType(url: string): VideoSource["type"] {
  const lower = url.toLowerCase().split("?")[0];
  if (lower.endsWith(".m3u8") || lower.includes(".m3u8")) return "hls";
  if (lower.endsWith(".mpd") || lower.includes(".mpd")) return "dash";
  if (lower.endsWith(".webm")) return "webm";
  if (
    lower.endsWith(".mp4") ||
    lower.endsWith(".mov") ||
    lower.endsWith(".avi") ||
    lower.includes(".mp4")
  )
    return "mp4";
  return "unknown";
}

function guessQuality(url: string): string | null {
  const match = url.match(/(\d{3,4})[pP]/);
  return match ? match[1] + "p" : null;
}

router.post("/detect", async (req, res) => {
  const parsed = DetectVideosBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.message });
    return;
  }

  const { url: targetUrl } = parsed.data;

  let pageUrl: URL;
  try {
    pageUrl = new URL(targetUrl);
  } catch {
    res.status(400).json({ error: "Invalid URL provided" });
    return;
  }

  // If the URL is a direct video file, return it immediately without scraping
  const directVideoType = detectVideoType(targetUrl);
  if (directVideoType !== "unknown") {
    const directVideo: VideoSource = {
      url: targetUrl,
      type: directVideoType,
      title: pageUrl.pathname.split("/").pop() || "Direct Stream",
      quality: guessQuality(targetUrl) ?? undefined,
      duration: undefined,
      thumbnail: undefined,
      sourceHost: pageUrl.hostname,
    };
    const result = DetectVideosResponse.parse({
      videos: [directVideo],
      pageTitle: directVideo.title,
      scannedUrl: targetUrl,
      count: 1,
    });
    res.json(result);
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      res.status(400).json({ error: `Failed to fetch URL: HTTP ${response.status}` });
      return;
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const sourceHost = pageUrl.hostname;
    const pageTitle = $("title").first().text().trim() || targetUrl;

    const videosMap = new Map<string, VideoSource>();

    function addVideo(url: string, overrides: Partial<VideoSource> = {}) {
      const resolved = resolveUrl(url, targetUrl);
      if (!resolved || videosMap.has(resolved)) return;
      const type = detectVideoType(resolved);
      const entry: VideoSource = {
        url: resolved,
        type: overrides.type || type,
        title: overrides.title || pageTitle || "Unknown Video",
        sourceHost,
      };
      const quality = overrides.quality !== undefined ? overrides.quality : guessQuality(resolved) ?? undefined;
      if (quality) entry.quality = quality;
      if (overrides.duration !== undefined && overrides.duration !== null) entry.duration = overrides.duration;
      if (overrides.thumbnail) entry.thumbnail = overrides.thumbnail;
      videosMap.set(resolved, entry);
    }

    // 1. Direct <video> elements and their <source> children
    $("video").each((_, el) => {
      const src = $(el).attr("src");
      const poster = $(el).attr("poster") || undefined;
      const durationAttrRaw = parseFloat($(el).attr("duration") || "");
      const durationAttr = isNaN(durationAttrRaw) ? undefined : durationAttrRaw;
      const title =
        $(el).attr("title") ||
        $(el).attr("aria-label") ||
        pageTitle;
      const thumbResolved = poster ? resolveUrl(poster, targetUrl) ?? undefined : undefined;

      if (src) addVideo(src, { title, thumbnail: thumbResolved, duration: durationAttr });

      $(el)
        .find("source")
        .each((_, src_el) => {
          const srcAttr = $(src_el).attr("src");
          if (srcAttr)
            addVideo(srcAttr, { title, thumbnail: thumbResolved, duration: durationAttr });
        });
    });

    // 2. <source> elements not inside <video> (rare but possible)
    $("source").each((_, el) => {
      const src = $(el).attr("src");
      if (src) addVideo(src, { title: pageTitle });
    });

    // 3. <a> links pointing to video files
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      const lower = href.toLowerCase();
      if (
        lower.match(/\.(mp4|webm|m3u8|mpd|mov|avi|mkv)(\?|$)/i)
      ) {
        addVideo(href, {
          title: $(el).text().trim() || pageTitle,
        });
      }
    });

    // 4. <iframe> elements that might embed video
    $("iframe").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src");
      if (!src) return;
      const resolved = resolveUrl(src, targetUrl);
      if (!resolved) return;
      const isVideoEmbed =
        resolved.includes("youtube") ||
        resolved.includes("youtu.be") ||
        resolved.includes("vimeo") ||
        resolved.includes("dailymotion") ||
        resolved.includes("twitch") ||
        resolved.includes("facebook.com/video") ||
        resolved.includes("/embed/") ||
        resolved.includes("/player/");
      if (isVideoEmbed && !videosMap.has(resolved)) {
        videosMap.set(resolved, {
          url: resolved,
          type: "iframe",
          title: $(el).attr("title") || pageTitle,
          quality: null,
          duration: null,
          thumbnail: null,
          sourceHost,
        });
      }
    });

    // 5. Scan inline scripts for common video URL patterns
    $("script").each((_, el) => {
      const content = $(el).html() || "";
      const videoUrlPattern =
        /["'`](https?:\/\/[^"'`\s]+\.(?:mp4|m3u8|mpd|webm)(?:\?[^"'`\s]*)?)["'`]/gi;
      let match;
      while ((match = videoUrlPattern.exec(content)) !== null) {
        addVideo(match[1], { title: pageTitle });
      }
    });

    // 6. Open Graph / meta video tags
    const ogVideo =
      $('meta[property="og:video"]').attr("content") ||
      $('meta[property="og:video:url"]').attr("content");
    const ogThumb = $('meta[property="og:image"]').attr("content");
    if (ogVideo) {
      addVideo(ogVideo, {
        title: $('meta[property="og:title"]').attr("content") || pageTitle,
        thumbnail: ogThumb ? resolveUrl(ogThumb, targetUrl) ?? undefined : undefined,
      });
    }

    const videos = Array.from(videosMap.values());

    const result = DetectVideosResponse.parse({
      videos,
      pageTitle,
      scannedUrl: targetUrl,
      count: videos.length,
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error detecting videos");
    if (err instanceof Error && err.name === "AbortError") {
      res.status(400).json({ error: "Request timed out fetching the URL" });
    } else {
      res.status(500).json({ error: "Failed to scan page for videos" });
    }
  }
});

export default router;
