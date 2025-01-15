import { Connection } from "@solana/web3.js";
import * as dotenv from "dotenv";
import { getTransferDetails, getWalletTokenTransfers } from "./walletTracker";
import { NewTokenTransfersDetails, SplTokenStoreReponse, SplTokenTransferReponse } from "./types";
import { config } from "./config";
import { insertTransfer } from "./db";
import { DateTime } from "luxon";

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

// Create Action Log constant
const actionsLogs: string[] = [];

// Initialize Connection
const connection = new Connection(process.env.HELIUS_HTTPS_URI!, "confirmed");
async function initializeConnection(): Promise<void> {
  try {
    const version = await connection.getVersion();
    console.log(`✅ Connected to Solana! Node Version: ${version["solana-core"]}`);
  } catch (error) {
    console.error("Failed to connect to Solana:", error);
    process.exit(1); // Exit the app if the connection fails
  }
}

// Main to fetch token transfers for provided wallets
let firstRun = true;
async function main(): Promise<void> {
  let transferLimit = config.settings.transfer_limit || 5;
  if (firstRun) {
    transferLimit = config.settings.first_run_transfer_limit || 30;
  }

  try {
    const transfersLogs: string[] = [];

    const wallets = config.wallets;
    let walletCount = 1;
    for (const wallet of wallets) {
      const walletAddress = wallet.walletAddress;
      const walletName = wallet.name;

      // @TODO, verify if actuall address
      // @TODO, get actual wallet stats like PnL...

      //Get the current price
      saveLogTo(transfersLogs, `🏆 ${walletCount}. ${wallet.name} (${shortenAddress(wallet.walletAddress)}) | PnL: 0.0%`);
      walletCount++;

      // Get token transfers for wallet
      const tokenTransfers: SplTokenTransferReponse = await getWalletTokenTransfers(connection, walletAddress, transferLimit);

      // Check if fetching the transfers was successfull
      if (!tokenTransfers.success) {
        console.log(tokenTransfers.msg);
      }

      // Check if we received transfers
      if (tokenTransfers.data.length === 0) continue;

      // Store transfers in local database
      const stored: SplTokenStoreReponse = await insertTransfer(tokenTransfers.data);
      if (!stored.success) {
        saveLogTo(actionsLogs, `⛔ Error while storing transfers for wallet ${walletName}. Reason: ${stored.msg}`);
        continue;
      }

      // Check if transfers were added
      if (stored.count !== 0 && stored.lastId) {
        // Do not show new transfers when runnin initial transfers lookup
        if (!firstRun) {
          // Get new token information
          const newTokenTransferDetails: NewTokenTransfersDetails = await getTransferDetails(connection, walletAddress, stored.count, stored.lastId);
          if (!newTokenTransferDetails.success) {
            saveLogTo(actionsLogs, `⛔ Error while fetching new transfers for wallet ${walletName}. Reason: ${newTokenTransferDetails.msg}`);
            continue;
          }

          const transfers = newTokenTransferDetails.data;

          // Add to action logs
          if (transfers && transfers.length !== 0) {
            transfers.forEach((transfer) => {
              const transferDirection = transfer.transfer.walletBuysToken ? "🟢 Buy" : "🔴 Sell";
              const transferToken = transfer.token.name;
              const transferMint = transfer.token.mint;
              const transferSymbol = transfer.token.symbol;
              const transferTime = transfer.transfer.timestamp;
              const transferSol = transfer.transfer.solTokenAmount;
              const transferInvertSol = transfer.transfer.newTokenAmount;
              const tokenBurnt = transfer.token.burnt === 1 ? "🔥" : "💧";
              const tokenMutable = transfer.token.mutable === 1 ? "🔒" : "🔓";

              // Conver Trade Time
              const centralEuropenTime = DateTime.fromSeconds(transferTime).toLocal();
              const hrTradeTime = centralEuropenTime.toFormat("HH:mm:ss");

              // Get inspect attibutes
              const inspectUrl = config.settings.inspect_url + transferMint;
              const inspectName = config.settings.inspect_name;
              const inspectText = "\x1b]8;;" + inspectUrl + "\x1b\\" + inspectName + "\x1b]8;;\x1b\\";

              saveLogTo(
                actionsLogs,
                `${hrTradeTime} ${transferDirection} | ${walletName} | ${tokenBurnt}${tokenMutable} ${transferInvertSol} ${transferToken} (${transferSymbol}) for ${transferSol} SOL | ${inspectText}`
              );
            });
          }
        }

        // Add to action logs
        if (firstRun) saveLogTo(actionsLogs, `✅ ${stored.count} transfer(s) were successfully added to wallet: ${walletName}`);
      }
    }

    // Output Current Walletst
    console.clear();
    console.log(`📈 Tracked Wallets overview`);
    console.log("================================================================================");
    if (wallets.length === 0) console.log("🔎 No wallets to track at this moment: ", new Date().toISOString());
    console.log(transfersLogs.join("\n"));

    // Output Action Logs
    console.log("\n\n📜 Action Logs");
    console.log("================================================================================");
    console.log(actionsLogs.slice().reverse().join("\n"));

    firstRun = false;
    setTimeout(main, config.settings.tracker_timeout);
  } catch (error) {
    console.error("Error:", error);
  }
}

initializeConnection()
  .then(main)
  .catch((err) => {
    console.error("Initialization error:", err.message);
    process.exit(1); // Exit if initialization fails
  });
