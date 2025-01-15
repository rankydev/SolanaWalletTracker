export interface TransactionDetailsResponse {
  description: string;
  type: string;
  source: string;
  fee: number;
  feePayer: string;
  signature: string;
  slot: number;
  timestamp: number;
  tokenTransfers: {
    fromTokenAccount: string;
    toTokenAccount: string;
    fromUserAccount: string;
    toUserAccount: string;
    tokenAmount: number;
    mint: string;
    tokenStandard: string;
  }[];
  nativeTransfers: {
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }[];
  accountData: {
    account: string;
    nativeBalanceChange: number;
    tokenBalanceChanges: {
      userAccount: string;
      tokenAccount: string;
      rawTokenAmount: {
        tokenAmount: string;
        decimals: number;
      };
      mint: string;
    }[];
  }[];
  transactionError: string | null;
  instructions: {
    accounts: string[];
    data: string;
    programId: string;
    innerInstructions: {
      accounts: string[];
      data: string;
      programId: string;
    }[];
  }[];
  events: {
    swap: {
      nativeInput: {
        account: string;
        amount: string;
      } | null;
      nativeOutput: {
        account: string;
        amount: string;
      } | null;
      tokenInputs: {
        userAccount: string;
        tokenAccount: string;
        rawTokenAmount: {
          tokenAmount: string;
          decimals: number;
        };
        mint: string;
      }[];
      tokenOutputs: {
        userAccount: string;
        tokenAccount: string;
        rawTokenAmount: {
          tokenAmount: string;
          decimals: number;
        };
        mint: string;
      }[];
      nativeFees: {
        account: string;
        amount: string;
      }[];
      tokenFees: {
        userAccount: string;
        tokenAccount: string;
        rawTokenAmount: {
          tokenAmount: string;
          decimals: number;
        };
        mint: string;
      }[];
      innerSwaps: {
        tokenInputs: {
          fromTokenAccount: string;
          toTokenAccount: string;
          fromUserAccount: string;
          toUserAccount: string;
          tokenAmount: number;
          mint: string;
          tokenStandard: string;
        }[];
        tokenOutputs: {
          fromTokenAccount: string;
          toTokenAccount: string;
          fromUserAccount: string;
          toUserAccount: string;
          tokenAmount: number;
          mint: string;
          tokenStandard: string;
        }[];
        tokenFees: {
          userAccount: string;
          tokenAccount: string;
          rawTokenAmount: {
            tokenAmount: string;
            decimals: number;
          };
          mint: string;
        }[];
        nativeFees: {
          account: string;
          amount: string;
        }[];
        programInfo: {
          source: string;
          account: string;
          programName: string;
          instructionName: string;
        };
      }[];
    };
  };
}

export interface SplTokenTransfer {
  id?: number;
  signature: string;
  timestamp: number;
  solTokenAccount: string;
  newTokenAccount: string;
  solTokenAmount: number;
  newTokenAmount: number;
  walletBuysToken: boolean;
  walletPaysFee: boolean;
  wallet: string;
  fee: number;
}

export interface SplTokenTransferReponse {
  data: SplTokenTransfer[];
  success: boolean;
  msg: string;
}

export interface SplTokenStoreReponse {
  success: boolean;
  count: number;
  lastId: number;
  msg: string;
}

export interface NewTokenTransfersDetails {
  data: TokenTransferDetails[];
  success: boolean;
  msg: string;
}

export interface dasGetAssetReponse {
  jsonrpc: string;
  result: {
    interface: string;
    id: string;
    content: {
      $schema: string;
      json_uri: string;
      files: Array<{
        uri: string;
        cdn_uri: string;
        mime: string;
      }>;
      metadata: {
        description: string;
        name: string;
        symbol: string;
        token_standard: string;
      };
      links: {
        image: string;
      };
    };
    authorities: Array<{
      address: string;
      scopes: string[];
    }>;
    compression: {
      eligible: boolean;
      compressed: boolean;
      data_hash: string;
      creator_hash: string;
      asset_hash: string;
      tree: string;
      seq: number;
      leaf_id: number;
    };
    grouping: any[];
    royalty: {
      royalty_model: string;
      target: string | null;
      percent: number;
      basis_points: number;
      primary_sale_happened: boolean;
      locked: boolean;
    };
    creators: any[];
    ownership: {
      frozen: boolean;
      delegated: boolean;
      delegate: string | null;
      ownership_model: string;
      owner: string;
    };
    supply: number | null;
    mutable: boolean;
    burnt: boolean;
    token_info: {
      symbol: string;
      supply: number;
      decimals: number;
      token_program: string;
      price_info: {
        price_per_token: number;
        currency: string;
      };
    };
  };
  id: string;
}

export interface InsertNewTokenDetails {
  id?: number;
  mint: string;
  name: string;
  symbol: string;
  mutable: number;
  burnt: number;
}

export interface TokenTransferDetails {
  transfer: SplTokenTransfer;
  token: InsertNewTokenDetails;
}
