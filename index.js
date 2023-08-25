import { ethers } from "ethers";
import { provider, wssProvider } from "./src/constants.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import fetch from 'node-fetch';
const jsdom = require("jsdom");
const https = require('https');
const cheerio = require('cheerio');


let mempoolTxs = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const analyzeTransaction = async (tx) => {
  const tx_hash = tx.hash;
  const txReceipt = await provider.getTransactionReceipt(tx_hash);
  const confirmedBlock = await provider.getBlock(txReceipt.blockNumber);
  const validator = confirmedBlock.miner;

  // const response = await fetch(`https://etherscan.io/tx/${tx_hash}`);
  const url = `https://etherscan.io/tx/${tx_hash}`;

  https.get(url, response => {
    let data = '';
  
    response.on('data', chunk => {
      data += chunk;
    });
  
    response.on('end', () => {
      const $ = cheerio.load(data);
      const siteComponent = $('#ContentPlaceHolder1_divTimeStamp  >  div > div:last-child > span:last-child').text();
      console.log(siteComponent);
    });
  }).on('error', error => {
    console.error(error);
  });
  //   console.log(tx.hash, txReceipt.status != 0 ? "Success" : "Failed");

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

  wssProvider.on("block", async (blk) => {
    await sleep(5000);
    console.log(blk);
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
  });
};

main();
