import { Router, type IRouter } from "express";
import { db, playlistTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  AddToPlaylistBodyResponse,
  AddToPlaylistBody,
  GetPlaylistResponse,
  RemoveFromPlaylistResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/playlist", async (req, res) => {
  try {
    const entries = await db
      .select()
      .from(playlistTable)
      .orderBy(playlistTable.addedAt);

    const result = GetPlaylistResponse.parse({
      entries: entries.map((e) => ({
        ...e,
        addedAt: e.addedAt.toISOString(),
      })),
      count: entries.length,
    });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error fetching playlist");
    res.status(500).json({ error: "Failed to fetch playlist" });
  }
});

router.post("/playlist", async (req, res) => {
  const parsed = AddToPlaylistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.message });
    return;
  }

  try {
    const [entry] = await db
      .insert(playlistTable)
      .values({
        url: parsed.data.url,
        type: parsed.data.type,
        title: parsed.data.title,
        quality: parsed.data.quality ?? null,
        duration: parsed.data.duration ?? null,
        thumbnail: parsed.data.thumbnail ?? null,
        sourceHost: parsed.data.sourceHost,
      })
      .returning();

    const result = AddToPlaylistBodyResponse.parse({
      ...entry,
      addedAt: entry.addedAt.toISOString(),
    });
    res.status(201).json(result);
  } catch (err) {
    req.log.error({ err }, "Error adding to playlist");
    res.status(500).json({ error: "Failed to add to playlist" });
  }
});

router.delete("/playlist/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  try {
    const deleted = await db
      .delete(playlistTable)
      .where(eq(playlistTable.id, id))
      .returning();

    if (deleted.length === 0) {
      res.status(404).json({ error: "Playlist entry not found" });
      return;
    }

    const result = RemoveFromPlaylistResponse.parse({ success: true });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error removing from playlist");
    res.status(500).json({ error: "Failed to remove from playlist" });
  }
});

export default router;
