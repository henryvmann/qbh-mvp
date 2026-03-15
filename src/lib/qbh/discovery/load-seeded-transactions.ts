import { promises as fs } from "fs";
import path from "path";

export type SeededTransaction = {
  transaction_id: string;
  date: string;
  name?: string | null;
  merchant_name?: string | null;
  amount: number;
};

type SeededTransactionFile =
  | SeededTransaction[]
  | {
      start_date?: string;
      end_date?: string;
      count?: number;
      transactions?: SeededTransaction[];
    };

export async function loadSeededTransactions(): Promise<SeededTransaction[]> {
  const filePath = path.join(
    process.cwd(),
    "src",
    "lib",
    "qbh",
    "discovery",
    "seed",
    "qbh_transactions.json"
  );

  const raw = await fs.readFile(filePath, "utf8");
  const parsed: SeededTransactionFile = JSON.parse(raw);

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed && Array.isArray(parsed.transactions)) {
    return parsed.transactions;
  }

  throw new Error(
    "Seeded transactions file must contain an array or a transactions array."
  );
}