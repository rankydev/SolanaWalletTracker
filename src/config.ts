export const config = {
  settings: {
    wsol_pc_mint: "So11111111111111111111111111111111111111112",
    transfer_limit: 5,
    first_run_transfer_limit: 100,
    tracker_timeout: 1000, // 1 second
    inspect_url: "https://gmgn.ai/sol/token/",
    inspect_name: "👽 Open GMGN",
  },
  db: {
    db_name_tracker_transfers: "src/db/transfers.db", // Sqlite Database location
  },
  wallets: [
    {
      name: "Wallet1",
      walletAddress: "FZThdwscxuktS6mpmFGvPF2opVFn5NA9CrCeRZb81LFj",
    },
    {
      name: "Test2",
      walletAddress: "E5KamPxP9T6vY1ZpqJj9pu7XSgTCEe3wX1UWDDNgeHjv",
    },
  ],
};
