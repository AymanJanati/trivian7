import "server-only";
import { randomInt } from "node:crypto";
import { MEMORY_ROUNDS } from "./rules";

export function generateMemorySequences(): number[][] {
  const sequences: number[][] = [];
  for (const round of MEMORY_ROUNDS) {
    let sequence: number[];
    do {
      sequence = [];
      for (let i = 0; i < round.length; i++) {
        // Uniformly pick from the other eight positions: no accidental double flashes.
        const value = randomInt(i === 0 ? 9 : 8);
        sequence.push(i > 0 && value >= sequence[i - 1] ? value + 1 : value);
      }
    } while (
      sequences.length &&
      sequence.slice(0, 3).every((tile, i) => tile === sequences.at(-1)![i])
    );
    sequences.push(sequence);
  }
  return sequences;
}
