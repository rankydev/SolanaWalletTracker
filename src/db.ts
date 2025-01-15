import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { config } from "./config";
import { InsertNewTokenDetails, SplTokenStoreReponse, SplTokenTransfer } from "./types";

// Transfers
export async function createTransfersTable(database: any): Promise<boolean> {
  try {
    await database.exec(`
        CREATE TABLE IF NOT EXISTS transfers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            signature TEXT NOT NULL UNIQUE,
            timestamp INTEGER,
            solTokenAccount TEXT NOT NULL,
            newTokenAccount TEXT NOT NULL,
            solTokenAmount INTEGER,
            newTokenAmount INTEGER,
            walletBuysToken INTEGER DEFAULT 0,
            walletPaysFee INTEGER DEFAULT 1,
            wallet TEXT NOT NULL,
            fee INTEGER
        );
      `);
    return true;
  } catch (error: any) {
    console.error("Error creating TokenData table:", error);
    return false;
  }
}
export async function insertTransfer(transfers: SplTokenTransfer[]): Promise<SplTokenStoreReponse> {
  try {
    const db = await open({
      filename: config.db.db_name_tracker_transfers,
      driver: sqlite3.Database,
    });

    // Create Table if not exists
    const transfersTableExist = await createTransfersTable(db);
    if (!transfersTableExist) {
      await db.close();
      throw new Error("Could not create transfers table.");
    }

    const placeholders = transfers.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
    const values = transfers.flatMap((transfer) => [
      transfer.signature,
      transfer.timestamp,
      transfer.newTokenAccount,
      transfer.solTokenAccount,
      transfer.newTokenAmount,
      transfer.solTokenAmount,
      transfer.walletBuysToken ? 1 : 0,
      transfer.wallet,
      transfer.fee,
      transfer.walletPaysFee ? 1 : 0,
    ]);

    const sql = `
      INSERT OR IGNORE INTO transfers (
        signature, 
        timestamp, 
        newTokenAccount, 
        solTokenAccount, 
        newTokenAmount, 
        solTokenAmount, 
        walletBuysToken, 
        wallet,
        fee, 
        walletPaysFee
      ) VALUES ${placeholders};
    `;

    const result = await db.run(sql, values, function (err: any) {
      if (err) {
        throw new Error("Could not store transfers: " + err.message);
      }
    });

    const changeCount = result.changes ? result.changes : 0;
    const lastID = result.lastID ? result.lastID : 0;

    // Return data
    const returnData: SplTokenStoreReponse = {
      count: changeCount,
      msg: "success",
      success: true,
      lastId: lastID,
    };

    await db.close();
    return returnData;
  } catch (error: any) {
    // Return data
    const returnData: SplTokenStoreReponse = {
      count: 0,
      msg: "Error: " + error.message,
      success: false,
      lastId: 0,
    };
    return returnData;
  }
}
export async function selectTokenTransferById(id: number): Promise<any> {
  const db = await open({
    filename: config.db.db_name_tracker_transfers,
    driver: sqlite3.Database,
  });

  // Create Table if not exists
  const transfersTableExist = await createTransfersTable(db);
  if (!transfersTableExist) {
    await db.close();
    throw new Error("Could not create transfers table.");
  }

  // Query the database for matching tokens
  const transfer = await db.all(
    `
    SELECT * 
    FROM transfers
    WHERE id=?;
  `,
    [id]
  );

  // Close the database
  await db.close();

  // Return the results
  return transfer;
}
export async function selectTokenTransfersByAddress(wallet: string, limit: number): Promise<SplTokenTransfer[]> {
  const db = await open({
    filename: config.db.db_name_tracker_transfers,
    driver: sqlite3.Database,
  });

  // Create Table if not exists
  const transfersTableExist = await createTransfersTable(db);
  if (!transfersTableExist) {
    await db.close();
    throw new Error("Could not create transfers table.");
  }

  // Query the database for matching tokens
  const transfers = await db.all(
    `
    SELECT * 
    FROM transfers
    WHERE wallet=? 
    ORDER BY id DESC
    LIMIT ?;
  `,
    [wallet, limit]
  );

  // Close the database
  await db.close();

  // Return the results
  return transfers;
}

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
