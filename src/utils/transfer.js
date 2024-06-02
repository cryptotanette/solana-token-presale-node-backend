const {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
} = require("@solana/spl-token");

const {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  Keypair,
  ComputeBudgetProgram,
} = require("@solana/web3.js");

const bs58 = require("bs58");
require("dotenv/config");

// Fetches the number of decimals for a given token to accurately handle token amounts.
async function getNumberDecimals(mintAddress, connection) {
  const info = await connection.getParsedAccountInfo(mintAddress);
  const decimals = (info.value?.data).parsed.info.decimals;
  //   console.log(`Token Decimals: ${decimals}`);
  return decimals;
}

// Main function orchestrates sending tokens by calling the defined functions in order.
async function transferSPLtoken(
  sourceWalletKeypair,
  destinationWalletPublickey,
  amount = 1,
  connection
) {
  console.log(`Transfer: ${amount} tokens to ${destinationWalletPublickey}`);

  if (
    sourceWalletKeypair.publicKey.toString() ==
    destinationWalletPublickey.toString()
  ) {
    console.log("Warning: same wallet");
    return;
  }

  // The SLP token being transferred, this is the address for USDC
  const mintAddress = new PublicKey(process.env.TOKEN_MINT_ADDRESS);

  // Config priority fee and amount to transfer
  const PRIORITY_RATE = 12345; // MICRO_LAMPORTS
  if (parseInt(amount) <= 0) {
    throw "amount isn't correct";
  }
  const transferAmount = amount > 1 ? amount : 1;

  // Instruction to set the compute unit price for priority fee
  const PRIORITY_FEE_INSTRUCTIONS = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: PRIORITY_RATE,
  });

  const decimals = await getNumberDecimals(mintAddress, connection);

  // Creates or fetches the associated token accounts for the sender and receiver.
  let sourceAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    sourceWalletKeypair,
    mintAddress,
    sourceWalletKeypair.publicKey
  );
  console.log(`from ${sourceAccount.address.toString()}`);

  let destinationAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    sourceWalletKeypair,
    mintAddress,
    destinationWalletPublickey
  );
  console.log(`to ${destinationAccount.address.toString()}`);

  // Adjusts the transfer amount according to the token's decimals to ensure accurate transfers.
  const transferAmountInDecimals = transferAmount * Math.pow(10, decimals);

  // Prepares the transfer instructions with all necessary information.
  const transferInstruction = createTransferInstruction(
    // Those addresses are the Associated Token Accounts belonging to the sender and receiver
    sourceAccount.address,
    destinationAccount.address,
    sourceWalletKeypair.publicKey,
    transferAmountInDecimals
  );
  let latestBlockhash = await connection.getLatestBlockhash("confirmed");

  // Compiles and signs the transaction message with the sender's Keypair.
  const messageV0 = new TransactionMessage({
    payerKey: sourceWalletKeypair.publicKey,
    recentBlockhash: latestBlockhash.blockhash,
    instructions: [PRIORITY_FEE_INSTRUCTIONS, transferInstruction],
  }).compileToV0Message();
  const versionedTransaction = new VersionedTransaction(messageV0);
  versionedTransaction.sign([sourceWalletKeypair]);
  console.log("Transaction Signed. Preparing to send...");

  // Attempts to send the transaction to the network, handling success or failure.
  try {
    const txid = await connection.sendTransaction(versionedTransaction, {
      maxRetries: 20,
    });
    console.log(`Transaction Submitted: ${txid}`);

    const confirmation = await connection.confirmTransaction(
      {
        signature: txid,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      },
      "confirmed"
    );
    if (confirmation.value.err) {
      throw new Error("🚨Transaction not confirmed.");
    }
    console.log(
      `Transaction Successfully Confirmed! 🎉 View on SolScan: https://solscan.io/tx/${txid}`
    );
    return txid;
  } catch (error) {
    console.error("Transaction failed", error);
    throw error;
  }
}

module.exports = transferSPLtoken;
