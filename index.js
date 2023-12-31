import { ethers } from "ethers";
import { provider, wssProvider } from "./src/constants.js";
import axios from "axios";

let mempoolTxs = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const analyzeTransaction = async (tx) => {
  const tx_hash = tx.hash;
  const txReceipt = await provider.getTransactionReceipt(tx_hash);
  const confirmedBlock = await provider.getBlock(txReceipt.blockNumber);
  const validator = confirmedBlock.miner;

  if(txReceipt.status != 1) return;

  const responseOfEtherscan = await axios.get(`http://65.109.109.169:5000/${tx_hash}`);
  if(responseOfEtherscan.data.status == true) {
    return;
  }

  // Start detect fee using transfer to miner
  const tx_trace = await provider.send("debug_traceTransaction", [
    tx_hash,
    { tracer: "callTracer" },
  ]);
  const calls = tx_trace.calls;
  if (calls === undefined) return;
  let feeInEther = ethers.constants.Zero;
  let feeInGwei = ethers.constants.Zero;
  for (let i = 0; i < calls.length; ++i) {
    const to = calls[i].to;
    if (to.toLowerCase() == validator.toLowerCase()) {
      const valueToTransfer = ethers.BigNumber.from(calls[i].value);
      feeInEther = feeInEther.add(valueToTransfer);
      //   console.log(
      //     "Send fee using transfer",
      //     ethers.utils.formatEther(valueToTransfer),
      //     "eth"
      //   );
    }
  }

  // Start detect fee using gwei to miner
  if (txReceipt.type == 0) {
    const priorityGwei = tx.gasPrice.sub(confirmedBlock.baseFeePerGas);
    const gasUsedForMiner = priorityGwei.mul(txReceipt.gasUsed);
    feeInGwei = feeInGwei.add(gasUsedForMiner);
    // console.log(
    //   "Send fee using type 0",
    //   ethers.utils.formatEther(gasUsedForMiner),
    //   "eth"
    // );
  }
  if (txReceipt.type == 2) {
    const priorityGwei = tx.maxFeePerGas
      .sub(confirmedBlock.baseFeePerGas)
      .gt(tx.maxPriorityFeePerGas)
      ? tx.maxPriorityFeePerGas
      : tx.maxFeePerGas.sub(confirmedBlock.baseFeePerGas);
    const gasUsedForMiner = priorityGwei.mul(txReceipt.gasUsed);
    feeInGwei = feeInGwei.add(gasUsedForMiner);
    // console.log(
    //   "Send fee using type 2",
    //   ethers.utils.formatEther(gasUsedForMiner),
    //   "eth"
    // );
  }

  console.log(
    "Tx hash:",
    tx_hash,
    "Success?:",
    txReceipt.status != 0 ? "✔" : "X",
    "fee in Ether:",
    ethers.utils.formatEther(feeInEther),
    "fee in Gwei:",
    ethers.utils.formatEther(feeInGwei)
  );
};

const main = async () => {
  console.log("Start analyzing MEV txs");

  while(1) {
    const responseOfEtherscan = await axios.get(`http://65.109.109.169:5000/0x93bbe7dcc044d70fe2d3f2f846bc25786db80f828eac9b26ce9654939cac1389`);
    if(responseOfEtherscan.data.status == false) {
      console.log("Error on etherscan anazlyer");
      break;
    }
  }

  // wssProvider.on("block", async (blk) => {
  //   let countOfTxNotInMempool = 0;
  //   console.log(blk);
  //   const txs = (await wssProvider.getBlockWithTransactions(blk)).transactions;
  //   for (let i = 0; i < txs.length; ++i) {
  //     const indexOfHashInMempool = mempoolTxs.indexOf(txs[i].hash);
  //     if (txs[i].data != "0x" && txs[i].to != null && indexOfHashInMempool < 0) {
  //       countOfTxNotInMempool++;
  //     }
  //   }
  //   console.log(countOfTxNotInMempool, mempoolTxs.length);
  //   for(let i = 0 ; i < txs.length ; ++ i) {
  //     const indexOfHashInMempool = mempoolTxs.indexOf(txs[i].hash);
  //     if (txs[i].data != "0x" && txs[i].to != null && indexOfHashInMempool < 0) {
  //       analyzeTransaction(txs[i]);
  //       await sleep(12000 / countOfTxNotInMempool);
  //     }
  //     if (indexOfHashInMempool >= 0) {
  //       mempoolTxs = mempoolTxs.slice(
  //         indexOfHashInMempool,
  //         indexOfHashInMempool
  //       );
  //     }
  //   }
  // });

  // wssProvider.on("pending", async (hash) => {
  //   if (mempoolTxs.indexOf(hash) === -1) mempoolTxs.push(hash);
  // });
};

main();
