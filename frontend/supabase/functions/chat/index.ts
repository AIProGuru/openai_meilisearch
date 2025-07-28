
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import OpenAI from "https://deno.land/x/openai@v4.20.1/mod.ts";

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, threadId } = await req.json();
    
    let thread;
    if (!threadId) {
      thread = await openai.beta.threads.create();
    } else {
      thread = { id: threadId };
    }

    if (messages?.length > 0) {
      await openai.beta.threads.messages.create(thread.id, {
        role: "user",
        content: messages[messages.length - 1].content
      });
    }

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: "asst_abc123", // Replace with your assistant ID
      instructions: "You are a helpful AI assistant. Be concise and clear in your responses."
    });

    // Poll for completion
    let completion;
    while (true) {
      completion = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      if (completion.status === 'completed') {
        break;
      }
      if (completion.status === 'failed') {
        throw new Error('Assistant run failed');
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const messageList = await openai.beta.threads.messages.list(thread.id);
    const lastMessage = messageList.data[0];

    return new Response(
      JSON.stringify({
        threadId: thread.id,
        message: {
          role: lastMessage.role,
          content: lastMessage.content[0].text.value
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
