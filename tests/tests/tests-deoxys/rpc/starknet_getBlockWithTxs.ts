import axios from "axios";
import { performance } from "perf_hooks";
import * as dotenv from "dotenv";
dotenv.config();

const REMOTE_RPC_URL = process.env.REMOTE_RPC;
const LOCAL_RPC_URL = process.env.DEOXYS_RPC;
const BLOCK_NUMBER = 2000;
const START_BLOCK = 2000;
const END_BLOCK = 2020;

const requestDataForMethod = (method: string, params: any[]) => ({
  id: 1,
  jsonrpc: "2.0",
  method: method,
  params: params,
});

const compareObjects = (obj1: any, obj2: any, path: string = ""): string => {
  let differences = "";

  // Extract all unique keys from both objects
  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

  for (const key of allKeys) {
    const currentPath = path ? `${path}.${key}` : key;

    // Handle cases where a key is not present in one of the objects or is undefined
    if (obj1[key] === undefined) {
      differences += `\x1b[31mMISSING in Alchemy at ${currentPath}: ${obj2[key]}\x1b[0m\n`;
      continue;
    }

    if (obj2[key] === undefined) {
      differences += `\x1b[31mMISSING in Local at ${currentPath}: ${obj1[key]}\x1b[0m\n`;
      continue;
    }

    if (typeof obj1[key] === "object" && obj1[key] !== null) {
      differences += compareObjects(obj1[key], obj2[key], currentPath);
    } else if (obj1[key] !== obj2[key]) {
      differences += `\x1b[31mDIFFERENCE at ${currentPath}: ${obj1[key]} (Alchemy) vs ${obj2[key]} (Local)\x1b[0m\n`;
    } else {
      differences += `\x1b[32mMATCH at ${currentPath}: ${obj1[key]}\x1b[0m\n`;
    }
  }

  return differences;
};

async function benchmarkMethod(method: string, params: any[]): Promise<string> {
  console.log(
    `\x1b[34mBenchmarking method: ${method}\x1b[0m for block_number: ${params[0].block_number}`,
  );

  const alchemyResponse = await axios.post(
    REMOTE_RPC_URL,
    requestDataForMethod(method, params),
  );
  const localResponse = await axios.post(
    LOCAL_RPC_URL,
    requestDataForMethod(method, params),
  );

  return compareObjects(alchemyResponse.data, localResponse.data);
}

async function checkDifferencesInBlocks() {
  const blocksWithDifferences: number[] = [];

  for (let blockNumber = START_BLOCK; blockNumber < END_BLOCK; blockNumber++) {
    const differences = await benchmarkMethod("starknet_getBlockWithTxs", [
      { block_number: blockNumber },
    ]);

    if (differences.includes("\x1b[31mDIFFERENCE")) {
      blocksWithDifferences.push(blockNumber);
    }
  }

  if (blocksWithDifferences.length === 0) {
    console.log("\x1b[32mAll blocks match!\x1b[0m");
  } else {
    console.log(
      "\x1b[31mDifferences found in blocks:\x1b[0m",
      blocksWithDifferences,
    );
  }
}

(async () => {
  // Single block test
  const singleBlockDifferences = await benchmarkMethod(
    "starknet_getBlockWithTxs",
    [{ block_number: BLOCK_NUMBER }],
  );
  console.log(singleBlockDifferences);

  // Loop through 1k blocks
  await checkDifferencesInBlocks();
})();
