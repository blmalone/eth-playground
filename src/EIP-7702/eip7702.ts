import { Hex, concatHex, numberToHex, parseTransaction, recoverAddress } from "viem";
import { sepolia } from "viem/chains";
import { publicClient } from "./client";
import "dotenv/config";
import { privateKeyToAccount, sign } from "viem/accounts";
import { toHex, encodeFunctionData } from "viem/utils";
import { toRlp, keccak256, serializeTransaction, TransactionSerializableEIP7702 } from "viem";

const C = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
};

function printField(label: string, value: string, unit?: string) {
  const display = unit ? `${value} ${unit}` : value;
  console.log(`${C.cyan}${label.padEnd(12)}:${C.green} ${display}${C.reset}`);
}

export const abi = [
  {
    inputs: [],
    name: "ping",
    outputs: [],
    stateMutability: "view",
    type: "function",
  },
] as const;

async function main() {
  console.log(`\n${C.cyan}=== EIP-7702 Demo ===${C.reset}\n`);

  // Private keys for EOA and RELAY
  const EOA = process.env.EOA_SEPOLIA_PRIVATE_KEY as Hex;
  const EOA_ADDRESS = privateKeyToAccount(EOA).address;
  const RELAY = process.env.RELAY_SEPOLIA_PRIVATE_KEY as Hex;
  const RELAY_ADDRESS = privateKeyToAccount(RELAY).address;
  // This is the address of the contract that the EOA will act as.
  const CONTRACT_ADDRESS: Hex = "0xb8401e6b373ef0d445640bc572e34068480911ec";

  // Fetch nonce
  const eoaNonce = await publicClient.getTransactionCount({ address: EOA_ADDRESS });
  const relayNonce = await publicClient.getTransactionCount({ address: RELAY_ADDRESS });
  printField("EOA Addr", EOA_ADDRESS);
  printField("EOA Nonce", toHex(eoaNonce));
  printField("Relay Addr", RELAY_ADDRESS);
  printField("Relay Nonce", toHex(relayNonce));
  console.log();

  // Build and hash message
  const message = concatHex([
    "0x05",
    toRlp([numberToHex(sepolia.id), CONTRACT_ADDRESS, eoaNonce ? numberToHex(eoaNonce) : "0x"]),
  ]);
  const hash = keccak256(message);

  // Log the message and signature info
  printField("Magic Prefix", "0x05");
  printField("RLP Payload", message);
  printField("Message", message);
  printField("Hash", hash);

  // Sign the message
  const signature = await sign({ hash, privateKey: EOA });

  // Verify the signature
  const address = await recoverAddress({
    hash,
    signature,
  });
  printField("Recovered", address);

  // Estimate gas for the transaction
  let gasLimit = await publicClient.estimateContractGas({
    account: RELAY_ADDRESS,
    address: CONTRACT_ADDRESS,
    abi,
    functionName: "ping",
  });

  // Add extra gas to cover 7702 authorization & signature payload.
  // Intrinsic cost for the authorization list is not captured by the
  // contract call estimator above, so we pad with ~30k gas.
  const INTRINSIC_OVERHEAD = 30_000n;
  gasLimit += INTRINSIC_OVERHEAD;

  // Estimated gas fees
  const { maxFeePerGas, maxPriorityFeePerGas } = await publicClient.estimateFeesPerGas();

  // Log transaction parameters
  console.log("\nEIP-7702 transaction:");
  const tx: TransactionSerializableEIP7702 = {
    type: "eip7702",
    chainId: sepolia.id,
    nonce: relayNonce,
    to: EOA_ADDRESS, // EOA acting as contract
    gas: gasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
    gasPrice: undefined,
    maxFeePerBlobGas: undefined,
    value: 0n,
    data: encodeFunctionData({
      // Function call on implementation contract
      abi,
      functionName: "ping",
    }),
    authorizationList: [
      {
        address: CONTRACT_ADDRESS,
        chainId: sepolia.id,
        nonce: eoaNonce,
        r: signature.r,
        s: signature.s,
        v: signature.v,
        yParity: signature.yParity!,
      },
    ],
  };
  console.log(tx);

  const serialized = serializeTransaction(tx);
  console.log();
  printField("Serialized transaction", serialized);

  const transactionHash = keccak256(serialized);
  printField("Transaction hash", transactionHash);

  const relayerSignature = await sign({ hash: transactionHash, privateKey: RELAY });
  printField("Relayer signature", relayerSignature.r + relayerSignature.s + relayerSignature.v);

  // serialize the signed transaction
  const signedSerialized: Hex = serializeTransaction({
    ...tx,
    r: relayerSignature.r,
    s: relayerSignature.s,
    v: relayerSignature.v,
  });
  printField("Signed serialized transaction", signedSerialized);

  parseTransaction(signedSerialized);

  const txHash = await publicClient.sendRawTransaction({
    serializedTransaction: signedSerialized,
  });
  printField("Transaction Hash", txHash);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
