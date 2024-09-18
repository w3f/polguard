export enum Chain {
  Polkadot = 'Polkadot',
  Kusama = 'Kusama',
  // Centrifuge is currently not supported
  Centrifuge = 'Centrifuge',
}

export enum MonitorType {
  Validator = 'Validator',
  Governance = 'Governance',
  Transaction = 'Transaction',
}

// TODO: implement list of addresses and reconnect or fall back to getting the rpc from config
export const RPC_ADDRESSES: { [key in Chain]: string } = {
  [Chain.Polkadot]: 'wss://polkadot-rpc.dwellir.com',
  [Chain.Kusama]: 'wss://kusama-rpc.dwellir.com',
  [Chain.Centrifuge]: 'wss://fullnode.centrifuge.io',
}
