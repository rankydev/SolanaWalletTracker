import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { config } from "./config";
import { DuplicateOwnerMintRecord, SplTokenHolding, SplTokenStoreReponse } from "./types";

// Holdings
export async function createHoldingsTable(database: any): Promise<boolean> {
  try {
    await database.exec(`
        CREATE TABLE IF NOT EXISTS holdings (
            address TEXT NOT NULL PRIMARY KEY UNIQUE,
            mint TEXT NOT NULL,
            owner TEXT NOT NULL,
            amount INTEGER,
            delegated_amount INTEGER,
            frozen INTEGER DEFAULT 0
        );
      `);

    return true;
  } catch (error: any) {
    console.error("Error creating TokenData table:", error);
    return false;
  }
}
export async function updateHoldings(holdings: SplTokenHolding[], walletAddress: string): Promise<SplTokenStoreReponse> {
  try {
    const db = await open({
      filename: config.db.db_name_tracker_transfers,
      driver: sqlite3.Database,
    });

    // Create Table if not exists
    const transfersTableExist = await createHoldingsTable(db);
    if (!transfersTableExist) {
      await db.close();
      throw new Error("Could not create transfers table.");
    }

    // Get current tokens from the database
    const currentTokens = await db.all<{ address: string }[]>(`SELECT address FROM holdings WHERE owner="${walletAddress}"`);
    const currentAddresses = new Set(currentTokens.map((row) => row.address));

    // Extract incoming addresses
    const incomingAddresses = new Set(holdings.map((holding) => holding.address));

    // Find added and removed holdings
    const addedTokens = holdings.filter((holding) => !currentAddresses.has(holding.address));
    const removedTokens = Array.from(currentAddresses).filter((address) => !incomingAddresses.has(address));

    // Remove tokens no longer present in the incoming array
    if (removedTokens.length > 0) {
      const placeholders = removedTokens.map(() => "?").join(",");
      await db.run(`DELETE FROM holdings WHERE owner="${walletAddress}" AND address IN (${placeholders})`, ...removedTokens);
    }

    // Insert or update incoming tokens
    const upsertStatement = `
      INSERT INTO holdings (address, mint, owner, amount, delegated_amount, frozen)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(address) DO UPDATE SET
        mint = excluded.mint,
        owner = excluded.owner,
        amount = excluded.amount,
        delegated_amount = excluded.delegated_amount,
        frozen = excluded.frozen
    `;

    for (const token of holdings) {
      await db.run(upsertStatement, token.address, token.mint, token.owner, token.amount, token.delegated_amount, token.frozen);
    }

    // Close the database connection
    await db.close();

    // Return data
    const returnData: SplTokenStoreReponse = {
      added: addedTokens,
      removed: removedTokens,
      msg: "success",
      success: true,
    };

    return returnData;
  } catch (error: any) {
    // Return data
    const returnData: SplTokenStoreReponse = {
      added: [],
      removed: [],
      msg: "Error: " + error.message,
      success: false,
    };
    return returnData;
  }
}
export async function checkMultipleOwnersForMint(): Promise<DuplicateOwnerMintRecord[]> {
  const db = await open({
    filename: config.db.db_name_tracker_transfers,
    driver: sqlite3.Database,
  });

  // Create Table if not exists
  const transfersTableExist = await createHoldingsTable(db);
  if (!transfersTableExist) {
    await db.close();
    throw new Error("Could not create transfers table.");
  }

  try {
    const query = `
      SELECT mint, owner
      FROM holdings
      WHERE mint IN (
        SELECT mint
        FROM holdings
        GROUP BY mint
        HAVING COUNT(DISTINCT owner) >= 2
      )
    `;

    const rows = await db.all(query);

    // If there are rows with multiple owners for the same mint, return them
    if (rows.length > 0) {
      return rows; // Rows will contain mint and owner
    }

    return []; // No mints with 2 or more owners
  } catch (error: any) {
    console.error("Error checking multiple owners for mint:", error);
    return [];
  }
}
export async function clearHoldingsTable(): Promise<boolean> {
  try {
    const db = await open({
      filename: config.db.db_name_tracker_transfers,
      driver: sqlite3.Database,
    });

    // Create Table if not exists
    const transfersTableExist = await createHoldingsTable(db);
    if (!transfersTableExist) {
      await db.close();
      throw new Error("Could not create transfers table.");
    }

    await db.exec(`
        DELETE FROM holdings;
    `);

    return true;
  } catch (error: any) {
    console.error("Error clearing the holdings table:", error);
    return false;
  }
}
