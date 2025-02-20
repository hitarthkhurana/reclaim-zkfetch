# Temperature Verifier DApp

A decentralized application that verifies temperature conditions in San Francisco and New York City using zero-knowledge proofs via Reclaim Protocol ZK Fetch.

- Frontend: React.js + Tailwind CSS
- Smart Contract: Solidity (Sepolia testnet)
- ZK Proofs: Reclaim Protocol ZK Fetch
- Data Source: OpenMeteo API


## Deployed Addresses
- Verifier Contract: `0x60A8DEBC449699f25FB3a01822B50d5C6395b00e`

When you click "Verify and Claim 1 USDC":
1. The DApp generates and verifies a ZK proof with real-time temperature data from OpenMeteo API for San Francisco and New York City
2. The proof is submitted to the smart contract
3. The contract verifies the proof and temperature conditions
4. If the temperature conditions are met (SF > 50°F and NYC < 30°F), the contract automatically transfers 1 mock USDC to your wallet







## Getting Started

### Prerequisites
- wallet with some Sepolia ETH for gas
- Reclaim Protocol credentials

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file:
```bash
REACT_APP_RECLAIM_APP_ID=your_app_id
REACT_APP_RECLAIM_APP_SECRET=your_app_secret
```

3. Start the development server:
```bash
npm start
```


