const express = require("express");
const axios = require("axios");
const cors = require('cors')
require("dotenv").config();
const OpenAI = require("openai");
const supabase = require("./src/integration/supabase/client")

const app = express();
const port = 3000;

const MEILISEARCH_API_KEY = process.env.MEILI_API_KEY;
const ASSISTANT_ID = process.env.ASSISTANT_ID;

app.use(express.json());
app.use(cors());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});



// /*  Original Search

// async function searchMeili(query) {
//   const response = await axios.post(
//     "https://api.docs.bufetemejia.com/indexes/El-Salvador-test/search",
//     {
//       q: query,
//       limit: 5, // ✅ Limit to top 5 results
//     },
//     {
//       headers: {
//         Authorization: `Bearer ${MEILISEARCH_API_KEY}`, // ✅ Required by your server
//         "Content-Type": "application/json",
//       },
//     }
//   );
//   return response.data;
// }
// */

// /// AI powered Search

async function searchMeili(query, country) {
  const indexUrlMap = {
    "El Salvador": "https://api.docs.bufetemejia.com/indexes/El-Salvador-test/search",
    "Costa Rica": "https://api.docs.bufetemejia.com/indexes/COSTA-RICA/search",
  };

  const indexUrl = indexUrlMap[country];

  if (!indexUrl) {
    throw new Error(`No index URL configured for country: ${country}`);
  }

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

  return response.data;
}


// async function createAssistant() {
//   try {
//     const assistant = await openai.beta.assistants.create({
//       name: `legal assistant`,
//       instructions: "You are a legal assistant",
//       model: "gpt-4o",
//       //   tools: [{ type: "file_search" }],
//     });

//     const thread = await openai.beta.threads.create();

//     const newAssistant = {
//       assistantId: assistant.id,
//       threadId: thread.id,
//     };

//     return newAssistant;
//   } catch (error) {
//     console.error("Error creating assistant:", error);
//   }
// }

async function getOpenAIResponse(query, searchResultsText, threadID) {
  try {
    // const userMessage = await saveMessage({ chatId, userId, message, sender: 'user' });.
    const message = await openai.beta.threads.messages.create(threadID, {
      role: "user",
      content: `Answer the next QUESTION based on the given CONTEXT. You don't need to rely 100% on the given data. In some cases, the given context will have nothing related to the question. So, you have to review all the chat history. If the QUESTION is general chat, you can return general response. And if possible, include the article number or the name of the referred law.
      QUESTION: ${query}
      CONTEXT: ${searchResultsText}
      `,
    });

    let run = await openai.beta.threads.runs.createAndPoll(threadID, {
      assistant_id: ASSISTANT_ID,
    });

    if (run.status === "completed") {
      const messages = await openai.beta.threads.messages.list(run.thread_id);
      console.log(
        "###################################",
        messages.data[0].content[0].text.value
      );
      // for (const message of messages.data.reverse()) {
      //   console.log(`${message.role} > ${message.content[0].text.value}`);
      // }
      return messages.data[0].content[0].text.value
    } else {
      console.log(run.status);
    }

    // await saveMessage({ chatId, userId, message: botResponse, sender: 'bot' });
  } catch (error) {
    console.log(error.message);
  }
}

app.post("/api/meilisearch", async (req, res) => {
  const { query, threadID, userID, country } = req.body;
  console.log("@@@@@@@@@@@@@@@@", threadID)

  try {
    const results = await searchMeili(query, country);

    const searchResultsText = results.hits
      .map(
        (hit, index) =>
          `${index + 1}. law_title: ${hit.law_title ?? null}, type: ${hit.type ?? null}, title_number: ${hit.title?.number ?? null}, title_text: ${hit.title?.text ?? null} chapter_number: ${hit.chapter?.number ?? null}, chapter_title: ${hit.chapter?.title ?? null}, section_number: ${hit.section?.number ?? null}, section_title: ${hit.section?.title ?? null}, artitle_number: ${hit.article?.number ?? null}, article_title: ${hit.article?.title ?? null} content: ${hit.text ?? null}`
      )
      .join("\n\n");

    let currentThreadID = threadID;

    // If no thread exists, create one
    if (!threadID) {
      const thread = await openai.beta.threads.create();
      currentThreadID = thread.id;
      const title = query.length > 50 ? query.slice(0, 47) + "..." : query;

      const { data, error } = await supabase
        .from("chat_threads")
        .insert([
          {
            user_id: userID,
            title,
            thread_id: currentThreadID,
          },
        ])
        .select();

      if (error) {
        console.error("Supabase error:", error);
        return res.status(500).json({ error: "Failed to save thread" });
      }
    }

    const summary = await getOpenAIResponse(query, searchResultsText, currentThreadID);
    await supabase
      .from("chat_threads")
      .update({ updated_at: new Date() })
      .eq("thread_id", currentThreadID);
    res.json({ summary, threadID: currentThreadID });

  } catch (error) {
    console.error("Search error:", error.response?.data || error.message);
    res.status(500).send("Search failed");
  }
});

app.post("/api/get-thread-history", async (req, res) => {
  const { threadId } = req.body;

  try {
    const messages = await openai.beta.threads.messages.list(threadId);

    const cleanMessages = messages.data.map((msg) => {
      let content = "";

      if (msg.content?.[0]?.type === "text") {
        const fullText = msg.content[0].text.value;

        if (msg.role === "user") {
          // Try to extract content after "QUESTION:"
          const questionMatch = fullText.match(/QUESTION:\s*(.*?)\s*CONTEXT:/s);
          content = questionMatch ? questionMatch[1].trim() : fullText.trim();
        } else {
          content = fullText.trim(); // assistant response stays unchanged
        }
      }

      return {
        id: msg.id,
        role: msg.role,
        content,
      };
    });

    res.json({ messages: cleanMessages });

  } catch (error) {
    console.error("getting thread history error:", error.response?.data || error.message);
    res.status(500).send("getting thread history error");
  }
});



app.post("/admin/create-assistant", async (req, res) => {
  try {
    const assistant = await openai.beta.assistants.create({
      name: `Legal Assistant`,
      instructions: "You are a legal assistant that helps users understand legal documents.",
      model: "gpt-4o",
      // tools: [{ type: "retrieval" }],
    });

    res.json({ message: "Assistant Created Successfully", id: assistant.id });
    //save this assistant id in .env file

  } catch (error) {
    console.error("Assistant Creation Failed:", error.response?.data || error.message);
    res.status(500).send("Assistant Creation Failed");
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
