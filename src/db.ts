import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { config } from "./config";
import { InsertNewTokenDetails, SplTokenHolding, SplTokenStoreReponse, SplTokenTransfer } from "./types";

// Tokens
export async function createTableNewTokens(database: any): Promise<boolean> {
  try {
    await database.exec(`
    CREATE TABLE IF NOT EXISTS tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mint TEXT NOT NULL,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      mutable TEXT NOT NULL,
      burnt TEXT NOT NULL
    );
  `);
    return true;
  } catch (error: any) {
    return false;
  }
}
export async function selectTokenByTransferId(id: number): Promise<InsertNewTokenDetails[]> {
  const db = await open({
    filename: config.db.db_name_tracker_transfers,
    driver: sqlite3.Database,
  });

  // Create Table if not exists
  const newTokensTableExist = await createTableNewTokens(db);
  if (!newTokensTableExist) {
    await db.close();
    throw new Error("Could not create tokens table.");
  }

  // Query the database for matching tokens
  const token = await db.all(
    `
    SELECT * 
    FROM tokens
    WHERE mint IN (SELECT newTokenAccount FROM transfers WHERE id=?);
  `,
    [id]
  );

  // Close the database
  await db.close();

  // Return the results
  return token;
}
export async function insertNewToken(newToken: InsertNewTokenDetails) {
  const db = await open({
    filename: config.db.db_name_tracker_transfers,
    driver: sqlite3.Database,
  });

  // Create Table if not exists
  const newTokensTableExist = await createTableNewTokens(db);
  if (!newTokensTableExist) {
    await db.close();
    throw new Error("Could not create tokens table.");
  }

  // Proceed with adding holding
  if (newTokensTableExist) {
    const { mint, burnt, mutable, name, symbol } = newToken;

    await db.run(
      `
    INSERT INTO tokens (mint, name, symbol, mutable, burnt)
    VALUES (?, ?, ?, ?, ?);
  `,
      [mint, name, symbol, mutable, burnt]
    );

    await db.close();
  }
}

// New
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
