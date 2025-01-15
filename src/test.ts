// Tests
import { Connection } from "@solana/web3.js";
import { getWalletTokenTransfers } from "./walletTracker";
import { selectTokenByTransferId } from "./db";
import * as dotenv from "dotenv";

dotenv.config();

(async () => {
  const walletAddress = null;
  if (walletAddress) {
    const connection = new Connection(process.env.HELIUS_HTTPS_URI!, "confirmed");
    const tx = await getWalletTokenTransfers(connection, walletAddress, 30);
    console.log(tx);
  }
})();

(async () => {
  const id = null;
  if (id) {
    const tx = await selectTokenByTransferId(id);
    console.log(tx);
  }
})();
