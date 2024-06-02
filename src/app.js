require("dotenv").config();
const { getOrCreateAssociatedTokenAccount } = require("@solana/spl-token");
const transferSPLtoken = require("./utils/transfer");
const {
  Connection,
  clusterApiUrl,
  PublicKey,
  Keypair,
} = require("@solana/web3.js");

const bs58 = require("bs58");

const start = new Date(process.env.PRESALE_START).getTime();
const presaleStartPrice = process.env.PRESALE_START_PRICE;

async function presaleStart() {
  console.log("Start presale: ", new Date(start));

  const connection = initializeConnection();

  const now = new Date().getTime();
  const cycle = getPresaleCycle(start, now);

  if (cycle >= process.env.PRESALE_MAX_CYCLE) {
    console.log("End presale!");
    return;
  }

  const tokenWalletKeypair = initializeKeypair();
  const avaliableTokenBalanceForPresale =
    await getAvaliableTokenBalanceForPresale(tokenWalletKeypair, connection);
  console.log(
    `Presale now: cycle ${cycle}, available token ${avaliableTokenBalanceForPresale}`
  );

  const walletPublicKey = new PublicKey(process.env.PUBLIC_KEY);
  listenForTransactions(walletPublicKey, connection);
}

function getPricePerToken() {
  const now = new Date().getTime();
  const cycle = getPresaleCycle(start, now);
  const price = presaleStartPrice * 1.1 ** cycle;

  return price ? price : presaleStartPrice;
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
    `Listening for transactions to wallet: ${walletPublicKey.toString()} (${
      latestLoggedBalance / 1e9
    } SOL)`
  );

  const subscriptionId = connection.onAccountChange(
    walletPublicKey,
    async (accountInfo) => {
      try {
        const newBalance = accountInfo.lamports;
        const receivedBalance = (newBalance - latestLoggedBalance) / 1e9;
        latestLoggedBalance = newBalance;
        const senderWallet = await fetchTransactionDetails(
          walletPublicKey,
          connection
        );
        if (receivedBalance > 0) {
          console.log(
            `Account ${walletPublicKey.toString()} receive ${receivedBalance} SOL fron ${senderWallet}`
          );
        } else {
          return;
        }

        const price = Number(getPricePerToken());
        console.log(`price per token ${price}`);
        const amount = Math.floor(receivedBalance / price);

        console.log(`Transfer: ${amount} tokens from ${senderWallet}`);
        // const txid = await transferSPLtoken(senderWallet, amount);

        // return txid;
      } catch (error) {
        console.log("error: ", error);
        return error;
      }
    }
  );

  // connection.removeAccountChangeListener(subscriptionId);
}

async function getAvaliableTokenBalanceForPresale(
  tokenWalletKeypair,
  connection
) {
  tokenMinkPublickey = new PublicKey(process.env.TOKEN_MINT_ADDRESS);

  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    tokenWalletKeypair,
    tokenMinkPublickey,
    tokenWalletKeypair.publicKey
  );

  const { amount, decimals } = (
    await connection.getTokenAccountBalance(tokenAccount.address)
  ).value;
  return Math.floor(amount / 10 ** decimals);
}

async function fetchTransactionDetails(walletPublicKey, connection) {
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
