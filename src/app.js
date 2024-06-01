require("dotenv").config();
const transferSPLtoken = require("./utils/transfer");

const { Connection, clusterApiUrl, PublicKey } = require("@solana/web3.js");

const WALLET_ADDRESS = process.env.PUBLIC_KEY;
const TOKEN_ACCOUNT_ADDRESS = process.env.TOKEN_ACCOUNT_ADDRESS;
const walletPublicKey = new PublicKey(WALLET_ADDRESS);
const tokenAccountPublicKey = new PublicKey(TOKEN_ACCOUNT_ADDRESS);

const MAIN_PRICE = 0.0000101471;
const startTime = new Date("6/1/24").getTime();

function getPrice() {
  let price = MAIN_PRICE;
  const now = new Date().getTime();
  console.log("now time: ", now);
  let offset = Math.floor((now - startTime) / 86400 / 1000);
  console.log("offset: ", offset);
  while (offset >= 3) {
    price = price + price * 0.1;
    offset -= 3;
  }
  console.log("current price", price);
  return price;
}

const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");

async function listenForTransactions() {
  let latestLoggedBalance = await connection.getBalance(walletPublicKey);
  let latestLoggedTokenBalance = await getTokenAccountBalanceWithNumber(tokenAccountPublicKey);
  console.log(
    `Now token balance: ${latestLoggedTokenBalance}`
  );

  console.log(
    `Listening for transactions to wallet: ${WALLET_ADDRESS} - ${latestLoggedBalance}`
  );

  const subscriptionId = connection.onAccountChange(
    walletPublicKey,
    async (accountInfo) => {
      const newBalance = accountInfo.lamports;
      const sendBalance = (newBalance - latestLoggedBalance) / 1e9;
      latestLoggedBalance = newBalance;
      if (sendBalance > 0) {
        console.log(
          `Account ${WALLET_ADDRESS} received ${sendBalance} SOL`
        );  
      } else {
        console.log(
          `Account ${WALLET_ADDRESS} send ${sendBalance} SOL`
        );
        return;
      }
      

      try {
        const sourceWallet = await fetchTransactionDetails(walletPublicKey);
        
        const price = getPrice();
        const amount = Math.floor(sendBalance / price);
        console.log("token amount: ", amount);
        
        const txid = await transferSPLtoken(sourceWallet, amount);

        return txid;
      } catch (error) {
        console.log("error: ", error);
        return error;
      }
    }
  );

  // connection.removeAccountChangeListener(subscriptionId);
}

async function getTokenAccountBalanceWithNumber(tokenPublicKey){
  const {amount, decimals} = (await connection.getTokenAccountBalance(tokenPublicKey)).value;
  return Math.floor(amount / (10 ** decimals));
}
async function fetchTransactionDetails(publicKey) {
  try {
    const transactionSignatures =
      await connection.getConfirmedSignaturesForAddress2(publicKey, {
        limit: 1,
      });
    if (transactionSignatures.length > 0) {
      const transactionDetails = await connection.getParsedTransaction(
        transactionSignatures[0].signature
      );
      return transactionDetails.transaction.message.accountKeys[0].pubkey;
    }
  } catch (error) {
    console.error("Error fetching transaction details:", error);
    throw error;
  }
}

listenForTransactions();
