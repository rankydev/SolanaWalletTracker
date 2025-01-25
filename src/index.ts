import { PublicKey } from "@solana/web3.js";
import WebSocket from "ws"; // Node.js websocket library
import * as dotenv from "dotenv";
import { getDoubleHoldings, getWalletTokenHoldings } from "./walletTracker";
import {
  getAccountInfoStreamReponseWithConfirmation,
  GetWalletTokenHoldingsResponse,
  MintWithOwnersResponse,
  SplTokenHolding,
  SplTokenStoreReponse,
} from "./types";
import { config } from "./config";
import { updateHoldings } from "./db";

// Load env variables
dotenv.config();

// Get wallets
const SUBSCRIBE_WALLETS = config.wallets;

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
let duplicateLogs: string[] = [];
const holdingLogs = new Map<string, string>();
function showLogs() {
  console.clear();
  console.log(`📈 Tracked Wallets overview`);
  console.log("================================================================================");
  if (SUBSCRIBE_WALLETS.length === 0) console.log("🔎 No wallets to track at this moment: ", new Date().toISOString());
  const holdingLogsArray = Array.from(holdingLogs.entries())
    .map(([walletAddress, msg]) => msg)
    .join("\n");
  console.log(holdingLogsArray);

  // Output Duplicates
  console.log("\n\n🔥 Duplicate holdings");
  console.log("================================================================================");
  console.log(duplicateLogs.slice().reverse().join("\n"));

  // Output Action Logs
  console.log("\n\n📜 Action Logs");
  console.log("================================================================================");
  console.log(actionsLogs.slice().reverse().join("\n"));
}

// Main to fetch token holdings for provided wallets
let firstRun = true;
async function fetchHoldings(walletToSync?: string): Promise<void> {
  try {
    let wallets = SUBSCRIBE_WALLETS;
    if (walletToSync) {
      const filteredWallet = wallets.filter((w) => w.address === walletToSync);
      if (filteredWallet) wallets = filteredWallet;
    }

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
      const inspectText = `\x1b]8;;${config.settings.inspect_url_wallet}${walletAddress}\x1b\\${shortenAddress(walletAddress)}\x1b]8;;\x1b\\`;
      holdingLogs.set(walletAddress, `${wallet.name} ${walletEmoji} (${inspectText}) holds ${tokenHoldingsData.length} SPL-Tokens`);

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
          saveLogTo(actionsLogs, `👆 ${walletName} ${walletEmoji} added ${stored.added.length} new holding(s).`);
          // Display all added
          stored.added.forEach((add) => {
            const inspectText = `\x1b]8;;${config.settings.inspect_url}${add.mint}\x1b\\${config.settings.inspect_name}\x1b]8;;\x1b\\`;
            saveLogTo(actionsLogs, `✅ Check added token: ${inspectText}`);
          });
        }
        // Check if a holding was removed
        if (stored.removed.length !== 0) {
          saveLogTo(actionsLogs, `👆 ${walletName} ${walletEmoji} removed ${stored.removed.length} holding(s).`);
          // Display all removed
          stored.removed.forEach((removed) => {
            const inspectText = `\x1b]8;;${config.settings.inspect_url}${removed}\x1b\\${config.settings.inspect_name}\x1b]8;;\x1b\\`;
            saveLogTo(actionsLogs, `❌ Check removed token: ${inspectText}`);
          });
        }
      }

      // Check for double holdings
      duplicateLogs.length = 0;
      const doubleHoldings: MintWithOwnersResponse = await getDoubleHoldings();
      if (!doubleHoldings.success) {
        saveLogTo(actionsLogs, `⛔ Error while checking duplicates: ${doubleHoldings.msg}`);
        continue;
      }

      // Output double holdings if exists
      if (doubleHoldings.duplicates.length !== 0) {
        doubleHoldings.duplicates.forEach((d) => {
          const duplicateMin = d.mint;
          const duplicateOwnersLength = d.owners.length;

          const inspectText = `\x1b]8;;${config.settings.inspect_url}${duplicateMin}\x1b\\${config.settings.inspect_name}\x1b]8;;\x1b\\`;
          saveLogTo(duplicateLogs, `🔍 Check duplicate token held by ${duplicateOwnersLength} wallets: ${inspectText}`);
        });
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
    const processedMessage = messageQueue.shift();
    if (processedMessage) {
      const processedMessageObject = Number(processedMessage);

      // Update Holdings
      if (subscriptions.has(processedMessageObject)) {
        const walletAddress = subscriptions.get(processedMessageObject);
        if (walletAddress) {
          const wallet = SUBSCRIBE_WALLETS.find((w) => w.address === walletAddress);
          await fetchHoldings(wallet?.address);
        } else {
          await fetchHoldings();
        }
      }
    }
  }

  processing = false;
}

// Subscription Stream
const subscriptions = new Map<number, string>();
async function accountSubscribeStream(): Promise<void> {
  let ws: WebSocket | null = new WebSocket(process.env.HELIUS_WSS_URI || "");

  // Logic when websocket opens
  ws.on("open", () => {
    saveLogTo(actionsLogs, "🔓 WebSocket open. Proceeding with wallet subscriptions...");
    // Subscribe to each wallet's address
    SUBSCRIBE_WALLETS.forEach((wallet) => {
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
        SUBSCRIBE_WALLETS.some((wallet) => wallet.address === accountInfo.id)
      ) {
        // Output subscription confirmation
        const getWallet = accountInfo.id;
        const subscriptionId = accountInfo.result;
        const wallet = SUBSCRIBE_WALLETS.find((w) => w.address === getWallet);
        saveLogTo(actionsLogs, `✅ Subscribed and listening to websocket stream for ${wallet?.emoji} ${wallet?.name}`);
        // Store subscription for wallet
        subscriptions.set(subscriptionId, getWallet);
        showLogs();
        return;
      }

      messageQueue.push(accountInfo.params.subscription.toString());
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
  let retryCount = 0;
  const maxRetries = 5;
  ws.on("close", () => {
    console.log(`🔐 WebSocket closed. Reconnecting in ${2 ** retryCount}s...`);
    if (retryCount < maxRetries) {
      setTimeout(() => {
        accountSubscribeStream();
        retryCount++;
      }, 2 ** retryCount * 1000);
    } else {
      console.error("Max retries reached. Exiting...");
      process.exit(1);
    }
  });
}

fetchHoldings()
  .then(accountSubscribeStream)
  .catch((err) => {
    console.error("Initialization error:", err.message);
    process.exit(1); // Exit if initialization fails
  });
