import "server-only";
import { createAdminSupabaseClient } from "./admin";
import { isSupabaseAdminConfigured } from "./config";

export type ReviewBroadcastEvent =
  | "pin_created"
  | "pin_updated"
  | "pin_deleted"
  | "comment_created"
  | "comment_updated"
  | "version_created"
  | "version_approved"
  | "frames_updated"
  | "project_archived";

/**
 * Sends a sanitized Realtime Broadcast to `review:${shareToken}` after DB commit.
 * Never fails the parent HTTP request if Realtime delivery experiences a transient error.
 */
export async function broadcastReviewEvent(
  shareToken: string,
  event: ReviewBroadcastEvent,
  payload: Record<string, unknown>
): Promise<void> {
  if (!isSupabaseAdminConfigured()) return;

  try {
    const admin = createAdminSupabaseClient();
    const channel = admin.channel(`review:${shareToken}`);
    const maybeHttp = channel as unknown as {
      httpSend?: (ev: string, data: Record<string, unknown>) => Promise<unknown>;
    };

    if (typeof maybeHttp.httpSend === "function") {
      await maybeHttp.httpSend(event, payload);
    } else {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 1500);
        channel.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            clearTimeout(timeout);
            try {
              await channel.send({ type: "broadcast", event, payload });
            } finally {
              await admin.removeChannel(channel);
              resolve();
            }
          }
        });
      });
    }
  } catch {
    // Non-fatal: client UI reconciles on next fetch/reconnect
  }
}
