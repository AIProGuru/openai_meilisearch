const express = require("express");
const axios = require("axios");
require("dotenv").config();
const OpenAI = require("openai");

const app = express();
const port = 3000;

const MEILISEARCH_API_KEY = process.env.MEILI_API_KEY;

const ASSISTANT_ID = "asst_HvVtjJYAOXyt5YqtBckECV2B";
const THREAD_ID = "thread_CCtvmAdOOZFwpvwH7kXJR2HF";

app.use(express.json());

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

async function searchMeili(query) {
  const response = await axios.post(
    "https://api.docs.bufetemejia.com/indexes/El-Salvador-test/search",
    {
      q: query,
      limit: 5,
      hybrid: {
        semanticRatio: 1,         // 🔍 Use pure semantic search (1 = full semantic, 0 = keyword)
        embedder: "default",      // 🧠 Matches the embedder configured in Meilisearch
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

async function getOpenAIResponse(query, searchResultsText) {
  try {
    // const userMessage = await saveMessage({ chatId, userId, message, sender: 'user' });.
    const message = await openai.beta.threads.messages.create(THREAD_ID, {
      role: "user",
      content: `Answer the next QUESTION based on the given CONTEXT. You don't need to rely 100% on the given data. In some cases, the given context will have nothing related to the question. So, you have to review all the chat history.
      QUESTION: ${query}
      CONTEXT: ${searchResultsText}
      `,
    });

    let run = await openai.beta.threads.runs.createAndPoll(THREAD_ID, {
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

app.post("/meilisearch", async (req, res) => {
  const { query } = req.body;

  try {
    const results = await searchMeili(query);
    console.log(results.hits)
    const searchResultsText = results.hits
      .map(
        (hit, index) =>
          `${index + 1}. law_title: ${hit.law_title}, type: ${hit.type}, chapter_number: ${hit.chapter.number}, chapter_title: ${hit.chapter.title}, section_number: ${hit.section.number}, section_title: ${hit.section.title}, artitle_number: ${hit.article.number}, article_title: ${hit.article.title} content: ${hit.text}`
      )
      .join("\n\n");

    const summary = await getOpenAIResponse(query, searchResultsText);
    console.log(summary);
    res.json(summary);
  } catch (error) {
    console.error("Search error:", error.response?.data || error.message);
    res.status(500).send("Search failed");
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
