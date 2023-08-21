// Globals
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";

export const provider = new ethers.providers.JsonRpcProvider(
  process.env.RPC_URL
);

export const wssProvider = new ethers.providers.WebSocketProvider(
  process.env.RPC_URL_WSS 
);