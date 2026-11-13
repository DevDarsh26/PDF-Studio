import { create } from "zustand";
import { Command } from "../core/commands/command";
import { CommandLedger, LedgerState } from "../core/commands/ledger";
import { EditOperation } from "../core/models/operations";

export interface HistoryStoreState {
  ledger: CommandLedger;
  state: LedgerState;

  // Actions
  executeCommand: (command: Command) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  getActiveOperations: () => EditOperation[];
  clearHistory: () => void;
  markSaved: () => void;
}

const ledgerInstance = new CommandLedger(100);

export const useHistoryStore = create<HistoryStoreState>((set, get) => ({
  ledger: ledgerInstance,
  state: ledgerInstance.state,

  executeCommand: async (command: Command) => {
    const { ledger } = get();
    await ledger.execute(command);
    set({ state: ledger.state });
  },

  undo: async () => {
    const { ledger } = get();
    await ledger.undo();
    set({ state: ledger.state });
  },

  redo: async () => {
    const { ledger } = get();
    await ledger.redo();
    set({ state: ledger.state });
  },

  getActiveOperations: () => {
    return get().ledger.getActiveOperations();
  },

  clearHistory: () => {
    const { ledger } = get();
    ledger.clear();
    set({ state: ledger.state });
  },

  markSaved: () => {
    const { ledger } = get();
    ledger.markSaved();
    set({ state: ledger.state });
  },
}));
