import { PublicKey } from "@solana/web3.js";
import WebSocket from "ws"; // Node.js websocket library
import * as dotenv from "dotenv";
import { getWalletTokenHoldings } from "./walletTracker";
import { getAccountInfoStreamReponseWithConfirmation, GetWalletTokenHoldingsResponse, SplTokenHolding, SplTokenStoreReponse } from "./types";
import { config } from "./config";
import { updateHoldings } from "./db";
import { DateTime } from "luxon";

// Load env variables
dotenv.config();

// Create regional functions to push transfers and logs to const
const saveLogTo = (logsArray: string[], ...args: unknown[]): void => {
  const message = args.map((arg) => String(arg)).join(" ");
  logsArray[logsArray.length] = message;
};
function shortenAddress(address: string): string {
  const start = address.slice(0, 4);
  const end = address.slice(-4);
  return `${start}...${end}`;
}

// Create Action and holdings Log constant
const actionsLogs: string[] = [];
let holdingLogs: string[] = [];
function showLogs() {
  const wallets = config.wallets;
  console.clear();
  console.log(`📈 Tracked Wallets overview`);
  console.log("================================================================================");
  if (wallets.length === 0) console.log("🔎 No wallets to track at this moment: ", new Date().toISOString());
  console.log(holdingLogs.join("\n"));

  // Output Action Logs
  console.log("\n\n📜 Action Logs");
  console.log("================================================================================");
  console.log(actionsLogs.slice().reverse().join("\n"));
}

// Main to fetch token holdings for provided wallets
let firstRun = true;
async function fetchHoldings(): Promise<void> {
  try {
    holdingLogs.length = 0;

    const wallets = config.wallets;
    let walletCount = 1;
    for (const wallet of wallets) {
      const walletAddress = wallet.address;
      const walletName = wallet.name;
      const walletTags = wallet.tags;
      const walletEmoji = wallet.emoji;

      // Verify if this is a valid walletAddress
      let publicKey;
      try {
        publicKey = new PublicKey(walletAddress);
      } catch (error) {
        console.log(`🚫 Invalid walletAddress, proceeding with next wallet `);
        continue;
      }

      // Get all the spl-token holdings for this wallet
      const tokenHoldings: GetWalletTokenHoldingsResponse = await getWalletTokenHoldings(publicKey.toString());

      // Check if fetching the holdings was successfull
      if (!tokenHoldings.success) {
        saveLogTo(actionsLogs, tokenHoldings.msg);
        continue;
      }

      // Store in safe variable
      const tokenHoldingsData: SplTokenHolding[] = tokenHoldings.data;

      // Output the wallets that we are tracking
      saveLogTo(holdingLogs, `${walletCount}. ${wallet.name} ${walletEmoji} (${shortenAddress(walletAddress)}) holds ${tokenHoldingsData.length} SPL-Tokens`);
      walletCount++;

      // Store holdings in local database
      const stored: SplTokenStoreReponse = await updateHoldings(tokenHoldingsData, publicKey.toString());
      if (!stored.success) {
        saveLogTo(actionsLogs, `⛔ Error while storing transfers for wallet ${walletName}. Reason: ${stored.msg}`);
        continue;
      }

      // Output holding changes
      if (!firstRun) {
        // Check if a holding was added
        if (stored.added.length !== 0) {
          saveLogTo(actionsLogs, `✅ ${walletName} ${walletEmoji} added ${stored.added.length} new holding(s).`);
        }
        // Check if a holding was removed
        if (stored.removed.length !== 0) {
          saveLogTo(actionsLogs, `❌ ${walletName} ${walletEmoji} removed ${stored.removed.length} holding(s).`);
        }
      }
    }

    // Output Current Walletst
    showLogs();

    firstRun = false;
  } catch (error) {
    console.error("Error:", error);
  }
}

// Logic for processing fetch holdings
const messageQueue: string[] = [];
let processing = false;
async function processQueue() {
  if (processing) return;
  processing = true;

  while (messageQueue.length > 0) {
    messageQueue.shift();
    await fetchHoldings();
  }

  processing = false;
}

async function accountSubscribeStream(): Promise<void> {
  let ws: WebSocket | null = new WebSocket(process.env.HELIUS_WSS_URI || "");
  const subscribeWallets = config.wallets;

  // Logic when websocket opens
  ws.on("open", () => {
    saveLogTo(actionsLogs, "🔓 WebSocket open. Proceeding with wallet subscriptions...");
    // Subscribe to each wallet's address
    subscribeWallets.forEach((wallet) => {
      const subscriptionMessage = {
        jsonrpc: "2.0",
        id: wallet.address, // Use the address as the ID for tracking
        method: "accountSubscribe",
        params: [
          wallet.address,
          {
            encoding: "jsonParsed",
            commitment: "",
          },
        ],
      };
      ws.send(JSON.stringify(subscriptionMessage));
    });
  });

  // Logic when websocket receives a message
  ws.on("message", async (data: WebSocket.Data) => {
    try {
      const jsonString = data.toString();
      const accountInfo: getAccountInfoStreamReponseWithConfirmation = JSON.parse(jsonString);

      // Handle subscription confirmation
      if (
        "result" in accountInfo &&
        typeof accountInfo.result === "number" &&
        accountInfo.id &&
        subscribeWallets.some((wallet) => wallet.address === accountInfo.id)
      ) {
        // Output subscription confirmation
        const getWallet = accountInfo.id;
        const wallet = subscribeWallets.find((w) => w.address === getWallet);
        saveLogTo(actionsLogs, `✅ Subscribed and listening to websocket stream for ${wallet?.emoji} ${wallet?.name}`);
        showLogs();
        return;
      }

      messageQueue.push(data.toString());
      processQueue();
    } catch (e) {
      console.error("Error processing message:", e);
    }
  });

  // Logic when websocket Has an error
  ws.on("error", (err: Error) => {
    console.error("🚫 WebSocket error:", err);
  });

  // Logic when websocket Closes
  ws.on("close", () => {
    console.log(`🔐 WebSocket closed. Trying to reconnect...`);
    setTimeout(() => accountSubscribeStream(), 5000);
  });
}

fetchHoldings()
  .then(accountSubscribeStream)
  .catch((err) => {
    console.error("Initialization error:", err.message);
    process.exit(1); // Exit if initialization fails
  });
