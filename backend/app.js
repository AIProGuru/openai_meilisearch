// server.js
const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const { SocksProxyAgent } = require("socks-proxy-agent");
const OpenAI = require("openai");
const supabase = require("./src/integration/supabase/client");

const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

const proxyUrl = process.env.PROXY_URL || "socks5h://127.0.0.1:1080";
const httpsAgent = new SocksProxyAgent(proxyUrl);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  httpAgent: httpsAgent,
});

const MEILISEARCH_API_KEY = process.env.MEILI_API_KEY;
const ASSISTANT_ID = process.env.ASSISTANT_ID;

// -----------------------
// Utility: MeiliSearch
// -----------------------
async function searchMeili(query, country) {
  const indexUrlMap = {
    "El Salvador": "https://api.docs.bufetemejia.com/indexes/El-Salvador-test/search",
    "Costa Rica": "https://api.docs.bufetemejia.com/indexes/COSTA-RICA/search",
  };

  const indexUrl = indexUrlMap[country];
  if (!indexUrl) throw new Error(`No index for country: ${country}`);

  const response = await axios.post(
    indexUrl,
    {
      q: query,
      limit: 5,
      hybrid: {
        semanticRatio: 1,
        embedder: "default",
      },
    },
    {
      headers: {
        Authorization: `Bearer ${MEILISEARCH_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  const hits = response.data.hits;
  const formatted = hits
    .map((hit, index) =>
      `${index + 1}. law_title: ${hit.law_title ?? "N/A"}, type: ${hit.type ?? "N/A"}, title_number: ${hit.title?.number ?? "N/A"}, title_text: ${hit.title?.text ?? "N/A"}, chapter_number: ${hit.chapter?.number ?? "N/A"}, chapter_title: ${hit.chapter?.title ?? "N/A"}, section_number: ${hit.section?.number ?? "N/A"}, section_title: ${hit.section?.title ?? "N/A"}, article_number: ${hit.article?.number ?? "N/A"}, article_title: ${hit.article?.title ?? "N/A"}, content: ${hit.text ?? "N/A"}`
    )
    .join("\n\n");

  return formatted;
}

// ---------------------------
//  /admin/create-assistant
// ---------------------------
app.post("/admin/create-assistant", async (req, res) => {
  const systemPrompt = `
  You are a legal drafting assistant for lawyers.

  Your role is to guide the user through creating legally accurate, well-reasoned, and properly formatted legal documents (e.g., complaint, petition, demand letter, legal analysis, etc.).

  Follow this process:

  1. Ask what type of legal writing or legal task the user wants.
  2. Ask all critical information needed — e.g., parties involved, legal claims, dates, jurisdiction.
  3. Ask whether the user knows any relevant **law title, chapter, or article**. If yes, use those terms to call the \searchLegalBasis\ tool.
  4. If not provided, infer keywords from context and still call the tool.
  5. If any key information is missing, proceed with placeholders like “[Insert date here]” and inform the user to update manually.
  6. If the user requests **legal argumentation**, **case comparison**, or **interpretive reasoning** (e.g., trademark similarity, statutory application, factual analysis), provide a structured, formal analysis as part of your response.

  When drafting:
  - Use appropriate legal language and structure.
  - Be clear, formal, and concise.
  - Integrate relevant legal bases where possible.

  Always respond in the same language the user used.
`;

  try {
    const assistant = await openai.beta.assistants.create({
      name: "Legal Drafting Assistant",
      instructions: systemPrompt,
      model: "gpt-4o",
      tools: [
        {
          type: "function",
          function: {
            name: "searchLegalBasis",
            description: "Searches for relevant legal texts based on keywords and country",
            parameters: {
              type: "object",
              properties: {
                keywords: {
                  type: "string",
                  description: "Keywords to search legal content for",
                },
                country: {
                  type: "string",
                  description: "Country to restrict the legal search (e.g., El Salvador)",
                },
              },
              required: ["keywords", "country"],
            },
          },
        },
      ],
    });

    res.json({ message: "Assistant Created Successfully", id: assistant.id });
  } catch (error) {
    console.error("Assistant Creation Failed:", error.response?.data || error.message);
    res.status(500).send("Assistant Creation Failed");
  }
});

// ---------------------------
//  /api/chat
// ---------------------------
app.post("/api/chat", async (req, res) => {
  const { query, threadID, userID, country } = req.body;
  let currentThreadID = threadID;

  try {
    // Create thread if needed
    if (!currentThreadID) {
      const thread = await openai.beta.threads.create();
      currentThreadID = thread.id;
      const title = query.length > 50 ? query.slice(0, 47) + "..." : query;

      const { error } = await supabase
        .from("chat_threads")
        .insert([
          {
            user_id: userID,
            title,
            thread_id: currentThreadID,
          },
        ])
        .select();

      if (error) throw new Error("Supabase thread insert failed");
    }

    // Send user message
    await openai.beta.threads.messages.create(currentThreadID, {
      role: "user",
      content: query,
    });

    // Run the assistant
    let run = await openai.beta.threads.runs.createAndPoll(currentThreadID, {
      assistant_id: ASSISTANT_ID,
    });

    // If tool calls detected
    if (run.status === "requires_action" && run.required_action?.type === "submit_tool_outputs") {
      console.log("detected tool call")
      const toolCalls = run.required_action.submit_tool_outputs.tool_calls;

      const toolOutputs = await Promise.all(
        toolCalls.map(async (toolCall) => {
          const args = JSON.parse(toolCall.function.arguments);
          const result = await searchMeili(args.keywords, args.country);
          return {
            tool_call_id: toolCall.id,
            output: result,
          };
        })
      );

      console.log("tool output", toolOutputs)

      // Submit tool outputs
      run = await openai.beta.threads.runs.submitToolOutputsAndPoll(currentThreadID, run.id, {
        tool_outputs: toolOutputs,
      });
    }

    // Return final assistant message
    if (run.status === "completed") {
      const messages = await openai.beta.threads.messages.list(currentThreadID);
      const final = messages.data[0].content[0].text.value;
      await supabase
        .from("chat_threads")
        .update({ updated_at: new Date() })
        .eq("thread_id", currentThreadID);

      return res.json({ response: final, threadID: currentThreadID });
    } else {
      return res.status(500).send("Run did not complete.");
    }
  } catch (err) {
    console.error("Chat error:", err.response?.data || err.message);
    return res.status(500).send("Something went wrong.");
  }
});

// ---------------------------
//  /api/get-thread-history
// ---------------------------
app.post("/api/get-thread-history", async (req, res) => {
  const { threadId } = req.body;

  try {
    const messages = await openai.beta.threads.messages.list(threadId);
    const cleanMessages = messages.data.map((msg) => {
      let content = "";

      if (msg.content?.[0]?.type === "text") {
        content = msg.content[0].text.value;
      }

      return {
        id: msg.id,
        role: msg.role,
        content,
      };
    });

    res.json({ messages: cleanMessages });
  } catch (error) {
    console.error("Thread history error:", error.response?.data || error.message);
    res.status(500).send("Failed to get thread history");
  }
});

// ---------------------------
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
