"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { ConnectionState } from "@/components/atoms/ConnectionBanner";
import type { PresenceMember } from "@/components/atoms/PresenceAvatars";
import type {
  DesignFrameRecord,
  DesignVersionRecord,
  PinCommentRecord,
  PinRecord,
  ReviewActor,
  ReviewBundle,
} from "@/lib/domain/types";

export function useReviewRealtime(params: {
  shareToken: string | null;
  actor: ReviewActor | null;
  setBundle: React.Dispatch<React.SetStateAction<ReviewBundle | null>>;
  onNewVersion?: (label: string) => void;
}) {
  const { shareToken, actor, setBundle, onNewVersion } = params;
  const [presenceMembers, setPresenceMembers] = useState<PresenceMember[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connected");

  useEffect(() => {
    const onOffline = () => setConnectionState("offline");
    const onOnline = () => {
      setConnectionState("restored");
      setTimeout(() => setConnectionState("connected"), 3000);
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  useEffect(() => {
    if (!shareToken || !actor) return;
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;

    const channel = supabase.channel(`review:${shareToken}`, {
      config: { presence: { key: actor.ownerId || actor.guestId || actor.name } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ actorName: string; role: "owner" | "client" }>();
        const list: PresenceMember[] = [];
        for (const [key, metas] of Object.entries(state)) {
          const first = metas[0];
          if (first) {
            list.push({ key, actorName: first.actorName, role: first.role });
          }
        }
        setPresenceMembers(list);
      })
      .on("broadcast", { event: "pin_created" }, ({ payload }) => {
        const pin = payload?.pin as PinRecord | undefined;
        if (!pin) return;
        setBundle((prev) => {
          if (!prev) return prev;
          if (prev.pins.some((p) => p.id === pin.id)) return prev;
          return { ...prev, pins: [...prev.pins, pin] };
        });
      })
      .on("broadcast", { event: "pin_updated" }, ({ payload }) => {
        const pin = payload?.pin as PinRecord | undefined;
        if (!pin) return;
        setBundle((prev) =>
          prev
            ? {
                ...prev,
                pins: prev.pins.map((p) => (p.id === pin.id ? pin : p)),
              }
            : prev
        );
      })
      .on("broadcast", { event: "pin_deleted" }, ({ payload }) => {
        const pinId = payload?.pinId as string | undefined;
        if (!pinId) return;
        setBundle((prev) =>
          prev ? { ...prev, pins: prev.pins.filter((p) => p.id !== pinId) } : prev
        );
      })
      .on("broadcast", { event: "comment_created" }, ({ payload }) => {
        const comment = payload?.comment as PinCommentRecord | undefined;
        if (!comment) return;
        setBundle((prev) =>
          prev
            ? {
                ...prev,
                pins: prev.pins.map((p) =>
                  p.id === comment.pin_id && !p.comments.some((c) => c.id === comment.id)
                    ? { ...p, comments: [...p.comments, comment] }
                    : p
                ),
              }
            : prev
        );
      })
      .on("broadcast", { event: "comment_updated" }, ({ payload }) => {
        const comment = payload?.comment as PinCommentRecord | undefined;
        if (!comment) return;
        setBundle((prev) =>
          prev
            ? {
                ...prev,
                pins: prev.pins.map((p) =>
                  p.id === comment.pin_id
                    ? {
                        ...p,
                        comments: p.comments.map((c) => (c.id === comment.id ? comment : c)),
                      }
                    : p
                ),
              }
            : prev
        );
      })
      .on("broadcast", { event: "version_created" }, ({ payload }) => {
        const ver = payload?.version as DesignVersionRecord | undefined;
        if (!ver) return;
        onNewVersion?.(ver.label);
      })
      .on("broadcast", { event: "version_approved" }, ({ payload }) => {
        const ver = payload?.version as DesignVersionRecord | undefined;
        if (!ver) return;
        setBundle((prev) =>
          prev
            ? {
                ...prev,
                versions: prev.versions.map((v) => (v.id === ver.id ? ver : v)),
              }
            : prev
        );
      })
      .on("broadcast", { event: "frames_updated" }, ({ payload }) => {
        const frames = payload?.frames as DesignFrameRecord[] | undefined;
        if (!frames) return;
        const map = new Map(frames.map((f) => [f.id, f]));
        setBundle((prev) =>
          prev
            ? {
                ...prev,
                frames: prev.frames.map((f) =>
                  map.has(f.id) ? { ...f, ...map.get(f.id)! } : f
                ),
              }
            : prev
        );
      })
      .on("broadcast", { event: "project_archived" }, ({ payload }) => {
        const archived = Boolean(payload?.archived);
        setBundle((prev) =>
          prev
            ? {
                ...prev,
                project: {
                  ...prev.project,
                  archived_at: archived ? new Date().toISOString() : null,
                },
              }
            : prev
        );
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setConnectionState("connected");
          await channel.track({
            actorName: actor.name,
            role: actor.role,
          });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnectionState("reconnecting");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [shareToken, actor, setBundle, onNewVersion]);

  return { presenceMembers, connectionState };
}
