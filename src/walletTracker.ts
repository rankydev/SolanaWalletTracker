import { Connection } from "@solana/web3.js";
import axios from "axios";
import { GetTokenAccountsResponse, GetWalletTokenHoldingsResponse, NewTokenTransfersDetails, SplTokenHolding } from "./types";

export async function getWalletTokenHoldings(walletAddress: string): Promise<GetWalletTokenHoldingsResponse> {
  try {
    const txUrl = process.env.HELIUS_HTTPS_URI || "";

    // Use getTokenAccounts via DAS api to get the current spl-tokens (Alternativly use getTokenAccountsByOwner method)
    const res = await axios.post<any>(txUrl, {
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccounts",
      params: {
        owner: walletAddress,
      },
    });

    // Verify if a response was received
    if (!res.data) {
      throw new Error("No holdings received");
    }

    // Store the response data in a Typescript safe const
    const tokenAccounts: GetTokenAccountsResponse = res.data.result;

    // Double verify the holdings are for this waller
    const validHoldings: SplTokenHolding[] = tokenAccounts.token_accounts.filter((acc: any) => acc.owner && acc.owner === walletAddress);
    if (!validHoldings) {
      throw new Error("No valid holdings received");
    }

    // Return data
    const returnData: GetWalletTokenHoldingsResponse = {
      data: validHoldings,
      success: true,
      msg: "success",
    };

    return returnData;
  } catch (error: any) {
    const returnData: GetWalletTokenHoldingsResponse = {
      data: [],
      success: false,
      msg: "🚫 Error fetching wallet holdings: " + error.message,
    };

    return returnData;
  }
}

// Old
export async function getTransferDetails(connection: Connection, walletAddress: string, count: number, transferId: number): Promise<any> {
  try {
    if (!connection.rpcEndpoint || !walletAddress || !count || !transferId) throw new Error("Invalid request. Missing parameters.");

    // // Get the added transfers for walletAdress
    // // const latestTransfers: SplTokenTransfer[] = await selectTokenTransfersByAddress(walletAddress, count);
    // // if (!latestTransfers || latestTransfers.length === 0) throw new Error("No valid transfers found");

    // // Loop trough transfers
    // const tokenTransfers: TokenTransferDetails[] = []; // Initialize an empty array
    // for (const transfer of latestTransfers) {
    //   const transferId = transfer.id;
    //   const tokenAddress = transfer.newTokenAccount;
    //   if (!transferId || !tokenAddress) continue;

    //   // Set empty token for this transfer
    //   let newToken: InsertNewTokenDetails;

    //   // Get the token details for this transfer
    //   const token = await selectTokenByTransferId(transferId);
    //   if (!token || token.length === 0) {
    //     // getAsset via Digital Asset Standard (DAS) API
    //     const res = await axios.post<any>(
    //       connection.rpcEndpoint,
    //       {
    //         jsonrpc: "2.0",
    //         id: "test",
    //         method: "getAsset",
    //         params: {
    //           id: tokenAddress,
    //         },
    //       },
    //       {
    //         headers: {
    //           "Content-Type": "application/json",
    //         },
    //         timeout: 10000,
    //       }
    //     );

    //     // Verify if a response was received
    //     if (!res.data) {
    //       continue;
    //     }

    //     // Extract token details
    //     const tokenDetails: dasGetAssetReponse = res.data;
    //     const tokenMetaName = tokenDetails.result.content.metadata.name || "N/A";
    //     const tokenMetaSybol = tokenDetails.result.content.metadata.symbol || "N/A";
    //     const tokenMutable = tokenDetails.result.mutable ? 1 : 0;
    //     const tokenBurnt = tokenDetails.result.burnt ? 1 : 0;

    //     // Create new token object
    //     newToken = {
    //       burnt: tokenBurnt,
    //       mint: tokenAddress,
    //       mutable: tokenMutable,
    //       name: tokenMetaName,
    //       symbol: tokenMetaSybol,
    //     };
    //   } else {
    //     // Create new token object
    //     newToken = {
    //       burnt: token[0].burnt,
    //       mint: token[0].mint,
    //       mutable: token[0].mutable,
    //       name: token[0].name,
    //       symbol: token[0].symbol,
    //     };
    //   }

    //   // push to transfers array
    //   const newTransfer: TokenTransferDetails = {
    //     transfer: transfer,
    //     token: newToken,
    //   };

    //   tokenTransfers.push(newTransfer); // Push the new object to the array
    // }

    // // Return data
    // const returnData: NewTokenTransfersDetails = {
    //   data: tokenTransfers,
    //   msg: "succes",
    //   success: true,
    // };

    // return returnData;
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
