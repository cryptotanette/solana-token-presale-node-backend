require("dotenv").config();
const transferSPLtoken = require("./utils/transfer");

const { Connection, clusterApiUrl, PublicKey } = require("@solana/web3.js");

const WALLET_ADDRESS = "JBEoBW3fbf7KctNMCJ3QZPRy8yUPzaDr2GkMHNw9uMJ6";
const walletPublicKey = new PublicKey(WALLET_ADDRESS);

const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");

async function listenForTransactions() {
  let latestLoggedBalance = await connection.getBalance(walletPublicKey);
  console.log(
    `Listening for transactions to wallet: ${WALLET_ADDRESS} - ${latestLoggedBalance}`
  );

  const subscriptionId = connection.onAccountChange(
    walletPublicKey,
    async (accountInfo) => {
      const newBalance = accountInfo.lamports;
      const sendBalance = newBalance - latestLoggedBalance;
      console.log(
        `Account ${WALLET_ADDRESS} received ${sendBalance / 1e9} SOL`
      );
      // latestLoggedBalance = newBalance;
      
      try {
        const sourceWallet = await fetchTransactionDetails(walletPublicKey);
        const txid = await transferSPLtoken(sourceWallet);

        return txid;
      } catch (error) {
        return error;
      }

    }
  );

  // connection.removeAccountChangeListener(subscriptionId);
}

async function fetchTransactionDetails(publicKey) {
  try {
    const transactionSignatures =
      await connection.getConfirmedSignaturesForAddress2(publicKey, {
        limit: 1,
      });
    if (transactionSignatures.length > 0) {
      const transactionDetails = await connection.getConfirmedTransaction(
        transactionSignatures[0].signature
      );
      return transactionDetails.transaction.feePayer;
    }
  } catch (error) {
    console.error("Error fetching transaction details:", error);
    throw(error);
  }
}
listenForTransactions();
