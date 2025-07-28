import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface ChatThread {
  id: string;
  title: string;
  updatedAt: string;
  threadID: string;
}

export function useChatThreads() {
  const [chatThreads, setChatThreads] = useState<ChatThread[]>([]);

  const fetchChatThreads = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;
    if (!uid) return;

    const { data, error } = await supabase
      .from("chat_threads")
      .select("id, title, updated_at, thread_id")
      .eq("user_id", uid)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching chat threads:", error);
      return;
    }

    const formattedThreads: ChatThread[] = data.map((thread) => ({
      id: thread.id,
      title: thread.title,
      updatedAt: thread.updated_at,
      threadID: thread.thread_id,
    }));

    setChatThreads(formattedThreads);
  };

  useEffect(() => {
    fetchChatThreads();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("chat_threads_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_threads",
        },
        () => {
          fetchChatThreads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    chatThreads,
    refreshThreads: fetchChatThreads,
  };
}
