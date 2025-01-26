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
import { clearHoldingsTable, updateHoldings } from "./db";

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
  console.log("\n".repeat(100));
  console.clear();
  console.log(`💼 Tracked Wallets overview`);
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

  // 💼 Tracked Wallets overview
  // ================================================================================
  // Wallet0 👽 (GchN...MK4s) holds 5 SPL-Tokens
  // Wallet1 🀄️ (KEN7...WdYT) holds 265 SPL-Tokens
  // Frank 😂 (CRVi...tReL) holds 1000 SPL-Tokens
  // Profit 💰 (G5nx...7w5E) holds 784 SPL-Tokens
  // DigBen 🚀 (CKdd...GiJ9) holds 0 SPL-Tokens

  // 🔥 Duplicate holdings
  // ================================================================================
  // 📢 There are 115 more duplicates not shown.
  // 🔍 Token 9YX6...xQKW (3 💼): 👽 Open GMGN

  // 📜 Action Logs
  // ================================================================================
  // ✅ Subscribed and listening to websocket stream for 🚀 DigBen
  // ✅ Subscribed and listening to websocket stream for 💰 Profit
  // ✅ Subscribed and listening to websocket stream for 😂 Frank
  // ✅ Subscribed and listening to websocket stream for 🀄️ Wallet1
  // ✅ Subscribed and listening to websocket stream for 👽 Wallet0
  // 🔓 WebSocket open. Proceeding with wallet subscriptions...
}

// Main to fetch token holdings for provided wallets
let firstRun = true;
async function fetchHoldings(walletToSync?: string): Promise<void> {
  try {
    // Empty Database
    if (firstRun) {
      const removal = await clearHoldingsTable();
      if (!removal) console.log("🚫 Could not remove database holdings. Please remove database manually and try again.");
    }

    let wallets = SUBSCRIBE_WALLETS;
    if (walletToSync) {
      const filteredWallet = wallets.filter((w) => w.address === walletToSync);
      if (filteredWallet) wallets = filteredWallet;
    }

    for (const wallet of wallets) {
      const walletAddress = wallet.address;
      const walletName = wallet.name;
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

      // 💼 Tracked Wallets overview
      // ================================================================================
      // Wallet0 👽 (GchN...MK4s) holds 5 SPL-Tokens
      // Wallet1 🀄️ (KEN7...WdYT) holds 265 SPL-Tokens

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
        const maxRows = config.settings.show_max_duplicates || 10;
        const minHolders = config.settings.show_duplicate_min_holders || 3;
        let skippedMinHolders = 0;

        // Sort duplicates by `owners.length` in descending order
        const sortedDuplicates = doubleHoldings.duplicates.sort((a, b) => b.owners.length - a.owners.length);

        sortedDuplicates.slice(0, maxRows).forEach((d) => {
          const duplicateMint = d.mint;
          const duplicateShortMint = shortenAddress(duplicateMint);
          const duplicateOwnersLength = d.owners.length;

          // Check if minimum holders satisfies
          if (duplicateOwnersLength >= minHolders) {
            const inspectText = `\x1b]8;;${config.settings.inspect_url}${duplicateMint}\x1b\\${config.settings.inspect_name}\x1b]8;;\x1b\\`;
            saveLogTo(duplicateLogs, `🔍 Token ${duplicateShortMint} (${duplicateOwnersLength} 💼): ${inspectText}`);
          } else {
            skippedMinHolders++;
          }
        });

        // If there are more duplicates, log a message
        if (sortedDuplicates.length > maxRows) {
          saveLogTo(duplicateLogs, `📢 There are ${sortedDuplicates.length + skippedMinHolders - maxRows} more duplicates not shown.`);
        }

        // 🔥 Duplicate holdings
        // ================================================================================
        // 📢 There are 115 more duplicates not shown.
        // 🔍 Token 9YX6...xQKW (3 💼): 👽 Open GMGN
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
let wasClosed = false;
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
        if (!wasClosed) saveLogTo(actionsLogs, `✅ Subscribed and listening to websocket stream for ${wallet?.emoji} ${wallet?.name}`);
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
    wasClosed = true;
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
