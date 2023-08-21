import {ethers} from "ethers";
import { wssProvider } from "./src/constants.js";

const analyzeTransaction = async (tx) => {

}

const main = async () => {
    console.log("Start analyzing transaction gas fees");
    await analyzeTransaction("0xbae1881421d5d5c598a3762465a07211e65856a41f97c8906846a5f59e0158da");
    await analyzeTransaction("0x3820844d43995e3b7d64d9cad20b06a9855d23bfd3e242c0d4a89f9e6dbab069");
    await analyzeTransaction("0x8fe6b7b191759459bf302b2c7cc0a67e6e6ad31db26263afece3bc3e81c43f5f");
}

main()