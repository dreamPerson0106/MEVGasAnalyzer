import { ethers } from "ethers";
import { provider, wssProvider } from "./src/constants.js";

let mempoolTxs = [];

const analyzeTransaction = async (tx) => {
  const tx_hash = tx.hash;
  const txReceipt = await provider.getTransactionReceipt(tx_hash);
  const confirmedBlock = await provider.getBlock(txReceipt.blockNumber);
  const validator = confirmedBlock.miner;

  console.log(tx.hash, txReceipt.status != 0 ? "Success" : "Failed");

  // Start detect fee using transfer to miner
  const tx_trace = await provider.send("debug_traceTransaction", [
    tx_hash,
    { tracer: "callTracer" },
  ]);
  const calls = tx_trace.calls;
  let feeInEther = ethers.constants.Zero;
  let feeInGwei = ethers.constants.Zero;
  for (let i = 0; i < calls.length; ++i) {
    const to = calls[i].to;
    if (to.toLowerCase() == validator.toLowerCase()) {
      const valueToTransfer = ethers.BigNumber.from(calls[i].value);
      feeInEther = feeInEther.add(valueToTransfer);
      console.log(
        "Send fee using transfer",
        ethers.utils.formatEther(valueToTransfer),
        "eth"
      );
    }
  }

  // Start detect fee using gwei to miner
  if (txReceipt.type == 0) {
    const priorityGwei = tx.gasPrice.sub(confirmedBlock.baseFeePerGas);
    const gasUsedForMiner = priorityGwei.mul(txReceipt.gasUsed);
    feeInGwei = feeInGwei.add(gasUsedForMiner);
    console.log(
      "Send fee using type 0",
      ethers.utils.formatEther(gasUsedForMiner),
      "eth"
    );
  }
  if (txReceipt.type == 2) {
    const priorityGwei = tx.maxFeePerGas
      .sub(confirmedBlock.baseFeePerGas)
      .gt(tx.maxPriorityFeePerGas)
      ? tx.maxPriorityFeePerGas
      : tx.maxFeePerGas.sub(confirmedBlock.baseFeePerGas);
    const gasUsedForMiner = priorityGwei.mul(txReceipt.gasUsed);
    feeInGwei = feeInGwei.add(gasUsedForMiner);
    console.log(
      "Send fee using type 2",
      ethers.utils.formatEther(gasUsedForMiner),
      "eth"
    );
  }

  console.log("Tx hash:", tx_hash, "Success?:", txReceipt.status != 0 ? "✔" : "X", "fee in Ether:", ethers.utils.parseEther(feeInEther), "fee in Gwei:", ethers.utils.parseEther(feeInGwei));
};

const main = async () => {
  console.log("Start analyzing transaction gas fees");
  wssProvider.on("block", async (blk) => {
    const txs = (await wssProvider.getBlockWithTransactions(blk)).transactions;
    for (let i = 0; i < txs.length; ++i) {
        const indexOfHashInMempool = mempoolTxs.indexOf(txs[i].hash);
        if (txs[i].to != null && indexOfHashInMempool === -1) {
        await analyzeTransaction(txs[i]);
      }
      if (indexOfHashInMempool >= 0) {
        mempoolTxs = mempoolTxs.slice(
          indexOfHashInMempool,
          indexOfHashInMempool
        );
      }
    }
  });

  wssProvider.on("pending", async (hash) => {
    if (mempoolTxs.indexOf(hash) === -1) mempoolTxs.push(hash);
    console.log(mempoolTxs.length);
  });
};

main();
