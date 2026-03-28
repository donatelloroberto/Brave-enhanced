import { pgTable, serial, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const playlistTable = pgTable("playlist", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  type: text("type").notNull().default("unknown"),
  title: text("title").notNull(),
  quality: text("quality"),
  duration: real("duration"),
  thumbnail: text("thumbnail"),
  sourceHost: text("source_host").notNull(),
  addedAt: timestamp("added_at").notNull().defaultNow(),
});

export const insertPlaylistSchema = createInsertSchema(playlistTable).omit({ id: true, addedAt: true });
export type InsertPlaylist = z.infer<typeof insertPlaylistSchema>;
export type PlaylistItem = typeof playlistTable.$inferSelect;
