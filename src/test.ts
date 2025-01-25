import { checkMultipleOwnersForMint } from "./db";
import { getDoubleHoldings } from "./walletTracker";

// Tests
(async () => {
  const run = false;
  if (run) {
    const dups = await checkMultipleOwnersForMint();
    console.log(dups);
  }
})();

(async () => {
  const run = false;
  if (run) {
    const dups = await getDoubleHoldings();
    console.log(dups);
  }
})();
