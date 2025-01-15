import { Connection, PublicKey } from "@solana/web3.js";
import axios from "axios";
import {
  dasGetAssetReponse,
  InsertNewTokenDetails,
  NewTokenTransfersDetails,
  SplTokenTransfer,
  SplTokenTransferReponse,
  TokenTransferDetails,
  TransactionDetailsResponse,
} from "./types";
import { config } from "./config";
import { selectTokenByTransferId, selectTokenTransferById, selectTokenTransfersByAddress } from "./db";

export async function getWalletTokenTransfers(connection: Connection, walletAddress: string, limit: number): Promise<SplTokenTransferReponse> {
  try {
    const txUrl = process.env.HELIUS_HTTPS_URI_TX || "";

    // Get PubKey from wallet address
    const publicKey = new PublicKey(walletAddress);

    // Get the signatures related to this wallet
    const signatures = await connection.getSignaturesForAddress(publicKey, { limit: limit }, "confirmed");
    if (!signatures) {
      throw new Error("No signatures received");
    }

    // Get signatures without error
    const validSignatures = signatures.filter((sg) => sg.err === null).map((sg) => sg.signature);
    if (!validSignatures) {
      throw new Error("No valid signatures received");
    }

    // Use Helius Transaction API instead of getParsedTransactions
    const res = await axios.post<any>(
      txUrl,
      {
        transactions: validSignatures,
        commitment: "finalized",
        encoding: "jsonParsed",
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    // Verify if a response was received
    if (!res.data) {
      throw new Error("No transactions received");
    }

    // Verify if the response was in the correct format and not empty
    if (!Array.isArray(res.data) || res.data.length === 0) {
      throw new Error("Response data array is empty");
    }

    // Access the `data` property which contains the array of transactions
    const transactionsReponse: TransactionDetailsResponse[] = res.data;

    // Get token transfer transactions
    const validTransactions = transactionsReponse.filter((tx: any) => tx.tokenTransfers && tx.tokenTransfers.length !== 0);
    if (!validTransactions) {
      throw new Error("No valid transactions received");
    }

    // Loop trough transactions and extract mints
    const SplTokenTransfers: SplTokenTransfer[] = [];

    validTransactions.forEach((tx) => {
      // Skip transactions that are not a swap
      if (tx.tokenTransfers.length !== 2) return;

      const signature = tx.signature;
      const feeAmount = tx.fee;
      const feePayer = tx.feePayer;
      const timestamp = tx.timestamp;
      const mintOne = tx.tokenTransfers[0].mint;
      const mintTwo = tx.tokenTransfers[1].mint;
      const amountOne = tx.tokenTransfers[0].tokenAmount;
      const amountTwo = tx.tokenTransfers[1].tokenAmount;
      const fromUserAccountOne = tx.tokenTransfers[0].fromUserAccount;
      const toUserAccountOne = tx.tokenTransfers[0].toUserAccount;

      let solTokenAccount = "";
      let newTokenAccount = "";
      let solTokenAmount = 0; // 0.99
      let newTokenAmount = 0; // 3156328.409605
      let walletBuysToken = false;
      let walletPaysFee = feePayer === walletAddress ? true : false;
      if (mintOne === config.settings.wsol_pc_mint) {
        // Sol
        solTokenAccount = mintOne;
        solTokenAmount = amountOne;
        // Token
        newTokenAccount = mintTwo;
        newTokenAmount = amountTwo;
        // Direction
        walletBuysToken = fromUserAccountOne === walletAddress && toUserAccountOne !== walletAddress;
      } else {
        // Sol
        solTokenAccount = mintTwo;
        solTokenAmount = amountTwo;
        // Token
        newTokenAccount = mintOne;
        newTokenAmount = amountOne;
      }

      // Add to array
      if (solTokenAccount && newTokenAccount && solTokenAmount && newTokenAmount && timestamp) {
        SplTokenTransfers.push({
          signature: signature,
          timestamp: timestamp,
          newTokenAccount: newTokenAccount,
          solTokenAccount: solTokenAccount,
          newTokenAmount: newTokenAmount,
          solTokenAmount: solTokenAmount,
          walletBuysToken: walletBuysToken,
          fee: feeAmount,
          wallet: walletAddress,
          walletPaysFee: walletPaysFee,
        });
      }
    });

    // Return data
    const returnData: SplTokenTransferReponse = {
      data: SplTokenTransfers,
      success: true,
      msg: "success",
    };

    return returnData;
  } catch (error: any) {
    const returnData: SplTokenTransferReponse = {
      data: [],
      success: false,
      msg: "🚫 Error fetching wallet transfers: " + error.message,
    };

    return returnData;
  }
}

export async function getTransferDetails(connection: Connection, walletAddress: string, count: number, transferId: number): Promise<any> {
  try {
    if (!connection.rpcEndpoint || !walletAddress || !count || !transferId) throw new Error("Invalid request. Missing parameters.");

    // Get the added transfers for walletAdress
    const latestTransfers: SplTokenTransfer[] = await selectTokenTransfersByAddress(walletAddress, count);
    if (!latestTransfers || latestTransfers.length === 0) throw new Error("No valid transfers found");

    // Loop trough transfers
    const tokenTransfers: TokenTransferDetails[] = []; // Initialize an empty array
    for (const transfer of latestTransfers) {
      const transferId = transfer.id;
      const tokenAddress = transfer.newTokenAccount;
      if (!transferId || !tokenAddress) continue;

      // Set empty token for this transfer
      let newToken: InsertNewTokenDetails;

      // Get the token details for this transfer
      const token = await selectTokenByTransferId(transferId);
      if (!token || token.length === 0) {
        // getAsset via Digital Asset Standard (DAS) API
        const res = await axios.post<any>(
          connection.rpcEndpoint,
          {
            jsonrpc: "2.0",
            id: "test",
            method: "getAsset",
            params: {
              id: tokenAddress,
            },
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
            timeout: 10000,
          }
        );

        // Verify if a response was received
        if (!res.data) {
          continue;
        }

        // Extract token details
        const tokenDetails: dasGetAssetReponse = res.data;
        const tokenMetaName = tokenDetails.result.content.metadata.name || "N/A";
        const tokenMetaSybol = tokenDetails.result.content.metadata.symbol || "N/A";
        const tokenMutable = tokenDetails.result.mutable ? 1 : 0;
        const tokenBurnt = tokenDetails.result.burnt ? 1 : 0;

        // Create new token object
        newToken = {
          burnt: tokenBurnt,
          mint: tokenAddress,
          mutable: tokenMutable,
          name: tokenMetaName,
          symbol: tokenMetaSybol,
        };
      } else {
        // Create new token object
        newToken = {
          burnt: token[0].burnt,
          mint: token[0].mint,
          mutable: token[0].mutable,
          name: token[0].name,
          symbol: token[0].symbol,
        };
      }

      // push to transfers array
      const newTransfer: TokenTransferDetails = {
        transfer: transfer,
        token: newToken,
      };

      tokenTransfers.push(newTransfer); // Push the new object to the array
    }

    // Return data
    const returnData: NewTokenTransfersDetails = {
      data: tokenTransfers,
      msg: "succes",
      success: true,
    };

    return returnData;
  } catch (error: any) {
    // Return error
    const returnData: NewTokenTransfersDetails = {
      data: [],
      msg: error.message,
      success: false,
    };
    return returnData;
  }
}
