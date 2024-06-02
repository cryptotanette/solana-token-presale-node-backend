require("dotenv").config();
const transferSPLtoken = require("./utils/transfer");

const { Connection, clusterApiUrl, PublicKey } = require("@solana/web3.js");

async function presaleStart() {
  const start = new Date(process.env.PRESALE_START).getTime();
  console.log("Start presale: ", new Date(start));

  const connection = initializeConnection();

  const now = new Date().getTime();
  const cycle = getPresaleCycle(start, now);

  if (cycle >= process.env.PRESALE_MAX_CYCLE) {
    console.log("End presale!");
    return;
  }

  const tokenAccountPublicKey = new PublicKey(
    process.env.TOKEN_ACCOUNT_ADDRESS
  );
  const avaliableTokenBalanceForPresale = getAvaliableTokenBalanceForPresale(
    tokenAccountPublicKey,
    connection);
  console.log(`Presale now: cycle ${cycle}`);

  const walletPublicKey = new PublicKey(process.env.PUBLIC_KEY);
  listenForTransactions(walletPublicKey, connection);
}

function getPrice() {
  let price = MAIN_PRICE;
  const now = new Date().getTime();
  console.log("now time: ", now);
  let offset = Math.floor((now - PRESALE_START) / 86400 / 1000 / 3);
  console.log("offset: ", offset);
  price = price * 1.1 ** offset;

  console.log("current price", price);
  return price;
}

// const connection = new Connection(process.env.RPC, "confirmed");
// Sets up the connection to the Solana cluster, utilizing environment variables for configuration.
function initializeConnection() {
  const rpcUrl = process.env.RPC;
  const connection = new Connection(rpcUrl, {
    commitment: "confirmed",
    // wsEndpoint: process.env.SOLANA_WSS,
  });
  // Redacting part of the RPC URL for security/log clarity
  console.log(`Initialized Connection to Solana RPC: ${rpcUrl.slice(0, -32)}`);
  return connection;
}

// Initializes a Keypair from the secret key stored in environment variables. Essential for signing transactions.
function initializeKeypair() {
  const privateKey = new Uint8Array(bs58.decode(process.env.PRIVATE_KEY));
  const keypair = Keypair.fromSecretKey(privateKey);
  console.log(
    `Initialized Keypair: Public Key - ${keypair.publicKey.toString()}`
  );
  return keypair;
}

async function listenForTransactions(walletPublicKey, connection) {
  let latestLoggedBalance = await connection.getBalance(walletPublicKey);
  console.log(
    `Listening for transactions to wallet: ${walletPublicKey.toString()}(${
      latestLoggedBalance / 1e9
    } SOL)`
  );

  const tokenAccountPublicKey = new PublicKey(
    process.env.TOKEN_ACCOUNT_ADDRESS
  );
  let latestLoggedTokenBalance = await getAvaliableTokenBalanceForPresale(
    tokenAccountPublicKey,
    connection
  );
  // console.log(`Now token balance: ${latestLoggedTokenBalance}`);

  const subscriptionId = connection.onAccountChange(
    walletPublicKey,
    async (accountInfo) => {
      const newBalance = accountInfo.lamports;
      const sendBalance = (newBalance - latestLoggedBalance) / 1e9;
      latestLoggedBalance = newBalance;
      if (sendBalance > 0) {
        console.log(
          `Account ${walletPublicKey.toString()} received ${sendBalance} SOL`
        );
      } else {
        console.log(
          `Account ${walletPublicKey.toString()} send ${sendBalance} SOL`
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

async function getAvaliableTokenBalanceForPresale(tokenPublicKey, connection) {
  const { amount, decimals } = (
    await connection.getTokenAccountBalance(tokenPublicKey)
  ).value;
  return Math.floor(amount / 10 ** decimals);
}
async function fetchTransactionDetails(walletPublicKey) {
  try {
    const transactionSignatures =
      await connection.getConfirmedSignaturesForAddress2(walletPublicKey, {
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

function getPresaleCycle(
  start,
  now = new Date().getTime(),
  due = process.env.PRESALE_INCREASE_TIME
) {
  const cycle = Math.floor((now - start) / 86400 / 1000 / due);
  return cycle ? cycle : 0;
}

// listenForTransactions();
presaleStart();
