import { ethers } from "ethers";
import { provider, wssProvider } from "./src/constants.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import fetch from 'node-fetch';
const jsdom = require("jsdom");
const https = require('https');
const http = require('http');
const cheerio = require('cheerio');

const puppeteer = require('puppeteer');


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

  const options = {
    host: 'etherscan.io',
      port: '80',
      path: `/tx/${tx_hash}`,
      method: 'GET',
      headers: {
        'Cookie': 'displaymode=dark; etherscan_address_format=0; etherscan_datetime_format=UTC; etherscan_settings=x0:1|x1:1|x2:en|x3:USD|x4:0|x5:0|x6:ENS|x7:UTC|x8:1; CultureInfo=en; __stripe_mid=9b401b31-27de-44b2-ae36-6bc1a958f27848743e; etherscan_cookieconsent=True; bitmedia_fid=eyJmaWQiOiIwYjJjNjE5YzhlOTEwYjI4MGQxNjBkYWMzMTdmNWVhOSIsImZpZG5vdWEiOiJmMWRjNzBiZDUwMWFmMzBiMDIyODQ0MTZlNjM5MzE2YiJ9; _ga=GA1.1.70512955.1690950419; ASP.NET_SessionId=adkmgfe1dgr3h3htzugswyw3; etherscan_pwd=4792:Qdxb:29xiH0wXNeFfqV+qt5UAUIdMf6Faa9cmky4Z2a45KUQ=; etherscan_userid=DreamPerson0106; etherscan_autologin=True; __cflb=0H28vPcoRrcznZcNZSuFrvaNdHwh857bnso7roPCUmi; cf_clearance=vznZeZFiNGF43TzLmEy7YuXuUnqw44c8d92aXi0LBDM-1692943299-0-1-ba6f4700.1bb4a04c.3a83a946-0.2.1692943299; _ga_NHZNQE2B8K=GS1.1.1692943357.25.1.1692943363.0.0.0; _ga_T1JC9RNQXV=GS1.1.1692943367.107.1.1692945750.0.0.0',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded'
      }
  }

  var req = http.request(options, response => {
    let data = '';
  
    response.on('data', chunk => {
      data += chunk;
    });
  
    response.on('end', () => {
      console.log("data=", data);
      const $ = cheerio.load(data);
      const siteComponent = $('#ContentPlaceHolder1_divTimeStamp  >  div > div:last-child > span:last-child');
      console.log(siteComponent.length);
    });
  }).on('error', error => {
      console.error(error);
    });
  req.end();


  // https.get(url, response => {
  //   let data = '';
  
  //   response.on('data', chunk => {
  //     data += chunk;
  //   });
  
  //   response.on('end', () => {
  //     console.log(data);
  //     const $ = cheerio.load(data);
  //     const siteComponent = $('#ContentPlaceHolder1_divTimeStamp  >  div > div:last-child > span:last-child');
  //     console.log(siteComponent.length);
  //   });
  // }).on('error', error => {
  //   console.error(error);
  // });
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

  
  const browser = await puppeteer.launch({args: ['--no-sandbox'], headless: "new"});
  const page = await browser.newPage();
  const url = 'https://etherscan.io/tx/0x4a961ee2a00161a1c6d3d135885cf61ea6fde274e72f68798ed519efc2d36492';
  await page.setExtraHTTPHeaders({
    'Cookie': 'displaymode=dark; etherscan_address_format=0; etherscan_datetime_format=UTC; etherscan_settings=x0:1|x1:1|x2:en|x3:USD|x4:0|x5:0|x6:ENS|x7:UTC|x8:1; CultureInfo=en; __stripe_mid=9b401b31-27de-44b2-ae36-6bc1a958f27848743e; etherscan_cookieconsent=True; bitmedia_fid=eyJmaWQiOiIwYjJjNjE5YzhlOTEwYjI4MGQxNjBkYWMzMTdmNWVhOSIsImZpZG5vdWEiOiJmMWRjNzBiZDUwMWFmMzBiMDIyODQ0MTZlNjM5MzE2YiJ9; _ga=GA1.1.70512955.1690950419; ASP.NET_SessionId=adkmgfe1dgr3h3htzugswyw3; etherscan_pwd=4792:Qdxb:29xiH0wXNeFfqV+qt5UAUIdMf6Faa9cmky4Z2a45KUQ=; etherscan_userid=DreamPerson0106; etherscan_autologin=True; cf_clearance=vznZeZFiNGF43TzLmEy7YuXuUnqw44c8d92aXi0LBDM-1692943299-0-1-ba6f4700.1bb4a04c.3a83a946-0.2.1692943299; _ga_NHZNQE2B8K=GS1.1.1692947380.26.0.1692947380.0.0.0; __cflb=0H28vPcoRrcznZcNZSuFrvaNdHwh858YTBXb4EFFFTz; _ga_T1JC9RNQXV=GS1.1.1692943367.107.1.1692947385.0.0.0',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36'
  });

  await page.setJavaScriptEnabled(true);
  await page.goto(url, { waitUntil: 'networkidle0' });
  console.log(await page.content());
  const blockNumberElements = await page.$$('div.media-body span');
  const blockNumberElement = blockNumberElements.find(element => element.textContent.includes('Block Height'));
  const blockNumber = blockNumberElement.nextElementSibling.textContent.trim();
  console.log(blockNumber);

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
