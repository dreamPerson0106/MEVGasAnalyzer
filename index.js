import {ethers} from "ethers";
import { provider, wssProvider } from "./src/constants.js";

const analyzeTransaction = async (tx_hash) => {
    const txReceipt = await provider.getTransactionReceipt(tx_hash);
    const confirmedBlock = await provider.getBlock(txReceipt.blockNumber);
    const validator = confirmedBlock.miner;

    const tx_trace = await provider.send('debug_traceTransaction', [tx_hash,{"tracer": "callTracer"}]);
    const calls = tx_trace.calls;
    for(let i = 0 ; i < calls.length ; ++ i) {
        const to = calls[i].to;
        if(to.toLowerCase() == validator.toLowerCase()) {
            console.log("We detect transfer to miner.");
        }
    }
}

const main = async () => {
    console.log("Start analyzing transaction gas fees");
    await analyzeTransaction("0xb9a24ad80c61da710e10194ccb11ff4c549a7d9b246456474cbab62dcf132d1e");
    // await analyzeTransaction("0x3820844d43995e3b7d64d9cad20b06a9855d23bfd3e242c0d4a89f9e6dbab069");
    // await analyzeTransaction("0x8fe6b7b191759459bf302b2c7cc0a67e6e6ad31db26263afece3bc3e81c43f5f");
}

main()