import { EventEmitter } from "node:events";

class RealtimeBus extends EventEmitter {
  publishVote(electionId: string) {
    this.emit(`vote:${electionId}`);
  }
}

export const realtimeBus = new RealtimeBus();
realtimeBus.setMaxListeners(500);
